# Qwen Image Spike

This document covers the standalone Qwen runtime scripts that are still useful for debugging, benchmarking, and workstation validation.

## How It Relates To The CLI

- the main `edu-generate` CLI uses Qwen base as the default image path
- ComfyUI is still configured as the fallback image path
- LoRA image requests are routed to ComfyUI before generation starts
- retryable Qwen batch failures rerun the full batch on ComfyUI so committed output stays provider-consistent

The spike scripts remain useful because they exercise the local Qwen runtime directly without going through the full game generator.

## Environment Setup

Use the package-local runtime:

```powershell
cd packages/ai-content
powershell -ExecutionPolicy Bypass -File scripts/setup-qwen-image-env.ps1
```

That setup prepares:

- `.runtime/qwen-image/.venv`
- CUDA-enabled torch for the validated workstation path
- patched local diffusers source usage for the Qwen runtime
- `.runtime/qwen-image/hf-home` for local model cache storage

## Dry Run

```powershell
cd packages/ai-content
.runtime/qwen-image/.venv/Scripts/python.exe scripts/qwen-image-spike.py
```

## Base-Model Execution

```powershell
cd packages/ai-content
.runtime/qwen-image/.venv/Scripts/python.exe scripts/qwen-image-spike.py --execute --subjects fox --steps 12 --width 512 --height 512 --device cuda --memory-mode sequential-offload --local-files-only --output-dir .runtime/qwen-image/output-base-devsrc-seq
```

## Lightning / LoRA Execution

These runs are still spike-only. They are useful for experimentation, but they are not the default production image path.

```powershell
cd packages/ai-content
.runtime/qwen-image/.venv/Scripts/python.exe scripts/qwen-image-spike.py --execute --subjects fox --steps 4 --width 512 --height 512 --device cuda --memory-mode model-offload --local-files-only --true-cfg-scale 1.0 --negative-prompt "" --lora-path .runtime/qwen-image/adapters/Qwen-Image-Lightning/Qwen-Image-Lightning-4steps-V1.0.safetensors --output-dir .runtime/qwen-image/output-lightning-debug
```

## Benchmark Harness

```powershell
cd packages/ai-content
npm run benchmark:image:spike -- --subjects fox,elephant
```

The benchmark writes timestamped output under `.runtime/image-benchmarks/` so Qwen base, Qwen Lightning, and the ComfyUI SDXL comparison path can be inspected side by side.

## Why The Spike Still Matters

- it validates the package-local Qwen runtime independently of the CLI
- it is the fastest way to compare memory modes on the workstation
- it helps explain whether a CLI fallback was caused by unsupported request shape or an actual Qwen runtime failure

## Expected CLI Routing After The Batch-Routing Fix

If you investigate CLI smoke outputs alongside spike results:

- Qwen-supported base batches should commit as `qwen`
- LoRA batches should commit as `comfyui (fallback)`
- retryable Qwen batch failures should also commit as `comfyui (fallback)`
- one committed game should not report mixed image providers anymore
