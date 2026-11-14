# Deployment Notes

`ai-content` is currently validated as a local self-hosted workstation workflow, not as a polished multi-service production deployment product.

## Supported Runtime Shape

The documented deployment target for the current package is:

- Windows workstation
- local NVIDIA GPU
- ComfyUI on `localhost:8188` using the checked-in Qwen workflow
- local deterministic text templates
- Piper for audio and optional Redis caching

Use the CLI as the source of truth:

```bash
edu-generate setup-services
edu-generate check-health
edu-generate download-models --piper
```

## Runtime Responsibilities

- ComfyUI handles image generation through the configured Qwen workflow
- deterministic templates handle short question/feedback text locally
- Piper handles audio generation
- Ollama remains optional only when `.ai-content.json` explicitly selects `providers.text.provider: "ollama"`

F5 Romanian TTS is an experimental opt-in audio provider. It is not part of the default supported runtime. When selected, it runs as the `f5-romanian` Docker Compose profile on `localhost:5001`, requires a user-supplied Romanian reference WAV plus exact transcript, and handles Romanian requests only.

## Operational Expectations

- ComfyUI image generation is slow with the current Qwen workflow; tune steps/LoRAs deliberately
- committed game output should record the image provider in `generation-metadata.json`
- generated asset references should be written to versioned `assets.json`

## Configuration

Use `.ai-content.json` in the working directory.

Important live keys:

- `providers.image.provider`
- `providers.image.config`
- `providers.image.fallback`
- `providers.text.provider`
- `providers.audio.provider`
- `cache.enabled`

The docs in this folder assume the checked-in config shape, not the older `type/url` recovery examples.

## Smoke And Recovery Workflow

For deployment validation on the current workstation:

1. Run `edu-generate check-health`
2. Run a one-question generation
3. Inspect `generation-metadata.json`
4. Confirm the committed image provider is a single value for the batch

This smoke workflow validates the default configured providers. To evaluate the experimental F5 audio provider, replace the `.ai-content.json` `providers.audio` block with the F5 example in `README.md` so it uses `baseUrl: "http://localhost:5001"`, start the `f5` Docker Compose profile, run a Romanian-only generation with `--languages ro`, and inspect the generated audio output.

If ComfyUI generation fails, inspect the workflow and mounted model cache before retrying.

## What Is Out Of Scope

This document does not claim support for:

- Kubernetes or hosted production orchestration
- a full Docker Compose production stack as a maintained public interface
- internet-exposed AI services
- stable docs for deferred batch/workflow/metrics CLI flows
- treating F5 Romanian TTS as the default audio path before quality and performance validation
