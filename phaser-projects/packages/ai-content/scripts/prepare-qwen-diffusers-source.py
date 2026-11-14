#!/usr/bin/env python3
"""
Prepare a patched local diffusers source tree for Qwen-Image experiments.

This avoids long packaging operations by:
- patching the extracted local diffusers source under `.runtime/qwen-image/src`
- prepending that source tree to the active venv via a `.pth` file

Run this with the target qwen-image venv's Python interpreter.
"""

from __future__ import annotations

import site
import sys
from pathlib import Path


RUNTIME_ROOT = Path(__file__).resolve().parents[1].joinpath(".runtime", "qwen-image")
LOCAL_DIFFUSERS_SRC_ROOT = RUNTIME_ROOT.joinpath("src", "diffusers-main", "diffusers-main", "src")
PIPELINE_FILE_PATH = LOCAL_DIFFUSERS_SRC_ROOT.joinpath(
    "diffusers", "pipelines", "qwenimage", "pipeline_qwenimage.py"
)
PATCH_MARKER = "# edu-play qwen windows offload guard"
PTH_FILE_NAME = "zz_qwen_diffusers_local.pth"

IMPORT_BLOCK_OLD = "import inspect\nfrom typing import Any, Callable\n"
IMPORT_BLOCK_NEW = "import inspect\nimport os\nfrom typing import Any, Callable\n"

HOOK_BLOCK_OLD = """        # Offload all models
        self.maybe_free_model_hooks()
"""

HOOK_BLOCK_NEW = """        # Offload all models
        if os.name == "nt" and len(getattr(self, "_all_hooks", [])) > 0:
            logger.warning("Skipping Windows CPU offload hook reset for Qwen-Image to avoid an access violation")
        else:
            self.maybe_free_model_hooks()
"""


def resolve_site_packages_dir() -> Path:
    candidates = [Path(path) for path in site.getsitepackages()]
    for candidate in candidates:
        if candidate.name == "site-packages" and candidate.exists():
            return candidate
    raise RuntimeError("Could not resolve site-packages for the active interpreter.")


def patch_qwen_pipeline_file() -> Path:
    if not PIPELINE_FILE_PATH.exists():
        raise RuntimeError(f"Local diffusers source file not found: {PIPELINE_FILE_PATH}")

    content = PIPELINE_FILE_PATH.read_text(encoding="utf-8")
    updated = content

    if PATCH_MARKER not in updated:
        if IMPORT_BLOCK_OLD not in updated:
            raise RuntimeError("Unexpected qwen pipeline import block; patch cannot be applied safely.")
        updated = updated.replace(IMPORT_BLOCK_OLD, IMPORT_BLOCK_NEW, 1)

        if HOOK_BLOCK_OLD not in updated:
            raise RuntimeError("Unexpected qwen pipeline hook block; patch cannot be applied safely.")
        updated = updated.replace(
            HOOK_BLOCK_OLD,
            f"{PATCH_MARKER}\n{HOOK_BLOCK_NEW}",
            1,
        )

        PIPELINE_FILE_PATH.write_text(updated, encoding="utf-8")

    return PIPELINE_FILE_PATH


def write_bootstrap_pth(site_packages_dir: Path) -> Path:
    pth_path = site_packages_dir.joinpath(PTH_FILE_NAME)
    pth_path.write_text(
        f"import sys; sys.path.insert(0, r\"{LOCAL_DIFFUSERS_SRC_ROOT}\")\n",
        encoding="utf-8",
    )
    return pth_path


def main() -> None:
    if not LOCAL_DIFFUSERS_SRC_ROOT.exists():
        raise RuntimeError(
            "Local diffusers source tree not found. Expected extracted source under "
            f"{LOCAL_DIFFUSERS_SRC_ROOT}"
        )

    patched_file = patch_qwen_pipeline_file()
    site_packages_dir = resolve_site_packages_dir()
    pth_path = write_bootstrap_pth(site_packages_dir)

    print(
        {
            "status": "prepared",
            "python": sys.executable,
            "diffusersSourceRoot": str(LOCAL_DIFFUSERS_SRC_ROOT),
            "patchedPipelineFile": str(patched_file),
            "bootstrapPth": str(pth_path),
        }
    )


if __name__ == "__main__":
    main()
