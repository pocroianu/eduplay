"""Unit tests for ComfyUI CLI core modules."""
import os
import json
import pytest
from unittest.mock import patch, MagicMock


# ── Session Tests ──────────────────────────────────────────────


class TestSessionCreate:
    def test_creates_default_session(self, tmp_dir):
        from cli_anything.comfyui.core.session import Session
        s = Session(session_dir=tmp_dir)
        assert s.server_url == "http://localhost:8188"
        assert s.client_id  # auto-generated UUID
        assert s.last_prompt_ids == []
        assert s.history == []

    def test_persistent_client_id(self, tmp_dir):
        from cli_anything.comfyui.core.session import Session
        s1 = Session(session_dir=tmp_dir)
        s1.save()
        s2 = Session(session_dir=tmp_dir)
        assert s1.client_id == s2.client_id

    def test_custom_server_url(self, tmp_dir):
        from cli_anything.comfyui.core.session import Session
        s = Session(session_dir=tmp_dir, server_url="http://other:9999")
        assert s.server_url == "http://other:9999"


class TestSessionSaveLoad:
    def test_round_trip(self, tmp_dir):
        from cli_anything.comfyui.core.session import Session
        s1 = Session(session_dir=tmp_dir)
        s1.server_url = "http://custom:1234"
        s1.active_workflow_path = "/path/to/wf.json"
        s1.save()

        s2 = Session(session_dir=tmp_dir)
        assert s2.server_url == "http://custom:1234"
        assert s2.active_workflow_path == "/path/to/wf.json"
        assert s2.client_id == s1.client_id

    def test_corrupted_file_resets(self, tmp_dir):
        from cli_anything.comfyui.core.session import Session
        path = os.path.join(tmp_dir, "session.json")
        with open(path, "w") as f:
            f.write("not json")
        s = Session(session_dir=tmp_dir)
        assert s.server_url == "http://localhost:8188"


class TestSessionHistory:
    def test_record_action(self, tmp_dir):
        from cli_anything.comfyui.core.session import Session
        s = Session(session_dir=tmp_dir)
        s.record_prompt("abc-123", "generate_txt2img", {"prompt": "a cat"})
        assert len(s.last_prompt_ids) == 1
        assert s.last_prompt_ids[0] == "abc-123"
        assert len(s.history) == 1
        assert s.history[0]["prompt_id"] == "abc-123"
        assert s.history[0]["action"] == "generate_txt2img"

    def test_last_prompt_id(self, tmp_dir):
        from cli_anything.comfyui.core.session import Session
        s = Session(session_dir=tmp_dir)
        assert s.last_prompt_id is None
        s.record_prompt("first", "test", {})
        s.record_prompt("second", "test", {})
        assert s.last_prompt_id == "second"

    def test_history_max_entries(self, tmp_dir):
        from cli_anything.comfyui.core.session import Session
        s = Session(session_dir=tmp_dir)
        for i in range(150):
            s.record_prompt(f"id-{i}", "test", {})
        assert len(s.history) == 100  # capped at 100
        assert len(s.last_prompt_ids) == 20  # capped at 20


# ── WebSocket Client Tests ─────────────────────────────────────


class TestWsEventParsing:
    def test_parse_progress_event(self):
        from cli_anything.comfyui.utils.ws_client import parse_ws_event
        msg = json.dumps({
            "type": "progress",
            "data": {"value": 5, "max": 20, "prompt_id": "abc", "node": "3"}
        })
        event = parse_ws_event(msg)
        assert event["type"] == "progress"
        assert event["value"] == 5
        assert event["max"] == 20
        assert event["node"] == "3"

    def test_parse_executing_event(self):
        from cli_anything.comfyui.utils.ws_client import parse_ws_event
        msg = json.dumps({
            "type": "executing",
            "data": {"node": "5", "prompt_id": "abc"}
        })
        event = parse_ws_event(msg)
        assert event["type"] == "executing"
        assert event["node"] == "5"

    def test_parse_execution_success(self):
        from cli_anything.comfyui.utils.ws_client import parse_ws_event
        msg = json.dumps({
            "type": "execution_success",
            "data": {"prompt_id": "abc"}
        })
        event = parse_ws_event(msg)
        assert event["type"] == "execution_success"
        assert event["prompt_id"] == "abc"

    def test_parse_execution_error(self):
        from cli_anything.comfyui.utils.ws_client import parse_ws_event
        msg = json.dumps({
            "type": "execution_error",
            "data": {"prompt_id": "abc", "node_id": "3",
                     "exception_message": "CUDA out of memory"}
        })
        event = parse_ws_event(msg)
        assert event["type"] == "execution_error"
        assert "CUDA" in event["error"]

    def test_parse_status_event(self):
        from cli_anything.comfyui.utils.ws_client import parse_ws_event
        msg = json.dumps({
            "type": "status",
            "data": {"status": {"queue_remaining": 0}}
        })
        event = parse_ws_event(msg)
        assert event["type"] == "status"

    def test_parse_binary_message_returns_preview(self):
        from cli_anything.comfyui.utils.ws_client import parse_ws_event
        event = parse_ws_event(b"\x00\x00some binary data")
        assert event["type"] == "preview_image"

    def test_parse_invalid_json_returns_unknown(self):
        from cli_anything.comfyui.utils.ws_client import parse_ws_event
        event = parse_ws_event("not json")
        assert event["type"] == "unknown"


class TestWsProgressFormatter:
    def test_format_progress_bar(self):
        from cli_anything.comfyui.utils.ws_client import format_progress
        line = format_progress(10, 20, "KSampler")
        assert "10/20" in line
        assert "KSampler" in line

    def test_format_progress_zero(self):
        from cli_anything.comfyui.utils.ws_client import format_progress
        line = format_progress(0, 20, "")
        assert "0/20" in line

    def test_format_progress_complete(self):
        from cli_anything.comfyui.utils.ws_client import format_progress
        line = format_progress(20, 20, "")
        assert "20/20" in line


# ── Builder Tests ──────────────────────────────────────────────


class TestBuilderBasic:
    def test_empty_builder_raises(self):
        from cli_anything.comfyui.core.builder import WorkflowBuilder
        b = WorkflowBuilder()
        with pytest.raises(ValueError, match="No nodes"):
            b.build()

    def test_add_single_node(self):
        from cli_anything.comfyui.core.builder import WorkflowBuilder
        b = WorkflowBuilder()
        ref = b.add_node("CheckpointLoaderSimple", {"ckpt_name": "model.safetensors"})
        assert ref is not None
        assert len(b._nodes) == 1

    def test_node_auto_ids(self):
        from cli_anything.comfyui.core.builder import WorkflowBuilder
        b = WorkflowBuilder()
        r1 = b.add_node("A", {})
        r2 = b.add_node("B", {})
        assert r1.node_id != r2.node_id


class TestBuilderWiring:
    def test_output_reference(self):
        from cli_anything.comfyui.core.builder import WorkflowBuilder
        b = WorkflowBuilder()
        ckpt = b.add_node("CheckpointLoaderSimple", {"ckpt_name": "m.safetensors"})
        clip_ref = ckpt.output(1)
        assert clip_ref == [ckpt.node_id, 1]

    def test_connect_nodes(self):
        from cli_anything.comfyui.core.builder import WorkflowBuilder
        b = WorkflowBuilder()
        ckpt = b.add_node("CheckpointLoaderSimple", {"ckpt_name": "m.safetensors"})
        encode = b.add_node("CLIPTextEncode", {
            "text": "hello",
            "clip": ckpt.output(1),
        })
        wf = b.add_node("SaveImage", {"images": encode.output(0), "filename_prefix": "out"})
        result = b.build()
        node_ids = list(result.keys())
        assert len(node_ids) == 3
        encode_id = encode.node_id
        assert result[encode_id]["inputs"]["clip"] == [ckpt.node_id, 1]


class TestBuilderFluentAPI:
    def test_txt2img_fluent(self):
        from cli_anything.comfyui.core.builder import WorkflowBuilder
        b = WorkflowBuilder()
        ckpt = b.add_checkpoint("model.safetensors")
        pos = b.add_positive_prompt("a cat", clip=ckpt.output(1))
        neg = b.add_negative_prompt("blurry", clip=ckpt.output(1))
        latent = b.add_empty_latent(512, 512)
        sampler = b.add_ksampler(
            model=ckpt.output(0), positive=pos.output(0),
            negative=neg.output(0), latent_image=latent.output(0),
        )
        decoded = b.add_vae_decode(samples=sampler.output(0), vae=ckpt.output(2))
        b.add_save_image(images=decoded.output(0))
        wf = b.build()
        assert len(wf) == 7
        for node_id, node in wf.items():
            assert "class_type" in node
            assert "inputs" in node

    def test_defaults_for_ksampler(self):
        from cli_anything.comfyui.core.builder import WorkflowBuilder
        b = WorkflowBuilder()
        ckpt = b.add_checkpoint("m.safetensors")
        pos = b.add_positive_prompt("cat", clip=ckpt.output(1))
        neg = b.add_negative_prompt("bad", clip=ckpt.output(1))
        lat = b.add_empty_latent()
        ks = b.add_ksampler(
            model=ckpt.output(0), positive=pos.output(0),
            negative=neg.output(0), latent_image=lat.output(0),
        )
        dec = b.add_vae_decode(samples=ks.output(0), vae=ckpt.output(2))
        b.add_save_image(images=dec.output(0))
        wf = b.build()
        ks_node = wf[ks.node_id]
        assert ks_node["inputs"]["steps"] == 20
        assert ks_node["inputs"]["cfg"] == 7.0
        assert ks_node["inputs"]["sampler_name"] == "euler"
        assert ks_node["inputs"]["scheduler"] == "normal"
        assert ks_node["inputs"]["denoise"] == 1.0


class TestBuilderValidation:
    def test_no_output_node_raises(self):
        from cli_anything.comfyui.core.builder import WorkflowBuilder
        b = WorkflowBuilder()
        b.add_node("CheckpointLoaderSimple", {"ckpt_name": "m.safetensors"})
        with pytest.raises(ValueError, match="output node"):
            b.build()


# ── Template Tests ─────────────────────────────────────────────


class TestTxt2ImgTemplate:
    def test_basic_txt2img(self):
        from cli_anything.comfyui.core.templates import txt2img
        wf = txt2img(prompt="a cat", checkpoint="model.safetensors")
        assert isinstance(wf, dict)
        assert len(wf) >= 7
        class_types = [n["class_type"] for n in wf.values()]
        assert "SaveImage" in class_types
        assert "CheckpointLoaderSimple" in class_types
        assert "KSampler" in class_types

    def test_txt2img_custom_params(self):
        from cli_anything.comfyui.core.templates import txt2img
        wf = txt2img(
            prompt="a dog", negative="ugly", checkpoint="sdxl.safetensors",
            steps=30, cfg=8.0, width=1024, height=1024, seed=42,
        )
        ks = [n for n in wf.values() if n["class_type"] == "KSampler"][0]
        assert ks["inputs"]["steps"] == 30
        assert ks["inputs"]["cfg"] == 8.0
        assert ks["inputs"]["seed"] == 42

    def test_txt2img_default_negative(self):
        from cli_anything.comfyui.core.templates import txt2img
        wf = txt2img(prompt="cat", checkpoint="m.safetensors")
        clip_nodes = [n for n in wf.values() if n["class_type"] == "CLIPTextEncode"]
        assert len(clip_nodes) == 2


class TestImg2ImgTemplate:
    def test_basic_img2img(self):
        from cli_anything.comfyui.core.templates import img2img
        wf = img2img(prompt="oil painting", checkpoint="model.safetensors", input_image="input.png")
        class_types = [n["class_type"] for n in wf.values()]
        assert "LoadImage" in class_types
        assert "VAEEncode" in class_types
        assert "KSampler" in class_types
        assert "SaveImage" in class_types

    def test_img2img_denoise(self):
        from cli_anything.comfyui.core.templates import img2img
        wf = img2img(prompt="sketch", checkpoint="m.safetensors", input_image="in.png", denoise=0.6)
        ks = [n for n in wf.values() if n["class_type"] == "KSampler"][0]
        assert ks["inputs"]["denoise"] == 0.6


class TestUpscaleTemplate:
    def test_basic_upscale(self):
        from cli_anything.comfyui.core.templates import upscale
        wf = upscale(input_image="photo.png", upscale_model="RealESRGAN_x4plus.pth")
        class_types = [n["class_type"] for n in wf.values()]
        assert "LoadImage" in class_types
        assert "UpscaleModelLoader" in class_types
        assert "ImageUpscaleWithModel" in class_types
        assert "SaveImage" in class_types


# ── CLI Tests ──────────────────────────────────────────────────

from click.testing import CliRunner


class TestCLIHelp:
    def test_main_help(self):
        from cli_anything.comfyui.comfyui_cli import cli
        runner = CliRunner()
        result = runner.invoke(cli, ["--help"])
        assert result.exit_code == 0
        assert "ComfyUI CLI" in result.output

    def test_workflow_help(self):
        from cli_anything.comfyui.comfyui_cli import cli
        runner = CliRunner()
        result = runner.invoke(cli, ["workflow", "--help"])
        assert result.exit_code == 0

    def test_queue_help(self):
        from cli_anything.comfyui.comfyui_cli import cli
        runner = CliRunner()
        result = runner.invoke(cli, ["queue", "--help"])
        assert result.exit_code == 0

    def test_generate_help(self):
        from cli_anything.comfyui.comfyui_cli import cli
        runner = CliRunner()
        result = runner.invoke(cli, ["generate", "--help"])
        assert result.exit_code == 0
        assert "txt2img" in result.output

    def test_system_help(self):
        from cli_anything.comfyui.comfyui_cli import cli
        runner = CliRunner()
        result = runner.invoke(cli, ["system", "--help"])
        assert result.exit_code == 0
        assert "free" in result.output


class TestCLIWorkflow:
    def test_workflow_validate_json(self, sample_workflow_file):
        from cli_anything.comfyui.comfyui_cli import cli
        runner = CliRunner()
        result = runner.invoke(cli, ["--json", "workflow", "validate", sample_workflow_file])
        assert result.exit_code == 0
        data = json.loads(result.output)
        assert data["valid"] is True

    def test_workflow_list(self, tmp_dir, sample_workflow_file):
        from cli_anything.comfyui.comfyui_cli import cli
        runner = CliRunner()
        result = runner.invoke(cli, ["--json", "workflow", "list", tmp_dir])
        assert result.exit_code == 0
        data = json.loads(result.output)
        assert len(data) >= 1


class TestCLIModels:
    @patch("cli_anything.comfyui.core.models.api_get")
    def test_checkpoints_json(self, mock_get):
        mock_get.return_value = {
            "CheckpointLoaderSimple": {
                "input": {
                    "required": {
                        "ckpt_name": [["model_a.safetensors", "model_b.safetensors"]]
                    }
                }
            }
        }
        from cli_anything.comfyui.comfyui_cli import cli
        runner = CliRunner()
        result = runner.invoke(cli, ["--json", "models", "checkpoints"])
        assert result.exit_code == 0
        data = json.loads(result.output)
        assert "model_a.safetensors" in data


# ── Workflow Module Tests ──────────────────────────────────────


class TestWorkflowLoad:
    def test_load_valid(self, sample_workflow_file):
        from cli_anything.comfyui.core.workflows import load_workflow
        result = load_workflow(sample_workflow_file)
        assert isinstance(result, dict)
        assert "1" in result

    def test_load_missing_file(self):
        from cli_anything.comfyui.core.workflows import load_workflow
        with pytest.raises(RuntimeError, match="not found"):
            load_workflow("/nonexistent/file.json")

    def test_load_non_json(self, tmp_dir):
        from cli_anything.comfyui.core.workflows import load_workflow
        path = os.path.join(tmp_dir, "test.txt")
        with open(path, "w") as f:
            f.write("not json")
        with pytest.raises(RuntimeError):
            load_workflow(path)


class TestWorkflowValidate:
    def test_valid_workflow(self, sample_workflow):
        from cli_anything.comfyui.core.workflows import validate_workflow
        result = validate_workflow(sample_workflow)
        assert result["valid"] is True

    def test_empty_workflow(self):
        from cli_anything.comfyui.core.workflows import validate_workflow
        result = validate_workflow({})
        assert result["valid"] is True
        assert result["node_count"] == 0
        assert any("empty" in w.lower() for w in result["warnings"])

    def test_missing_class_type(self):
        from cli_anything.comfyui.core.workflows import validate_workflow
        result = validate_workflow({"1": {"inputs": {}}})
        assert result["valid"] is False
        assert len(result["errors"]) > 0


class TestWorkflowSave:
    def test_save_and_reload(self, tmp_dir, sample_workflow):
        from cli_anything.comfyui.core.workflows import save_workflow, load_workflow
        path = os.path.join(tmp_dir, "saved.json")
        save_workflow(sample_workflow, path)
        loaded = load_workflow(path)
        assert loaded == sample_workflow


# ── Queue Module Tests ─────────────────────────────────────────


class TestQueuePrompt:
    @patch("cli_anything.comfyui.core.queue.api_post")
    def test_queue_success(self, mock_post, sample_workflow):
        from cli_anything.comfyui.core.queue import queue_prompt
        mock_post.return_value = {
            "prompt_id": "test-id", "number": 1, "node_errors": {}
        }
        result = queue_prompt("http://localhost:8188", sample_workflow)
        assert result["prompt_id"] == "test-id"

    def test_queue_empty_workflow(self):
        from cli_anything.comfyui.core.queue import queue_prompt
        with pytest.raises(RuntimeError, match="empty"):
            queue_prompt("http://localhost:8188", {})


class TestQueueStatus:
    @patch("cli_anything.comfyui.core.queue.api_get")
    def test_status(self, mock_get):
        from cli_anything.comfyui.core.queue import get_queue_status
        mock_get.return_value = {"queue_running": [1], "queue_pending": [2, 3]}
        result = get_queue_status("http://localhost:8188")
        assert result["running_count"] == 1
        assert result["pending_count"] == 2


class TestQueueHistory:
    @patch("cli_anything.comfyui.core.queue.api_get")
    def test_history(self, mock_get):
        from cli_anything.comfyui.core.queue import get_history
        mock_get.return_value = {
            "id1": {
                "outputs": {"7": {"images": [{"filename": "out.png", "subfolder": "", "type": "output"}]}},
                "status": {"status_str": "success", "completed": True},
            }
        }
        result = get_history("http://localhost:8188")
        assert result["total"] == 1


# ── Models Module Tests ────────────────────────────────────────


class TestModelsCheckpoints:
    @patch("cli_anything.comfyui.core.models.api_get")
    def test_list_checkpoints(self, mock_get):
        from cli_anything.comfyui.core.models import list_checkpoints
        mock_get.return_value = {
            "CheckpointLoaderSimple": {
                "input": {"required": {"ckpt_name": [["a.safetensors", "b.safetensors"]]}}
            }
        }
        result = list_checkpoints("http://localhost:8188")
        assert "a.safetensors" in result
        assert "b.safetensors" in result


# ── Images Module Tests ────────────────────────────────────────


class TestImagesDownload:
    @patch("cli_anything.comfyui.core.images.api_get_raw")
    def test_download_image(self, mock_raw, tmp_dir):
        from cli_anything.comfyui.core.images import download_image
        mock_raw.return_value = b"\x89PNG\r\n\x1a\nfake png data"
        out_path = os.path.join(tmp_dir, "test.png")
        result = download_image("http://localhost:8188", "test.png", out_path)
        assert os.path.exists(out_path)
        assert result["size_bytes"] > 0

    @patch("cli_anything.comfyui.core.images.api_get_raw")
    def test_no_overwrite(self, mock_raw, tmp_dir):
        from cli_anything.comfyui.core.images import download_image
        out_path = os.path.join(tmp_dir, "existing.png")
        with open(out_path, "w") as f:
            f.write("existing")
        with pytest.raises(RuntimeError, match="exists"):
            download_image("http://localhost:8188", "test.png", out_path)


# ── Backend Tests ──────────────────────────────────────────────


class TestBackend:
    @patch("cli_anything.comfyui.utils.comfyui_backend.requests.get")
    def test_api_get(self, mock_get):
        from cli_anything.comfyui.utils.comfyui_backend import api_get
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.content = b'{"ok": true}'
        mock_resp.json.return_value = {"ok": True}
        mock_get.return_value = mock_resp
        result = api_get("http://localhost:8188", "/test")
        assert result["ok"] is True

    @patch("cli_anything.comfyui.utils.comfyui_backend.requests.get")
    def test_connection_error(self, mock_get):
        from cli_anything.comfyui.utils.comfyui_backend import api_get
        import requests as req
        mock_get.side_effect = req.exceptions.ConnectionError("refused")
        with pytest.raises(RuntimeError, match="Cannot connect"):
            api_get("http://localhost:8188", "/test")
