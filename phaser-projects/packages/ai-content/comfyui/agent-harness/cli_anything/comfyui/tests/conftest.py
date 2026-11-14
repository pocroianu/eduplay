"""Shared test fixtures for ComfyUI CLI tests."""
import os
import json
import pytest


@pytest.fixture
def tmp_dir(tmp_path):
    """Provide a temporary directory path as string."""
    return str(tmp_path)


@pytest.fixture
def sample_workflow():
    """A minimal valid ComfyUI workflow (API format)."""
    return {
        "1": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": "sd_xl_base_1.0.safetensors"}
        },
        "2": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": "a cat", "clip": ["1", 1]}
        },
        "3": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": "blurry", "clip": ["1", 1]}
        },
        "4": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": 512, "height": 512, "batch_size": 1}
        },
        "5": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0], "positive": ["2", 0], "negative": ["3", 0],
                "latent_image": ["4", 0], "seed": 42, "steps": 20, "cfg": 7.0,
                "sampler_name": "euler", "scheduler": "normal", "denoise": 1.0
            }
        },
        "6": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["5", 0], "vae": ["1", 2]}
        },
        "7": {
            "class_type": "SaveImage",
            "inputs": {"images": ["6", 0], "filename_prefix": "ComfyUI"}
        }
    }


@pytest.fixture
def sample_workflow_file(tmp_dir, sample_workflow):
    """Write sample workflow to a temp JSON file, return path."""
    path = os.path.join(tmp_dir, "test_workflow.json")
    with open(path, "w") as f:
        json.dump(sample_workflow, f)
    return path


BASE_URL = "http://localhost:8188"
