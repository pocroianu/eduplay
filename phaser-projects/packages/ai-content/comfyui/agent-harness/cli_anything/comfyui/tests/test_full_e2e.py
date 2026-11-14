"""End-to-end tests for ComfyUI CLI harness.

Tests organized in three tiers:
1. Intermediate file tests (no ComfyUI required)
2. True backend tests (requires running ComfyUI + checkpoint)
3. CLI subprocess tests (requires pip install -e .)
"""

import json
import os
import sys
import subprocess

import pytest

from cli_anything.comfyui.core.builder import WorkflowBuilder
from cli_anything.comfyui.core import templates as templates_mod
from cli_anything.comfyui.core import workflows as workflow_mod
from cli_anything.comfyui.core.session import Session


# ── Tier 1: Intermediate File Tests (no ComfyUI needed) ────────


class TestWorkflowRoundTrip:
    def test_builder_save_load(self, tmp_path):
        """Build workflow -> save -> load -> validate."""
        b = WorkflowBuilder()
        ckpt = b.add_checkpoint("model.safetensors")
        pos = b.add_positive_prompt("test", clip=ckpt.output(1))
        neg = b.add_negative_prompt("bad", clip=ckpt.output(1))
        lat = b.add_empty_latent()
        ks = b.add_ksampler(
            model=ckpt.output(0), positive=pos.output(0),
            negative=neg.output(0), latent_image=lat.output(0),
        )
        dec = b.add_vae_decode(samples=ks.output(0), vae=ckpt.output(2))
        b.add_save_image(images=dec.output(0))
        wf = b.build()

        path = str(tmp_path / "test.json")
        workflow_mod.save_workflow(wf, path)
        loaded = workflow_mod.load_workflow(path)
        assert loaded == wf

        validation = workflow_mod.validate_workflow(loaded)
        assert validation["valid"] is True

    def test_txt2img_template_valid(self, tmp_path):
        wf = templates_mod.txt2img(prompt="a cat", checkpoint="m.safetensors", seed=42)
        path = str(tmp_path / "txt2img.json")
        workflow_mod.save_workflow(wf, path)
        loaded = workflow_mod.load_workflow(path)
        result = workflow_mod.validate_workflow(loaded)
        assert result["valid"] is True
        assert result["node_count"] == 7

    def test_img2img_template_valid(self):
        wf = templates_mod.img2img(
            prompt="art", checkpoint="m.safetensors",
            input_image="in.png", seed=42,
        )
        result = workflow_mod.validate_workflow(wf)
        assert result["valid"] is True
        class_types = [n["class_type"] for n in wf.values()]
        assert "LoadImage" in class_types
        assert "VAEEncode" in class_types

    def test_upscale_template_valid(self):
        wf = templates_mod.upscale(input_image="in.png")
        result = workflow_mod.validate_workflow(wf)
        assert result["valid"] is True
        class_types = [n["class_type"] for n in wf.values()]
        assert "UpscaleModelLoader" in class_types


class TestSessionRoundTrip:
    def test_full_session_lifecycle(self, tmp_path):
        """Create -> record -> save -> reload -> verify."""
        s1 = Session(session_dir=str(tmp_path))
        s1.server_url = "http://custom:9999"
        s1.record_prompt("id-1", "txt2img", {"prompt": "cat"})
        s1.record_prompt("id-2", "img2img", {"prompt": "dog"})

        s2 = Session(session_dir=str(tmp_path))
        assert s2.server_url == "http://custom:9999"
        assert s2.last_prompt_id == "id-2"
        assert len(s2.history) == 2
        assert s2.client_id == s1.client_id


# ── Tier 2: True Backend Tests (requires ComfyUI running) ──────


class TestTrueBackend:
    """Tests that require a running ComfyUI server with at least one checkpoint.

    These tests FAIL (not skip) if ComfyUI isn't running — that's intentional.
    The CLI is useless without the server.
    """

    def test_system_stats(self):
        from cli_anything.comfyui.utils.comfyui_backend import api_get
        result = api_get("http://localhost:8188", "/system_stats")
        assert "system" in result or "devices" in result

    def test_list_checkpoints(self):
        from cli_anything.comfyui.core.models import list_checkpoints
        result = list_checkpoints("http://localhost:8188")
        assert isinstance(result, list)
        assert len(result) > 0, "No checkpoints found — install at least one model"

    def test_queue_status(self):
        from cli_anything.comfyui.core.queue import get_queue_status
        result = get_queue_status("http://localhost:8188")
        assert "running_count" in result
        assert "pending_count" in result

    def test_txt2img_generation(self, tmp_path):
        """Full txt2img: build -> queue -> wait -> download -> verify PNG."""
        from cli_anything.comfyui.core.models import list_checkpoints
        from cli_anything.comfyui.core.queue import queue_prompt
        from cli_anything.comfyui.core.images import download_prompt_images
        from cli_anything.comfyui.utils.ws_client import ProgressWatcher
        import uuid

        base = "http://localhost:8188"

        checkpoints = list_checkpoints(base)
        assert len(checkpoints) > 0
        ckpt = checkpoints[0]

        wf = templates_mod.txt2img(
            prompt="a simple red circle on white background",
            checkpoint=ckpt, steps=5, width=256, height=256, seed=42,
        )

        client_id = str(uuid.uuid4())
        result = queue_prompt(base, wf, client_id=client_id)
        prompt_id = result["prompt_id"]
        assert prompt_id

        watcher = ProgressWatcher(base, client_id, json_mode=False)
        try:
            watcher.start()
            watcher.wait_for_completion(prompt_id, timeout=120)
        finally:
            watcher.stop()

        out_dir = str(tmp_path / "output")
        os.makedirs(out_dir)
        downloaded = download_prompt_images(base, prompt_id, out_dir, overwrite=True)
        assert len(downloaded) > 0

        for img in downloaded:
            img_path = img["path"]
            assert os.path.exists(img_path)
            assert img.get("size_bytes", 0) > 0
            with open(img_path, "rb") as f:
                magic = f.read(8)
                assert magic[:4] == b"\x89PNG", f"Expected PNG, got {magic[:4]}"
            print(f"\n  PNG: {img_path} ({os.path.getsize(img_path):,} bytes)")


# ── Tier 3: CLI Subprocess Tests ───────────────────────────────


def _resolve_cli(name):
    """Resolve installed CLI command; falls back to python -m for dev."""
    import shutil
    force = os.environ.get("CLI_ANYTHING_FORCE_INSTALLED", "").strip() == "1"
    path = shutil.which(name)
    if path:
        print(f"[_resolve_cli] Using installed command: {path}")
        return [path]
    if force:
        raise RuntimeError(f"{name} not found in PATH. Install with: pip install -e .")
    module = "cli_anything.comfyui.comfyui_cli"
    print(f"[_resolve_cli] Falling back to: {sys.executable} -m {module}")
    return [sys.executable, "-m", module]


class TestCLISubprocess:
    CLI_BASE = _resolve_cli("cli-anything-comfyui")

    def _run(self, args, check=True):
        return subprocess.run(
            self.CLI_BASE + args,
            capture_output=True, text=True, check=check,
        )

    def test_help(self):
        result = self._run(["--help"])
        assert result.returncode == 0
        assert "ComfyUI CLI" in result.stdout

    def test_workflow_help(self):
        result = self._run(["workflow", "--help"])
        assert result.returncode == 0

    def test_generate_help(self):
        result = self._run(["generate", "--help"])
        assert result.returncode == 0
        assert "txt2img" in result.stdout

    def test_workflow_validate_json(self, tmp_path):
        """Create a workflow file, validate it via subprocess."""
        wf = templates_mod.txt2img(prompt="test", checkpoint="m.safetensors", seed=1)
        wf_path = str(tmp_path / "wf.json")
        with open(wf_path, "w") as f:
            json.dump(wf, f)
        result = self._run(["--json", "workflow", "validate", wf_path])
        assert result.returncode == 0
        data = json.loads(result.stdout)
        assert data["valid"] is True

    def test_system_stats_json(self):
        """Requires running ComfyUI — may fail in CI."""
        result = self._run(["--json", "system", "stats"], check=False)
        if result.returncode == 0:
            data = json.loads(result.stdout)
            assert "system" in data or "devices" in data
