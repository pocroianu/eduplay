# @edu-play/ai-content

AI content tooling for educational Phaser games.

## Current Supported Surface

`ai-content` currently ships a generation-focused local workflow:

- ComfyUI is the default image path
- the configured ComfyUI workflow uses the local Qwen Image model stack
- deterministic local templates provide the short game text
- Piper is the audio provider
- the public CLI is limited to setup, health, model download, and single-game generation

## Image Routing

The image stack now talks directly to ComfyUI. The Docker ComfyUI service mounts the local ComfyUI Desktop model cache by default, so large Qwen/Z-Image model files do not need to be copied into this repo.

The preserved cli-anything batch tooling lives under `packages/ai-content/comfyui/`.

## CLI

```bash
edu-generate setup-services
edu-generate check-health
edu-generate download-models --piper
edu-generate generate --category animals --theme nature --questions 5
```

The package scripts in `package.json` are:

```bash
npm run build
npm run test:run
npm run generate -- generate --category animals --theme nature --questions 1
npm run benchmark:image:spike -- --subjects fox,elephant
npm run train:lora:spike -- --dataset ./training-data/datasets/image/train.jsonl --name animals-smoke
```

## Quick Start

### 1. Install and build

```bash
cd packages/ai-content
npm install
npm run build
```

### 2. Prepare local services

```bash
edu-generate setup-services
edu-generate check-health
edu-generate download-models --piper
```

### 3. Generate one game

```bash
edu-generate generate --category animals --theme nature --questions 1 --languages en
```

### 4. Generate with explicit image mode

```bash
edu-generate generate --category animals --theme nature --questions 1 --image-model base
edu-generate generate --category animals --theme nature --questions 1 --image-model lora --lora Qwen-Image-Lightning-8steps-V1.0.safetensors
```

## Configuration

The CLI loads `.ai-content.json` from the current working directory.

Example:

```json
{
  "mode": "self-hosted",
  "providers": {
    "text": {
      "provider": "template",
      "config": {}
    },
    "image": {
      "provider": "comfyui",
      "config": {
        "baseUrl": "http://localhost:8188",
        "workflowPath": "src/providers/image/workflows/qwen-duolingo.json",
        "timeout": 600000
      }
    },
    "audio": {
      "provider": "piper",
      "config": {
        "baseUrl": "http://localhost:5000",
        "voices": {
          "en": "en_US-lessac-medium",
          "ro": "ro_RO-mihai-medium"
        }
      }
    }
  },
  "cache": {
    "enabled": true,
    "redis": {
      "host": "localhost",
      "port": 6379
    }
  }
}
```

## Runtime Notes

- Docker ComfyUI mounts `${COMFYUI_MODELS_DIR:-C:/Users/pocro/Documents/ComfyUI/models}` at `/app/models` by default
- `packages/ai-content/comfyui/` contains the preserved cli-anything ComfyUI batch tooling
- `docs/qwen-image-spike.md` covers the standalone Qwen benchmark/spike flow
- generated metadata records the committed image provider in `generation-metadata.json`; generated asset references are written to versioned `assets.json`

## Experimental F5 Romanian TTS

Piper remains the default audio provider. The optional `f5-romanian` provider can be used to evaluate `cdorob/f5-tts-romanian` for Romanian output only.

From the repository root, prepare a short Romanian reference clip and exact transcript:

```powershell
cd packages/ai-content
mkdir .runtime/f5-romanian/reference
copy C:\path\to\reference.wav .runtime\f5-romanian\reference\reference.wav
$env:F5_REF_TEXT="textul exact din clipul de referinta"
```

From the repository root, start the optional service:

```bash
cd packages/ai-content/docker
docker compose --profile f5 up -d --build f5-romanian
```

Then opt in through `.ai-content.json`:

```json
{
  "mode": "self-hosted",
  "providers": {
    "text": {
      "provider": "template",
      "config": {}
    },
    "image": {
      "provider": "comfyui",
      "config": {
        "baseUrl": "http://localhost:8188",
        "workflowPath": "src/providers/image/workflows/qwen-duolingo.json",
        "timeout": 600000
      }
    },
    "audio": {
      "provider": "f5-romanian",
      "config": {
        "baseUrl": "http://localhost:5001",
        "timeout": 120000,
        "defaultVoice": "f5-ro-reference"
      }
    }
  },
  "cache": {
    "enabled": true,
    "redis": {
      "host": "localhost",
      "port": 6379
    }
  }
}
```
Generate Romanian-only content when this provider is selected:

```bash
cd packages/ai-content
npm run generate -- generate --category animals --theme nature --questions 1 --languages ro
```

The provider rejects non-Romanian requests. Keep Piper configured when generating English audio.

## Deferred Or Exploratory Surface

These code paths still exist, but they are not documented as supported user-facing workflows here:

- batch/workflow/metrics CLI flows
- legacy validation-pipeline CLI flows
- broad train/extract/build-dataset CLI docs from older recovery material
- phase-complete claims in archived `.spec/` planning docs
