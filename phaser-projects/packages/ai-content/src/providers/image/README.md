# Image Providers

`ai-content` currently uses two image-provider roles:

- `QwenImageProvider` as the default image path
- `ComfyUIProvider` as the fallback path and LoRA path

## Batch Routing

Image-provider routing is intentionally handled in the provider layer so the committed output for one generated game stays consistent.

Current behavior:

- `QwenImageProvider.supportsRequest()` rejects requests with `lora`
- `FallbackImageProvider.generateBatch()` preflights the batch before generation
- unsupported batches are routed directly to the fallback provider
- retryable primary batch failures rerun the full batch on fallback
- non-retryable validation/content errors are surfaced instead of silently falling back

## Provider Detail Metadata

Fallback-wrapped image results may include `providerDetails` describing the route used:

- `primary-single`
- `primary-batch`
- `fallback-single-unsupported`
- `fallback-single-error`
- `fallback-batch-unsupported`
- `fallback-batch-error`

That information is propagated into generated asset metadata by `GameContentGenerator`.

## Qwen Provider

`QwenImageProvider` runs the package-local Python bridge:

- python runtime path: `.runtime/qwen-image/.venv/Scripts/python.exe`
- bridge script: `scripts/qwen-image-provider.py`
- validated default memory mode: `sequential-offload`

Qwen base is the preferred provider for supported non-LoRA image batches.

## ComfyUI Provider

`ComfyUIProvider` remains important for two reasons:

- it is the fallback safety net when Qwen has a retryable runtime/provider failure
- it is the expected route for LoRA-backed image requests

## Testing Expectations

The touched unit coverage should keep protecting:

- preflight routing for unsupported LoRA requests
- retryable batch reruns on fallback
- non-retryable errors surfacing cleanly
- provider metadata staying consistent for committed output
