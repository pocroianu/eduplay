# cli-anything-comfyui

CLI harness for ComfyUI — AI image generation from the command line.

## Prerequisites

- Python 3.10+
- ComfyUI running at http://localhost:8188 (or custom `--server` URL)
- At least one checkpoint model installed in ComfyUI

## Installation

```bash
cd packages/ai-content/comfyui/agent-harness
pip install -e .
```

## Quick Start

```bash
# Enter interactive REPL
cli-anything-comfyui

# List available models
cli-anything-comfyui models checkpoints

# Generate an image from text
cli-anything-comfyui generate txt2img -p "a friendly cat" -c sd_xl_base_1.0.safetensors -o ./output/

# Queue a custom workflow
cli-anything-comfyui queue prompt -w workflow.json

# Watch generation progress
cli-anything-comfyui queue watch <prompt-id>

# Download results
cli-anything-comfyui images download-all --prompt-id <id> --output-dir ./output/
```

## JSON Mode (for agents)

Add `--json` for machine-readable output:

```bash
cli-anything-comfyui --json models checkpoints
cli-anything-comfyui --json generate txt2img -p "a cat" -c model.safetensors -o ./out/
```

## Command Reference

| Command | Description |
|---------|-------------|
| `workflow list <dir>` | List workflow files |
| `workflow load <path>` | Display workflow details |
| `workflow validate <path>` | Validate workflow structure |
| `workflow save <path>` | Save template to file |
| `queue prompt -w <file>` | Queue workflow for generation |
| `queue status` | Show queue status |
| `queue history` | Show completed prompts |
| `queue interrupt` | Stop current generation |
| `queue clear` | Clear pending queue |
| `queue watch <id>` | Watch generation progress |
| `models checkpoints` | List checkpoint models |
| `models loras` | List LoRA models |
| `models vaes` | List VAE models |
| `models controlnets` | List ControlNet models |
| `models list-nodes` | List all node types |
| `models node-info <class>` | Show node schema |
| `images list` | List output images |
| `images download` | Download single image |
| `images download-all` | Download all images |
| `generate txt2img` | Text-to-image generation |
| `generate img2img` | Image-to-image generation |
| `generate upscale` | Upscale an image |
| `system stats` | GPU/memory stats |
| `system info` | Server + session info |
| `system free` | Unload models, free VRAM |

## Running Tests

```bash
pip install -e ".[dev]"

# Unit tests (no ComfyUI needed)
python -m pytest cli_anything/comfyui/tests/test_core.py -v

# E2E intermediate tests (no ComfyUI needed)
python -m pytest cli_anything/comfyui/tests/test_full_e2e.py -v -k "RoundTrip"

# Full E2E (requires running ComfyUI)
python -m pytest cli_anything/comfyui/tests/test_full_e2e.py -v -s
```
