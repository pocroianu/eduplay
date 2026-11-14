#!/usr/bin/env python3
"""
Experimental Qwen-Image text-to-image spike for @edu-play/ai-content.

This script defaults to a dry run so we can inspect the prompt, output path,
and recommended uv command without accidentally downloading the large Qwen model.
Use --execute to run generation for real.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
import traceback
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable

import numpy as np
from PIL import Image


PROMPT_PRESETS = {
    "bulk-baseline": (
        "friendly cartoon {subject}, flat children's picture book illustration, "
        "centered on a clean white background"
    ),
    "bulk-house": (
        "friendly cartoon {subject}, flat children's picture book illustration, "
        "bold clean outline, flat colors, isolated single subject, "
        "centered on a clean white background"
    ),
    "sticker-flashcard": (
        "friendly cartoon {subject}, clean sticker-style illustration, bold outline, "
        "flat colors, isolated single subject, children's flashcard art, "
        "centered on a pure white background"
    ),
}

DEFAULT_NEGATIVE_PROMPT = (
    "photo, realistic, dark scene, text, watermark, cluttered background, scenery, "
    "extra objects, detailed background, dramatic lighting, heavy shadows, "
    "painterly texture, 3d render"
)

UV_RUN_EXAMPLE = (
    "uv run "
    "--with torch "
    "--with transformers "
    "--with accelerate "
    "--with sentencepiece "
    "--with safetensors "
    "--with pillow "
    "--with diffusers "
    "scripts/qwen-image-spike.py --execute"
)

CUDA_ENV_SETUP_EXAMPLE = (
    "powershell -ExecutionPolicy Bypass "
    "-File scripts/setup-qwen-image-env.ps1"
)

PYTORCH_CUDA_ALLOC_CONF_VALUE = "expandable_segments:True"
RUNTIME_ROOT = Path(__file__).resolve().parents[1].joinpath(".runtime", "qwen-image")
HF_HOME_ROOT = RUNTIME_ROOT.joinpath("hf-home")
LOCAL_DIFFUSERS_SRC_ROOT = RUNTIME_ROOT.joinpath("src", "diffusers-main", "diffusers-main", "src")
LOG_FILE_PATH: Path | None = None


@dataclass
class PlannedImage:
    subject: str
    seed: int
    prompt: str
    file_path: str


def log_status(message: str) -> None:
    print(f"[qwen-spike] {message}", file=sys.stderr, flush=True)
    if LOG_FILE_PATH is not None:
        LOG_FILE_PATH.parent.mkdir(parents=True, exist_ok=True)
        with LOG_FILE_PATH.open("a", encoding="utf-8") as handle:
            handle.write(f"[qwen-spike] {message}\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Experimental Qwen-Image spike for asset-style animal generation."
    )
    parser.add_argument(
        "--subjects",
        default="elephant,fox",
        help="Comma-separated list of subjects to generate.",
    )
    parser.add_argument(
        "--prompt-preset",
        default="bulk-house",
        choices=sorted(PROMPT_PRESETS.keys()),
        help="Prompt preset to use for generation.",
    )
    parser.add_argument(
        "--negative-prompt",
        default=DEFAULT_NEGATIVE_PROMPT,
        help="Negative prompt passed to the Qwen pipeline.",
    )
    parser.add_argument(
        "--model",
        default="Qwen/Qwen-Image",
        help="Model id to load via diffusers.",
    )
    parser.add_argument(
        "--width",
        type=int,
        default=1024,
        help="Image width. Official docs recommend 1024 for best results.",
    )
    parser.add_argument(
        "--height",
        type=int,
        default=1024,
        help="Image height. Official docs recommend 1024 for best results.",
    )
    parser.add_argument(
        "--steps",
        type=int,
        default=30,
        help="Number of inference steps.",
    )
    parser.add_argument(
        "--true-cfg-scale",
        type=float,
        default=3.5,
        help="Classifier-free guidance scale. Qwen-Image uses true_cfg_scale instead of guidance_scale.",
    )
    parser.add_argument(
        "--seed-base",
        type=int,
        default=510000,
        help="Base seed. Each subject increments from this value.",
    )
    parser.add_argument(
        "--device",
        default="auto",
        help="Device for inference: auto, cuda, cpu, or mps.",
    )
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
        default="auto",
        choices=["auto", "full-gpu", "model-offload", "sequential-offload"],
        help="Placement strategy for large models. Auto prefers model offload on CUDA to fit 16 GB class GPUs.",
    )
    parser.add_argument(
        "--lora-path",
        default="",
        help="Optional local LoRA adapter path for accelerated or stylized Qwen runs.",
    )
    parser.add_argument(
        "--lora-scale",
        type=float,
        default=1.0,
        help="Scale applied when fusing an optional LoRA adapter.",
    )
    parser.add_argument(
        "--local-files-only",
        action="store_true",
        help="Load the model from the local Hugging Face cache only. Useful after the first successful download.",
    )
    parser.add_argument(
        "--output-dir",
        default="",
        help="Directory for generated images. Defaults to a timestamped temp folder.",
    )
    parser.add_argument(
        "--log-file",
        default="",
        help="Optional log file path. Defaults to <output-dir>/run.log during execute mode.",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Run generation for real. Without this flag, the script prints the plan only.",
    )
    return parser.parse_args()


def resolve_output_dir(raw_value: str) -> Path:
    if raw_value:
        return Path(raw_value).expanduser().resolve()

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return Path(tempfile.gettempdir()).joinpath(f"qwen-image-spike-{timestamp}")


def parse_subjects(raw_subjects: str) -> list[str]:
    subjects = [item.strip() for item in raw_subjects.split(",") if item.strip()]
    if not subjects:
        raise ValueError("At least one subject is required.")
    return subjects


def build_plan(
    subjects: Iterable[str],
    prompt_template: str,
    seed_base: int,
    output_dir: Path,
) -> list[PlannedImage]:
    planned: list[PlannedImage] = []
    for index, subject in enumerate(subjects):
        seed = seed_base + index
        planned.append(
            PlannedImage(
                subject=subject,
                seed=seed,
                prompt=prompt_template.format(subject=subject),
                file_path=str(output_dir.joinpath(f"{subject}.png")),
            )
        )
    return planned


def print_plan(args: argparse.Namespace, plan: list[PlannedImage], output_dir: Path) -> None:
    payload = {
        "mode": "execute" if args.execute else "dry-run",
        "model": args.model,
        "promptPreset": args.prompt_preset,
        "negativePrompt": args.negative_prompt,
        "width": args.width,
        "height": args.height,
        "steps": args.steps,
        "trueCfgScale": args.true_cfg_scale,
        "device": args.device,
        "diffusersSource": args.diffusers_source,
        "memoryMode": args.memory_mode,
        "loraPath": args.lora_path or None,
        "loraScale": args.lora_scale,
        "localFilesOnly": args.local_files_only,
        "outputDir": str(output_dir),
        "logFile": args.log_file or None,
        "hfHome": str(HF_HOME_ROOT),
        "uvRunExample": UV_RUN_EXAMPLE,
        "cudaEnvSetupExample": CUDA_ENV_SETUP_EXAMPLE,
        "images": [asdict(item) for item in plan],
    }
    print(json.dumps(payload, indent=2))


def resolve_device(requested: str, torch_module) -> str:
    if requested == "cuda" and not torch_module.cuda.is_available():
        raise RuntimeError(
            "CUDA was requested, but the active torch build does not expose CUDA. "
            "Use a CUDA-enabled torch environment or re-run with --device cpu for a much slower experiment."
        )

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


def maybe_configure_cuda_allocator(requested_device: str) -> None:
    if requested_device in {"auto", "cuda"}:
        os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", PYTORCH_CUDA_ALLOC_CONF_VALUE)


def maybe_configure_huggingface_home() -> None:
    HF_HOME_ROOT.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("HF_HOME", str(HF_HOME_ROOT))
    os.environ.setdefault("HF_HUB_CACHE", str(HF_HOME_ROOT.joinpath("hub")))
    os.environ.setdefault("TRANSFORMERS_CACHE", str(HF_HOME_ROOT.joinpath("transformers")))


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
    except ImportError as error:  # pragma: no cover - exercised in real env only
        raise RuntimeError(
            "Missing runtime dependencies for Qwen-Image. "
            "Install them with the reusable setup script or transiently with uv, for example:\n"
            f"  {CUDA_ENV_SETUP_EXAMPLE}\n"
            f"  {UV_RUN_EXAMPLE}"
        ) from error

    diffusers_info = {
        "version": diffusers.__version__,
        "moduleFile": getattr(diffusers, "__file__", "<unknown>"),
        "sourceRoot": str(source_root) if source_root is not None else None,
    }
    return torch, QwenImagePipeline, diffusers_info


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


def maybe_load_lora(pipe, raw_lora_path: str, lora_scale: float) -> None:
    if not raw_lora_path:
        return

    lora_path = Path(raw_lora_path).expanduser()
    if lora_path.exists():
        log_status(f"loading lora from {lora_path}")
        pipe.load_lora_weights(str(lora_path.parent), weight_name=lora_path.name)
    else:
        log_status(f"loading lora from hub id {raw_lora_path}")
        pipe.load_lora_weights(raw_lora_path)

    log_status(f"fusing lora with scale={lora_scale}")
    pipe.fuse_lora(lora_scale=lora_scale)


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


def execute_generation(args: argparse.Namespace, plan: list[PlannedImage], output_dir: Path) -> None:
    maybe_configure_cuda_allocator(args.device)
    maybe_configure_huggingface_home()
    torch, qwen_pipeline, diffusers_info = load_runtime_modules(args.diffusers_source)

    device = resolve_device(args.device, torch)
    dtype = resolve_dtype(device, torch)

    output_dir.mkdir(parents=True, exist_ok=True)

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
    maybe_load_lora(pipe, args.lora_path, args.lora_scale)
    apply_memory_mode(pipe, args.memory_mode, device)
    log_status("pipeline ready")

    manifest = []

    for item in plan:
        log_status(
            f"generating subject={item.subject} seed={item.seed} "
            f"size={args.width}x{args.height} steps={args.steps}"
        )
        generator = torch.Generator(device=device).manual_seed(item.seed)
        with torch.inference_mode():
            latent_output = pipe(
                prompt=item.prompt,
                negative_prompt=args.negative_prompt,
                width=args.width,
                height=args.height,
                num_inference_steps=args.steps,
                true_cfg_scale=args.true_cfg_scale,
                generator=generator,
                output_type="latent",
            )
        latents = latent_output.images if hasattr(latent_output, "images") else latent_output[0]
        image = decode_latents_to_pil(pipe, latents, args.height, args.width, torch)

        target_path = Path(item.file_path)
        log_status(f"saving image to {target_path}")
        image.save(target_path)
        manifest.append(
            {
                "subject": item.subject,
                "seed": item.seed,
                "prompt": item.prompt,
                "filePath": str(target_path),
                "model": args.model,
                "device": device,
                "diffusersVersion": diffusers_info["version"],
                "memoryMode": args.memory_mode,
                "loraPath": args.lora_path or None,
            }
        )

    manifest_path = output_dir.joinpath("manifest.json")
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    log_status(f"wrote manifest to {manifest_path}")

    print(
        json.dumps(
            {
                "status": "completed",
                "outputDir": str(output_dir),
                "manifestPath": str(manifest_path),
                "images": manifest,
                "device": device,
                "diffusersVersion": diffusers_info["version"],
                "diffusersModuleFile": diffusers_info["moduleFile"],
                "diffusersSourceRoot": diffusers_info["sourceRoot"],
                "memoryMode": args.memory_mode,
                "loraPath": args.lora_path or None,
            },
            indent=2,
        )
    )


def main() -> None:
    global LOG_FILE_PATH
    args = parse_args()
    if args.steps < 2:
        raise ValueError("Qwen-Image requires at least 2 inference steps for a meaningful run.")
    subjects = parse_subjects(args.subjects)
    prompt_template = PROMPT_PRESETS[args.prompt_preset]
    output_dir = resolve_output_dir(args.output_dir)
    if args.execute:
        LOG_FILE_PATH = (
            Path(args.log_file).expanduser().resolve()
            if args.log_file
            else output_dir.joinpath("run.log")
        )
    plan = build_plan(subjects, prompt_template, args.seed_base, output_dir)

    print_plan(args, plan, output_dir)

    if not args.execute:
        return

    execute_generation(args, plan, output_dir)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # pragma: no cover - top-level cli guard
        print(f"{type(error).__name__}: {error}", file=sys.stderr)
        traceback.print_exc()
        if LOG_FILE_PATH is not None:
            LOG_FILE_PATH.parent.mkdir(parents=True, exist_ok=True)
            with LOG_FILE_PATH.open("a", encoding="utf-8") as handle:
                handle.write(f"{type(error).__name__}: {error}\n")
                handle.write(traceback.format_exc())
        sys.exit(1)
