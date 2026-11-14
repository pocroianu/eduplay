#!/usr/bin/env python3
"""
Provider-focused Qwen-Image bridge for the ai-content Node runtime.

This script exposes three machine-readable actions:
- --health-check
- --warm-model
- --generate --request-file <json>
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import traceback
from pathlib import Path

import numpy as np
from PIL import Image


PYTORCH_CUDA_ALLOC_CONF_VALUE = "expandable_segments:True"
RUNTIME_ROOT = Path(__file__).resolve().parents[1].joinpath(".runtime", "qwen-image")
HF_HOME_ROOT = RUNTIME_ROOT.joinpath("hf-home")
LOCAL_DIFFUSERS_SRC_ROOT = RUNTIME_ROOT.joinpath("src", "diffusers-main", "diffusers-main", "src")
LOG_FILE_PATH: Path | None = None


def log_status(message: str) -> None:
    print(f"[qwen-provider] {message}", file=sys.stderr, flush=True)
    if LOG_FILE_PATH is not None:
        LOG_FILE_PATH.parent.mkdir(parents=True, exist_ok=True)
        with LOG_FILE_PATH.open("a", encoding="utf-8") as handle:
            handle.write(f"[qwen-provider] {message}\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Provider bridge for Qwen-Image generation.")
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--health-check", action="store_true", help="Verify the local Qwen runtime.")
    action.add_argument("--warm-model", action="store_true", help="Load Qwen once to warm the cache.")
    action.add_argument("--generate", action="store_true", help="Generate a single image from a request file.")
    parser.add_argument("--request-file", default="", help="JSON request file for --generate.")
    parser.add_argument("--log-file", default="", help="Optional log file path.")
    parser.add_argument("--model", default="Qwen/Qwen-Image", help="Model id to load.")
    parser.add_argument("--device", default="cuda", help="Device for inference: auto, cuda, cpu, or mps.")
    parser.add_argument(
        "--diffusers-source",
        default="installed",
        help=(
            "Diffusers import source. Use 'installed' for the venv package, "
            "'local-main' for .runtime/qwen-image/src/diffusers-main/diffusers-main/src, "
            "or pass an explicit source directory path."
        ),
    )
    parser.add_argument(
        "--memory-mode",
        default="sequential-offload",
        choices=["auto", "full-gpu", "model-offload", "sequential-offload"],
        help="Placement strategy for large models.",
    )
    parser.add_argument(
        "--true-cfg-scale",
        type=float,
        default=3.5,
        help="Qwen classifier-free guidance scale.",
    )
    parser.add_argument(
        "--local-files-only",
        action="store_true",
        help="Load from the local Hugging Face cache only.",
    )
    parser.add_argument(
        "--hf-home",
        default="",
        help="Optional Hugging Face cache root override.",
    )
    return parser.parse_args()


def maybe_configure_cuda_allocator(requested_device: str) -> None:
    if requested_device in {"auto", "cuda"}:
        os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", PYTORCH_CUDA_ALLOC_CONF_VALUE)


def maybe_configure_huggingface_home(raw_hf_home: str) -> Path:
    hf_home_root = Path(raw_hf_home).expanduser().resolve() if raw_hf_home else HF_HOME_ROOT
    hf_home_root.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("HF_HOME", str(hf_home_root))
    os.environ.setdefault("HF_HUB_CACHE", str(hf_home_root.joinpath("hub")))
    os.environ.setdefault("TRANSFORMERS_CACHE", str(hf_home_root.joinpath("transformers")))
    return hf_home_root


def resolve_diffusers_source(raw_value: str) -> Path | None:
    if raw_value in {"", "installed"}:
        return None

    if raw_value == "local-main":
        return LOCAL_DIFFUSERS_SRC_ROOT.resolve()

    return Path(raw_value).expanduser().resolve()


def maybe_prepend_diffusers_source(raw_value: str) -> Path | None:
    source_root = resolve_diffusers_source(raw_value)
    if source_root is None:
        return None

    if not source_root.exists():
        raise RuntimeError(f"Requested diffusers source path does not exist: {source_root}")

    source_root_str = str(source_root)
    if source_root_str not in sys.path:
        sys.path.insert(0, source_root_str)

    return source_root


def load_runtime_modules(raw_diffusers_source: str):
    source_root = maybe_prepend_diffusers_source(raw_diffusers_source)

    try:
        import torch  # type: ignore
        import diffusers  # type: ignore
        from diffusers import QwenImagePipeline  # type: ignore
    except ImportError as error:
        raise RuntimeError("Missing runtime dependencies for Qwen-Image.") from error

    diffusers_info = {
        "version": diffusers.__version__,
        "moduleFile": getattr(diffusers, "__file__", "<unknown>"),
        "sourceRoot": str(source_root) if source_root is not None else None,
    }
    return torch, QwenImagePipeline, diffusers_info


def resolve_device(requested: str, torch_module) -> str:
    if requested == "cuda" and not torch_module.cuda.is_available():
        raise RuntimeError("CUDA was requested, but the active torch build does not expose CUDA.")

    if requested == "mps":
        if not hasattr(torch_module.backends, "mps") or not torch_module.backends.mps.is_available():
            raise RuntimeError("MPS was requested, but the active torch build does not expose MPS.")
        return "mps"

    if requested == "cpu":
        return "cpu"

    if requested != "auto":
        return requested

    if torch_module.cuda.is_available():
        return "cuda"

    if hasattr(torch_module.backends, "mps") and torch_module.backends.mps.is_available():
        return "mps"

    return "cpu"


def resolve_dtype(device: str, torch_module):
    if device == "cuda":
        return torch_module.bfloat16
    return torch_module.float32


def apply_memory_mode(pipe, memory_mode: str, device: str) -> None:
    if device != "cuda":
        pipe.to(device)
        return

    if memory_mode == "auto":
        memory_mode = "model-offload"

    if memory_mode == "full-gpu":
        pipe.to(device)
        return

    pipe.enable_attention_slicing()
    pipe.vae.enable_slicing()

    if memory_mode == "model-offload":
        pipe.enable_model_cpu_offload(device=device)
        return

    if memory_mode == "sequential-offload":
        pipe.enable_sequential_cpu_offload(device=device)
        return

    raise ValueError(f"Unsupported memory mode: {memory_mode}")


def decode_latents_to_pil(pipe, latents, height: int, width: int, torch_module) -> Image.Image:
    log_status(f"latent generation complete shape={tuple(latents.shape)}")
    latents = pipe._unpack_latents(latents, height, width, pipe.vae_scale_factor)
    log_status(f"latents unpacked shape={tuple(latents.shape)}")

    latents = latents.to(pipe.vae.dtype)
    latents_mean = (
        torch_module.tensor(pipe.vae.config.latents_mean)
        .view(1, pipe.vae.config.z_dim, 1, 1, 1)
        .to(latents.device, latents.dtype)
    )
    latents_std = 1.0 / torch_module.tensor(pipe.vae.config.latents_std).view(
        1, pipe.vae.config.z_dim, 1, 1, 1
    ).to(latents.device, latents.dtype)
    latents = latents / latents_std + latents_mean
    log_status("vae decode starting")
    image_tensor = pipe.vae.decode(latents, return_dict=False)[0][:, :, 0]
    image_tensor = image_tensor.detach()
    log_status(f"vae decode complete shape={tuple(image_tensor.shape)}")

    image_np = pipe.image_processor.postprocess(image_tensor, output_type="np")
    log_status("image postprocess complete")

    if isinstance(image_np, list):
        image_np = image_np[0]
    else:
        image_np = image_np[0]

    if image_np.dtype != np.uint8:
        image_np = np.clip(np.rint(image_np * 255.0), 0, 255).astype("uint8")

    return Image.fromarray(image_np)


def load_request(file_path: str) -> dict[str, object]:
    if not file_path:
        raise ValueError("--request-file is required for --generate.")

    path = Path(file_path).expanduser().resolve()
    if not path.exists():
        raise FileNotFoundError(f"Request file does not exist: {path}")

    return json.loads(path.read_text(encoding="utf-8"))


def run_health_check(args: argparse.Namespace) -> dict[str, object]:
    maybe_configure_cuda_allocator(args.device)
    hf_home_root = maybe_configure_huggingface_home(args.hf_home)
    torch, _, diffusers_info = load_runtime_modules(args.diffusers_source)
    device = resolve_device(args.device, torch)

    return {
      "status": "healthy",
      "message": f"Qwen runtime ready on {device}",
      "python": sys.executable,
      "bridgeScript": str(Path(__file__).resolve()),
      "cudaAvailable": bool(torch.cuda.is_available()),
      "diffusersVersion": diffusers_info["version"],
      "diffusersModuleFile": diffusers_info["moduleFile"],
      "hfHome": str(hf_home_root),
      "hfHomeExists": hf_home_root.exists(),
      "model": args.model,
      "device": device,
    }


def warm_model(args: argparse.Namespace) -> dict[str, object]:
    maybe_configure_cuda_allocator(args.device)
    maybe_configure_huggingface_home(args.hf_home)
    torch, qwen_pipeline, diffusers_info = load_runtime_modules(args.diffusers_source)
    device = resolve_device(args.device, torch)
    dtype = resolve_dtype(device, torch)

    log_status(f"warming model cache for {args.model}")
    pipe = qwen_pipeline.from_pretrained(
        args.model,
        torch_dtype=dtype,
        local_files_only=args.local_files_only,
    )
    del pipe

    return {
        "status": "warmed",
        "model": args.model,
        "localFilesOnly": args.local_files_only,
        "diffusersVersion": diffusers_info["version"],
        "diffusersModuleFile": diffusers_info["moduleFile"],
    }


def generate_image(args: argparse.Namespace) -> dict[str, object]:
    request = load_request(args.request_file)
    output_path = Path(str(request["outputPath"])).expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    maybe_configure_cuda_allocator(args.device)
    maybe_configure_huggingface_home(args.hf_home)
    torch, qwen_pipeline, diffusers_info = load_runtime_modules(args.diffusers_source)
    device = resolve_device(args.device, torch)
    dtype = resolve_dtype(device, torch)

    log_status(
        f"loading model={args.model} device={device} memory_mode={args.memory_mode} "
        f"local_files_only={args.local_files_only}"
    )
    log_status(
        f"using diffusers version={diffusers_info['version']} "
        f"module={diffusers_info['moduleFile']}"
    )
    pipe = qwen_pipeline.from_pretrained(
        args.model,
        torch_dtype=dtype,
        local_files_only=args.local_files_only,
    )
    apply_memory_mode(pipe, args.memory_mode, device)
    log_status("pipeline ready")

    prompt = str(request["prompt"])
    negative_prompt = str(request.get("negativePrompt", ""))
    width = int(request["width"])
    height = int(request["height"])
    steps = int(request["steps"])
    true_cfg_scale = float(request.get("trueCfgScale", args.true_cfg_scale))
    seed = int(request["seed"])

    log_status(
        f"generating prompt seed={seed} size={width}x{height} steps={steps}"
    )
    generator = torch.Generator(device=device).manual_seed(seed)
    with torch.inference_mode():
        latent_output = pipe(
            prompt=prompt,
            negative_prompt=negative_prompt,
            width=width,
            height=height,
            num_inference_steps=steps,
            true_cfg_scale=true_cfg_scale,
            generator=generator,
            output_type="latent",
        )
    latents = latent_output.images if hasattr(latent_output, "images") else latent_output[0]
    image = decode_latents_to_pil(pipe, latents, height, width, torch)
    log_status(f"saving image to {output_path}")
    image.save(output_path)

    return {
        "status": "completed",
        "filePath": str(output_path),
        "width": width,
        "height": height,
        "seed": seed,
        "device": device,
        "diffusersVersion": diffusers_info["version"],
        "diffusersModuleFile": diffusers_info["moduleFile"],
        "model": args.model,
        "memoryMode": args.memory_mode,
    }


def main() -> None:
    global LOG_FILE_PATH

    args = parse_args()
    if args.log_file:
        LOG_FILE_PATH = Path(args.log_file).expanduser().resolve()
    elif args.generate and args.request_file:
        request = load_request(args.request_file)
        if "logFilePath" in request:
            LOG_FILE_PATH = Path(str(request["logFilePath"])).expanduser().resolve()

    if args.health_check:
        print(json.dumps(run_health_check(args), indent=2))
        return

    if args.warm_model:
        print(json.dumps(warm_model(args), indent=2))
        return

    if args.generate:
        print(json.dumps(generate_image(args), indent=2))
        return

    raise RuntimeError("No action selected.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"{type(error).__name__}: {error}", file=sys.stderr)
        traceback.print_exc()
        if LOG_FILE_PATH is not None:
            LOG_FILE_PATH.parent.mkdir(parents=True, exist_ok=True)
            with LOG_FILE_PATH.open("a", encoding="utf-8") as handle:
                handle.write(f"{type(error).__name__}: {error}\n")
                handle.write(traceback.format_exc())
        sys.exit(1)
