#!/usr/bin/env python3
"""Batch generate Duolingo-style educational assets via ComfyUI.

Generates ~465 flat-design, bold-outline illustrations organized by category
for use in early learning educational apps (ages 3-8).

Usage:
    python batch_duolingo.py          # Full batch (465 items)
    python batch_duolingo.py --test   # Test batch (10 representative items)
"""

import argparse
import json
import os
import random
import sys
import time
import uuid
from datetime import datetime
from pathlib import Path

# Add the agent-harness to path so imports work from any current directory.
AGENT_HARNESS_PATH = Path(__file__).resolve().parent / "agent-harness"
sys.path.insert(0, str(AGENT_HARNESS_PATH))

from cli_anything.comfyui.core.queue import queue_prompt, get_prompt_history
from cli_anything.comfyui.core.images import download_prompt_images

# Import the asset catalog from the existing batch script
from batch_animals import ASSETS
from batch_animals import ANIMAL_CATEGORIES
from batch_animals import CREATURE_CATEGORIES
from batch_animals import PERSON_CATEGORIES

DEFAULT_COMFYUI_URL = "http://localhost:8188"


def resolve_comfyui_server_url() -> str:
    """Return the ComfyUI URL for this batch run."""
    configured_url = os.environ.get("COMFYUI_URL", DEFAULT_COMFYUI_URL).strip()
    return configured_url or DEFAULT_COMFYUI_URL


SERVER = resolve_comfyui_server_url()

# ---------------------------------------------------------------------------
# Test subset — 10 representative items spanning all template types
# ---------------------------------------------------------------------------

TEST_ITEMS = {
    "animals-wild": ["lion"],
    "animals-insects": ["butterfly"],
    "animals-ocean": ["goldfish"],
    "kitchen": ["fork"],
    "fruits": ["apple"],
    "vehicles": ["car"],
    "professions": ["doctor", "firefighter"],
    "shapes": ["red circle"],
    "numbers": ["number five"],
}

# ---------------------------------------------------------------------------
# Duolingo-style prompt templates
# ---------------------------------------------------------------------------
#
# We generate assets on a pure white background and ship them as-is (no
# transparency, no chroma-key cleanup). The earlier magenta-chroma-key
# pipeline produced too many subject-painted-magenta failures for items
# without strong natural color priors (apple, car, number 5). White
# backgrounds compose cleanly into card-style game layouts.

DUOLINGO_ANIMAL_TEMPLATE = (
    "A cute cartoon {object}, flat vector illustration, solid color fills, "
    "pure solid white background, clean white background, "
    "Duolingo style, friendly character, simple geometric shapes, "
    "bright saturated colors, centered, single character, minimal outlines, "
    "clean modern design"
)

DUOLINGO_CREATURE_TEMPLATE = (
    "A cute cartoon {object}, flat vector illustration, solid color fills, "
    "pure solid white background, clean white background, "
    "Duolingo style, friendly, simple geometric shapes, bright saturated "
    "colors, centered, single creature, minimal outlines, clean modern "
    "design"
)

DUOLINGO_PERSON_TEMPLATE = (
    "A single {object} character, flat vector illustration, solid color "
    "fills, pure solid white background, clean white background, "
    "Duolingo style, friendly human character, simple geometric shapes, "
    "bright saturated colors, centered, one person only, minimal outlines, "
    "clean modern design"
)

DUOLINGO_OBJECT_TEMPLATE = (
    "A {object}, flat vector illustration, solid color fills, "
    "pure solid white background, clean white background, Duolingo "
    "style, simple geometric shapes, bright saturated colors, centered, "
    "single object, no face, no eyes, inanimate object, minimal outlines, "
    "clean modern design, recognizable details and features, "
    "not a silhouette"
)

DUOLINGO_NEGATIVE_PROMPT = """\
photorealistic, realistic, 3D render, gradient, soft shading, pastel colors, texture, watercolor, painterly, sketch, multiple objects, duplicates, dark background, black background, gray background, colored background, busy background, patterned background, scenery, shadows, glossy, metallic, blurry, watermark, text, logo, face on object, eyes on object, anthropomorphic object, thick outlines, heavy outlines, bold outlines, monochrome, silhouette, single color object\
"""


def render_prompt(category: str, item: str) -> str:
    """Return the filled-in positive prompt for a category/item pair.

    Pure function — no I/O. Template selection mirrors the original
    in-loop logic in main() so the string output is identical.
    """
    if category in ANIMAL_CATEGORIES:
        template = DUOLINGO_ANIMAL_TEMPLATE
    elif category in CREATURE_CATEGORIES:
        template = DUOLINGO_CREATURE_TEMPLATE
    elif category in PERSON_CATEGORIES:
        template = DUOLINGO_PERSON_TEMPLATE
    else:
        template = DUOLINGO_OBJECT_TEMPLATE
    return template.replace("{object}", item)


def _slug(item: str) -> str:
    """Match the slug normalisation used in the generation loop."""
    return item.replace(" ", "-").replace("/", "-").lower()


def filter_jobs(
    jobs: list[tuple[str, str]],
    target_prefixes: list[str],
) -> list[tuple[str, str]]:
    """Return only the jobs whose `{category}_{slug(item)}` prefix is in
    `target_prefixes`. Prefix form must match the batch runner's filename
    prefix exactly — see the `prefix = f"{category}_{safe_name}"` line in
    main().
    """
    targets = set(target_prefixes)
    return [(cat, item) for cat, item in jobs if f"{cat}_{_slug(item)}" in targets]


# ---------------------------------------------------------------------------
# Workflow builder — Qwen Image with optional Lightning LoRA
# ---------------------------------------------------------------------------

def build_qwen_image_workflow(
    positive_prompt: str,
    negative_prompt: str,
    prefix: str = "duolingo",
    steps: int = 20,
    cfg: float = 3.5,
    use_lora: bool = False,
    seed: int | None = None,
) -> tuple[dict, int]:
    """Build a Qwen Image workflow for Duolingo-style generation."""
    if seed is None:
        seed = random.randint(0, 2**32 - 1)

    workflow = {
        "10": {
            "class_type": "UNETLoader",
            "inputs": {
                "unet_name": "qwen_image_fp8_e4m3fn.safetensors",
                "weight_dtype": "fp8_e4m3fn",
            },
        },
        "20": {
            "class_type": "CLIPLoader",
            "inputs": {
                "clip_name": "qwen_2.5_vl_7b_fp8_scaled.safetensors",
                "type": "qwen_image",
            },
        },
        "30": {
            "class_type": "VAELoader",
            "inputs": {
                "vae_name": "qwen_image_vae.safetensors",
            },
        },
    }

    # Model reference — either raw UNET or LoRA-patched
    model_ref = ["10", 0]

    if use_lora:
        workflow["15"] = {
            "class_type": "LoraLoaderModelOnly",
            "inputs": {
                "model": ["10", 0],
                "lora_name": "Qwen-Image-Lightning-8steps-V1.0.safetensors",
                "strength_model": 1.0,
            },
        }
        model_ref = ["15", 0]

    # No ModelSamplingAuraFlow — Qwen Image works best without shift
    workflow.update({
        "27": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "clip": ["20", 0],
                "text": positive_prompt,
            },
        },
        "34": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "clip": ["20", 0],
                "text": negative_prompt,
            },
        },
        "13": {
            "class_type": "EmptySD3LatentImage",
            "inputs": {
                "width": 1024,
                "height": 1024,
                "batch_size": 1,
            },
        },
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "model": model_ref,
                "positive": ["27", 0],
                "negative": ["34", 0],
                "latent_image": ["13", 0],
                "seed": seed,
                "steps": steps,
                "cfg": cfg,
                "sampler_name": "euler",
                "scheduler": "normal",
                "denoise": 1.0,
            },
        },
        "8": {
            "class_type": "VAEDecode",
            "inputs": {
                "samples": ["3", 0],
                "vae": ["30", 0],
            },
        },
        "9": {
            "class_type": "SaveImage",
            "inputs": {
                "images": ["8", 0],
                "filename_prefix": prefix,
            },
        },
    })

    return workflow, seed


# ---------------------------------------------------------------------------
# Single-attempt runner
# ---------------------------------------------------------------------------

def _run_one_attempt(
    server: str,
    client_id: str,
    workflow: dict,
    output_dir: str,
) -> tuple[list[str], str | None]:
    """Queue one workflow, poll for completion, download the resulting PNGs.

    Returns (paths, error). `error` is None on success or a short string on
    timeout / queue error. Generated PNGs are saved as-is with a flat white
    background — no rembg, no alpha, no chroma-key cleanup.
    """
    try:
        result = queue_prompt(server, workflow, client_id=client_id)
    except Exception as e:
        return [], f"queue_error: {e}"

    prompt_id = result.get("prompt_id")
    for _ in range(180):  # ~6 minutes at 2s poll
        time.sleep(2)
        try:
            hist = get_prompt_history(server, prompt_id)
            if hist and hist.get("completed"):
                images = download_prompt_images(
                    server, prompt_id, output_dir, overwrite=True,
                )
                paths = [img["path"] for img in images]
                return paths, None
        except RuntimeError:
            pass
    return [], "timeout"


# ---------------------------------------------------------------------------
# Main batch runner
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Duolingo-style batch asset generation")
    parser.add_argument("--test", action="store_true", help="Generate only 10 test items")
    parser.add_argument("--cfg", type=float, default=5.5, help="CFG scale (default: 5.5)")
    parser.add_argument("--steps", type=int, default=30, help="Sampling steps (default: 30)")
    parser.add_argument("--lora", action="store_true", help="Use Lightning LoRA for speed")
    parser.add_argument("--only-items", type=Path, default=None,
                        help="Path to a JSON array of prefixes (e.g. regen_targets.json); "
                             "filters the job list to only these items")
    args = parser.parse_args()
    server = resolve_comfyui_server_url()

    client_id = str(uuid.uuid4())
    output_base = Path("edu_assets_duolingo_2")
    log_file = output_base / "generation_log.json"

    # Build job list
    if args.test:
        assets = TEST_ITEMS
    else:
        assets = ASSETS

    jobs = []
    for category, items in assets.items():
        for item in items:
            jobs.append((category, item))

    if args.only_items is not None:
        if not args.only_items.exists():
            print(f"ERROR: --only-items file not found: {args.only_items}")
            return 1
        target_prefixes = json.loads(args.only_items.read_text())
        before = len(jobs)
        jobs = filter_jobs(jobs, target_prefixes)
        print(f"Filtered {before} -> {len(jobs)} jobs from {args.only_items}")

    total = len(jobs)
    mode = "TEST" if args.test else "FULL"
    print(f"=== Duolingo-Style Batch Generation ({mode}) ===")
    print(f"Total assets: {total}")
    print(f"Server: {server}")
    print(f"Model: qwen_image_fp8_e4m3fn.safetensors")
    print(f"Settings: {args.steps} steps, cfg {args.cfg}, euler/karras")
    print(f"LoRA: {'Lightning 8-step' if args.lora else 'none'}")
    print(f"Output: {output_base.resolve()}")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*55}\n")

    # Load existing log to support resume
    log = []
    completed_keys = set()
    if log_file.exists():
        try:
            existing = json.loads(log_file.read_text())
            log = existing
            completed_keys = {
                f"{e['category']}/{e['item']}"
                for e in existing
                if e.get("status") == "ok"
            }
            if completed_keys:
                print(f"Resuming: {len(completed_keys)} already done, "
                      f"{total - len(completed_keys)} remaining\n")
        except Exception:
            pass

    success = len(completed_keys)
    failed = 0
    skipped = 0

    for i, (category, item) in enumerate(jobs, 1):
        key = f"{category}/{item}"

        if key in completed_keys:
            skipped += 1
            continue

        safe_name = item.replace(" ", "-").replace("/", "-").lower()
        prefix = f"{category}_{safe_name}"
        output_dir = str(output_base / category)

        positive = render_prompt(category, item)

        print(f"[{i}/{total}] {category} / {item}")

        entry = {
            "category": category,
            "item": item,
            "prefix": prefix,
            "timestamp": datetime.now().isoformat(),
            "status": "pending",
            "style": "duolingo",
        }

        workflow, seed = build_qwen_image_workflow(
            positive, DUOLINGO_NEGATIVE_PROMPT,
            prefix=prefix,
            steps=args.steps,
            cfg=args.cfg,
            use_lora=args.lora,
        )
        paths, err = _run_one_attempt(
            server, client_id, workflow, output_dir,
        )

        if err is not None:
            final_status = "timeout" if err == "timeout" else "error"
            final_error = err
            final_paths: list[str] = []
        else:
            final_status = "ok"
            final_error = None
            final_paths = paths

        entry["status"] = final_status
        entry["files"] = final_paths
        entry["seed"] = seed
        entry["cfg"] = args.cfg
        entry["steps"] = args.steps
        entry["positive_prompt"] = positive
        if final_error:
            entry["error"] = final_error

        if final_status == "ok":
            print(f"  OK -> {final_paths[0] if final_paths else '?'}")
            success += 1
        else:
            print(f"  {final_status.upper()}: {final_error}")
            failed += 1

        log.append(entry)

        # Save log after every item (crash-safe)
        output_base.mkdir(parents=True, exist_ok=True)
        log_file.write_text(json.dumps(log, indent=2))

    print(f"\n{'='*55}")
    print(f"=== COMPLETE ({mode}) ===")
    print(f"Success: {success}")
    print(f"Failed:  {failed}")
    print(f"Skipped: {skipped} (already done)")
    print(f"Total:   {total}")
    print(f"Finished: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Log: {log_file.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
