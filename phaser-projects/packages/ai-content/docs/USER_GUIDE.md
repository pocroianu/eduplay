# AI Content User Guide

This guide documents the workflows that are currently supported in `packages/ai-content`.

## What Is Supported

- local service preparation with `setup-services`
- service verification with `check-health`
- model/runtime preparation with `download-models`
- single-game generation with `generate`
- standalone Qwen benchmarking and local LoRA spike scripts for workstation validation

## Generation Model Selection

`edu-generate generate` supports two image modes:

- `base`: use Qwen base as the primary image provider
- `lora`: request a LoRA-backed image run

Routing behavior:

- base batches try Qwen first
- LoRA batches are routed directly to ComfyUI because Qwen base does not support LoRA selection in production mode
- retryable Qwen batch failures rerun the full committed batch on ComfyUI
- the saved output for one game should never mix Qwen and ComfyUI image assets

## Commands

### Prepare services

```bash
edu-generate setup-services
edu-generate setup-services --skip-models
edu-generate setup-services --gpu-check
```

### Verify health

```bash
edu-generate check-health
edu-generate check-health --verbose
```

### Download models

```bash
edu-generate download-models --all
edu-generate download-models --qwen
edu-generate download-models --preset children-books
```

### Generate a game

```bash
edu-generate generate --category animals --theme nature --questions 1 --languages en
edu-generate generate --category animals --theme nature --questions 1 --image-model base
edu-generate generate --category animals --theme nature --questions 1 --image-model lora --lora animals-bulk_20260327_143605.safetensors
```

Key options:

- `--category <type>`
- `--theme <name>`
- `--difficulty <easy|medium|hard>`
- `--questions <count>`
- `--languages <comma-separated>`
- `--image-model <base|lora>`
- `--lora <model>`
- `--output <path>`
- `--no-validate`

## Configuration

The generator reads `.ai-content.json` from the current working directory. The live config shape uses `provider` and `config` keys, plus an optional `fallback` block for the image provider.

The default local image config is:

- primary provider: `qwen`
- fallback provider: `comfyui`
- Qwen device: `cuda`
- Qwen memory mode: `sequential-offload`

## Runtime Files Worth Knowing

- `.runtime/qwen-image/` contains the local Qwen runtime, Hugging Face cache, and spike outputs
- `.runtime/smoke/` contains reproducible smoke artifacts
- generated game metadata includes the committed image provider and per-asset provider details

## Troubleshooting

### LoRA request unexpectedly uses ComfyUI

That is expected. Qwen base marks LoRA requests unsupported during preflight, so the full batch is routed to the fallback provider.

### Qwen batch falls back to ComfyUI

That means the primary Qwen batch failed with a retryable runtime/provider error. The full batch is rerun on ComfyUI to avoid mixed-provider committed output.

### Qwen runtime looks healthy but generation is slow

`sequential-offload` is the validated default for base-model stability on the current Windows workstation. It is slower than the ComfyUI SDXL path but more stable than full-GPU placement for Qwen base.

### Need to investigate image routing

Check:

- the generated `generation-metadata.json`
- the generated `asset-manifest.json`
- each image asset entry in the asset manifest metadata
- `.runtime/smoke/` or `.runtime/image-benchmarks/` outputs

## What This Guide Intentionally Does Not Promise

These older surfaces remain exploratory or deferred:

- full batch/workflow/metrics CLI docs
- generic `services:start` style npm scripts
- end-user train/extract/build-dataset CLI docs
- old recovery docs that described ComfyUI as the default production image path
