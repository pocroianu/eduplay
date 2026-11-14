---
name: "cli-anything-comfyui"
description: "CLI harness for ComfyUI AI image generation. Queue workflows, track progress, download results, and generate images using templates."
---

# cli-anything-comfyui

CLI interface for ComfyUI — manage AI image generation from the terminal or as an agent tool.

## Prerequisites

- ComfyUI server running (default: http://localhost:8188)
- At least one Stable Diffusion checkpoint model installed
- Python 3.10+

## Installation

```bash
pip install -e .
# Verify: cli-anything-comfyui --help
```

## Usage

### Quick Generation

```bash
# Text-to-image
cli-anything-comfyui generate txt2img \
  --prompt "a friendly cartoon cat" \
  --checkpoint sd_xl_base_1.0.safetensors \
  --output-dir ./output/

# Image-to-image
cli-anything-comfyui generate img2img \
  --prompt "oil painting style" \
  --checkpoint model.safetensors \
  --input-image photo.png \
  --denoise 0.7 \
  --output-dir ./output/

# Upscale
cli-anything-comfyui generate upscale \
  --input-image small.png \
  --output-dir ./output/
```

### Workflow Management

```bash
cli-anything-comfyui workflow list ./workflows/
cli-anything-comfyui workflow validate my_workflow.json
cli-anything-comfyui queue prompt -w my_workflow.json
cli-anything-comfyui queue watch <prompt-id>
```

### Model Discovery

```bash
cli-anything-comfyui models checkpoints
cli-anything-comfyui models loras
cli-anything-comfyui models node-info KSampler
```

### Image Retrieval

```bash
cli-anything-comfyui images list --prompt-id <id>
cli-anything-comfyui images download-all --prompt-id <id> -o ./output/
# Or use --last to use most recent prompt:
cli-anything-comfyui images download-all -o ./output/
```

### System

```bash
cli-anything-comfyui system stats    # GPU/VRAM info
cli-anything-comfyui system info     # Server + session state
cli-anything-comfyui system free     # Unload models, free VRAM
```

## Agent Usage (JSON Mode)

Add `--json` for machine-readable output:

```bash
cli-anything-comfyui --json generate txt2img -p "a cat" -c model.safetensors -o ./out/
cli-anything-comfyui --json models checkpoints
cli-anything-comfyui --json queue status
```

JSON mode outputs structured data on stdout. Errors return: `{"error": "message", "type": "ErrorType"}`.

During generation with `--json`, progress events are emitted as newline-delimited JSON:
```json
{"type": "progress", "value": 5, "max": 20, "node": "KSampler"}
{"type": "execution_success", "prompt_id": "abc-123"}
```

## Command Groups

| Group | Commands |
|-------|----------|
| `workflow` | list, load, validate, save |
| `queue` | prompt, status, clear, history, interrupt, watch |
| `models` | checkpoints, loras, vaes, controlnets, node-info, list-nodes |
| `images` | list, download, download-all |
| `generate` | txt2img, img2img, upscale |
| `system` | stats, info, free |

## Interactive REPL

Run without arguments for interactive mode:
```bash
cli-anything-comfyui
```
