"""Pytest bootstrap: put comfyui/ on sys.path and stub the heavy external
dependencies that our modules import at import time.

Key rules:
  - Stub cli_anything.* unconditionally (not installed in the test venv).
  - Let real numpy / PIL / rembg / postprocess / audit_green_subjects load —
    they ARE installed in the qwen-image venv. Mutating their public API
    (as earlier revisions did) breaks cross-module tests.
"""
import sys
import types
from pathlib import Path
from unittest.mock import MagicMock

COMFYUI_ROOT = Path(__file__).resolve().parent.parent
if str(COMFYUI_ROOT) not in sys.path:
    sys.path.insert(0, str(COMFYUI_ROOT))


def _stub(name: str) -> types.ModuleType:
    """Insert a blank stub module in sys.modules if one is not already there."""
    mod = types.ModuleType(name)
    sys.modules.setdefault(name, mod)
    return sys.modules[name]


# ---------------------------------------------------------------------------
# Stub cli_anything (the agent-harness CLI package). It lives outside the
# venv's site-packages and is only needed at runtime when the real batch
# script is talking to a live ComfyUI server.
# ---------------------------------------------------------------------------
for _name in [
    "cli_anything",
    "cli_anything.comfyui",
    "cli_anything.comfyui.core",
    "cli_anything.comfyui.core.queue",
    "cli_anything.comfyui.core.images",
]:
    _stub(_name)

sys.modules["cli_anything.comfyui.core.queue"].queue_prompt = MagicMock()
sys.modules["cli_anything.comfyui.core.queue"].get_prompt_history = MagicMock()
sys.modules["cli_anything.comfyui.core.images"].download_prompt_images = MagicMock()


# ---------------------------------------------------------------------------
# Eagerly import the real heavy dependencies. This guarantees they are in
# sys.modules before any individual test file runs, so that no later module
# can replace them with a stub via sys.modules.setdefault.
# ---------------------------------------------------------------------------
import numpy  # noqa: F401,E402
import PIL  # noqa: F401,E402
import PIL.Image  # noqa: F401,E402
import rembg  # noqa: F401,E402
import postprocess  # noqa: F401,E402
import audit_green_subjects  # noqa: F401,E402
