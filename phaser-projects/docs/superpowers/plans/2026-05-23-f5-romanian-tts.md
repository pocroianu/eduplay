# F5 Romanian TTS Optional Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in `f5-romanian` audio provider and local Docker HTTP service for evaluating `cdorob/f5-tts-romanian` without changing Piper defaults.

**Architecture:** Keep TypeScript generation code talking to an `IAudioProvider`; add `F5RomanianProvider` beside `PiperProvider` and register it in `ProviderFactory`. Add a separate Docker Compose profile service on port `5001` that exposes Piper-compatible `/health`, `/voices`, and `/synthesize` endpoints while loading the F5 Romanian checkpoint once at startup.

**Tech Stack:** TypeScript, Vitest, zod, Node fetch, Flask, Python `f5-tts`, Docker Compose, Hugging Face model files.

---

## File Structure

- Create `packages/ai-content/src/providers/audio/F5RomanianProvider.ts`
  - Owns the TypeScript HTTP adapter for the F5 Romanian service.
  - Mirrors `PiperProvider` lifecycle, errors, events, batching, and WAV metadata parsing.
- Create `packages/ai-content/src/providers/audio/__tests__/F5RomanianProvider.test.ts`
  - Unit tests the provider with stubbed `global.fetch`; no real model inference.
- Modify `packages/ai-content/src/providers/factory/ProviderFactory.ts`
  - Imports and registers `audio:f5-romanian`.
- Modify `packages/ai-content/src/providers/factory/__tests__/ProviderFactory.test.ts`
  - Verifies factory creates the F5 provider from config.
- Create `packages/ai-content/docker/f5-romanian/Dockerfile`
  - Builds the optional F5 HTTP service image.
- Create `packages/ai-content/docker/f5-romanian/f5-server.py`
  - Loads the F5 model and serves the three HTTP endpoints.
- Modify `packages/ai-content/docker/docker-compose.yml`
  - Adds `f5-romanian` service under profile `f5` on host port `5001`.
- Modify `packages/ai-content/README.md`
  - Documents opt-in config and startup command.
- Modify `packages/ai-content/docs/DEPLOYMENT.md`
  - Documents that F5 is experimental, local-only, and not part of the default supported runtime.

## Task 1: F5 Provider Unit Tests

**Files:**
- Create: `packages/ai-content/src/providers/audio/__tests__/F5RomanianProvider.test.ts`
- Later implementation: `packages/ai-content/src/providers/audio/F5RomanianProvider.ts`

- [ ] **Step 1: Write failing provider tests**

Create `packages/ai-content/src/providers/audio/__tests__/F5RomanianProvider.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { F5RomanianProvider } from '../F5RomanianProvider';
import { ProviderValidationError } from '../../base/errors';

function wavBuffer(sampleRate = 24000, channels = 1, dataBytes = 48000): Buffer {
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * 2, 28);
  buffer.writeUInt16LE(channels * 2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataBytes, 40);
  return buffer;
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init
  });
}

describe('F5RomanianProvider', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initializes from /voices and returns Romanian voice metadata', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      voices: [{ language: 'ro', voice: 'f5-ro-reference', description: 'F5 Romanian reference voice' }]
    }));

    const provider = new F5RomanianProvider({
      name: 'f5-romanian',
      baseUrl: 'http://localhost:5001',
      timeout: 120000,
      retries: 0,
      healthCheckInterval: 30000
    });

    await provider.init();

    expect(provider.getSupportedLanguages()).toEqual(['ro']);
    await expect(provider.getVoices('ro')).resolves.toEqual([
      { id: 'f5-ro-reference', name: 'F5 Romanian reference voice', gender: 'neutral' }
    ]);
    await expect(provider.getVoices('en')).resolves.toEqual([]);

    await provider.shutdown();
  });

  it('rejects non-Romanian generation before making an HTTP request', async () => {
    const provider = new F5RomanianProvider({
      name: 'f5-romanian',
      baseUrl: 'http://localhost:5001',
      timeout: 120000,
      retries: 0,
      healthCheckInterval: 30000
    });

    await expect(provider.generate({ text: 'Hello', language: 'en' })).rejects.toBeInstanceOf(ProviderValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts Romanian synthesis requests and parses WAV metadata', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        voices: [{ language: 'ro', voice: 'f5-ro-reference', description: 'F5 Romanian reference voice' }]
      }))
      .mockResolvedValueOnce(new Response(wavBuffer(), { status: 200, headers: { 'Content-Type': 'audio/wav' } }));

    const provider = new F5RomanianProvider({
      name: 'f5-romanian',
      baseUrl: 'http://localhost:5001',
      timeout: 120000,
      retries: 0,
      healthCheckInterval: 30000
    });
    await provider.init();

    const result = await provider.generate({
      text: 'Care este un măr?',
      language: 'ro',
      speed: 1.1,
      voice: 'f5-ro-reference',
      format: 'wav'
    });

    expect(fetchMock).toHaveBeenLastCalledWith('http://localhost:5001/synthesize', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Care este un măr?',
        language: 'ro',
        voice: 'f5-ro-reference',
        speed: 1.1,
        output_format: 'wav'
      })
    }));
    expect(result.data.mimeType).toBe('audio/wav');
    expect(result.data.sampleRate).toBe(24000);
    expect(result.data.duration).toBe(1);

    await provider.shutdown();
  });

  it('surfaces synthesis server errors as provider unavailable errors', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        voices: [{ language: 'ro', voice: 'f5-ro-reference', description: 'F5 Romanian reference voice' }]
      }))
      .mockResolvedValueOnce(jsonResponse({ error: 'F5 inference failed' }, { status: 500 }));

    const provider = new F5RomanianProvider({
      name: 'f5-romanian',
      baseUrl: 'http://localhost:5001',
      timeout: 120000,
      retries: 0,
      healthCheckInterval: 30000
    });
    await provider.init();

    await expect(provider.generate({ text: 'Salut', language: 'ro' })).rejects.toThrow(/F5 inference failed/);

    await provider.shutdown();
  });
});
```

- [ ] **Step 2: Run the provider test and verify it fails**

Run from `packages/ai-content`:

```bash
npm run test:run -- src/providers/audio/__tests__/F5RomanianProvider.test.ts
```

Expected: FAIL because `../F5RomanianProvider` does not exist.

- [ ] **Step 3: Commit the failing test**

```bash
git add packages/ai-content/src/providers/audio/__tests__/F5RomanianProvider.test.ts
git commit -m "test: cover F5 Romanian audio provider"
```

## Task 2: TypeScript F5 Provider

**Files:**
- Create: `packages/ai-content/src/providers/audio/F5RomanianProvider.ts`
- Test: `packages/ai-content/src/providers/audio/__tests__/F5RomanianProvider.test.ts`

- [ ] **Step 1: Implement `F5RomanianProvider`**

Create `packages/ai-content/src/providers/audio/F5RomanianProvider.ts`:

```ts
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { BaseProvider, BaseProviderConfigSchema, HealthCheckResult } from '../base/BaseProvider';
import { ProviderTimeoutError, ProviderUnavailableError, ProviderValidationError } from '../base/errors';
import { BatchOptions, GenerationResult, RequestMetadata } from '../base/types';
import { AudioData, AudioRequest, AudioRequestSchema, IAudioProvider, Language, VoiceInfo } from './AudioProvider';

const F5SupportedLanguages = ['ro'] as const;

export const F5RomanianProviderConfigSchema = BaseProviderConfigSchema.extend({
  defaultVoice: z.string().default('f5-ro-reference')
});

export type F5RomanianProviderConfig = z.infer<typeof F5RomanianProviderConfigSchema>;

interface F5Voice {
  language: string;
  voice: string;
  description: string;
  gender?: 'male' | 'female' | 'neutral';
}

export class F5RomanianProvider extends BaseProvider implements IAudioProvider {
  private readonly f5Config: F5RomanianProviderConfig;
  private availableVoices: VoiceInfo[] = [];

  constructor(config: F5RomanianProviderConfig) {
    super(config);
    this.f5Config = F5RomanianProviderConfigSchema.parse(config);
  }

  protected async _doInit(): Promise<void> {
    await this.fetchVoicesFromAPI();
  }

  protected async _doHealthCheck(): Promise<Omit<HealthCheckResult, 'latency' | 'timestamp'>> {
    try {
      const response = await this.fetchWithTimeout('/health', { method: 'GET' });
      const data = await response.json().catch(() => ({})) as { status?: string; modelLoaded?: boolean; error?: string };

      if (!response.ok) {
        return { healthy: false, message: data.error || `Health check failed with status: ${response.status}` };
      }

      return {
        healthy: data.modelLoaded !== false,
        message: data.status || 'Service healthy',
        details: { modelLoaded: data.modelLoaded, supportedLanguages: ['ro'] }
      };
    } catch (error) {
      return { healthy: false, message: error instanceof Error ? error.message : 'Health check failed' };
    }
  }

  protected async _doShutdown(): Promise<void> {
    this.availableVoices = [];
  }

  async generate(request: AudioRequest, metadata?: Partial<RequestMetadata>): Promise<GenerationResult<AudioData>> {
    const validatedRequest = AudioRequestSchema.parse(request);
    const requestId = metadata?.requestId || randomUUID();
    const startTime = Date.now();

    this.emit('request:start', { requestId, type: 'audio', request: validatedRequest });

    try {
      if (validatedRequest.language !== 'ro') {
        throw new ProviderValidationError(this.config.name, [`Unsupported language: ${validatedRequest.language}`]);
      }

      const audioData = await this.synthesize(validatedRequest);
      const latency = Date.now() - startTime;
      this.recordRequest(true, latency);

      const result: GenerationResult<AudioData> = {
        data: audioData,
        metadata: {
          requestId,
          gameId: metadata?.gameId,
          questionId: metadata?.questionId,
          timestamp: new Date()
        },
        cached: false,
        latency
      };

      this.emit('request:success', { requestId, latency });
      return result;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.recordRequest(false, latency);
      this.emit('request:error', { requestId, error, latency });
      throw error;
    }
  }

  async generateBatch(
    requests: AudioRequest[],
    options?: BatchOptions,
    metadata?: Partial<RequestMetadata>
  ): Promise<GenerationResult<AudioData>[]> {
    const { concurrency = 2, stopOnError = false, progressCallback } = options || {};
    const results: GenerationResult<AudioData>[] = [];
    let completed = 0;

    for (let i = 0; i < requests.length; i += concurrency) {
      const chunk = requests.slice(i, i + concurrency);
      const chunkPromises = chunk.map(async request => {
        const result = await this.generate(request, metadata);
        completed++;
        progressCallback?.(completed, requests.length);
        return result;
      });

      if (stopOnError) {
        results.push(...await Promise.all(chunkPromises));
      } else {
        const settled = await Promise.allSettled(chunkPromises);
        settled.forEach(result => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          }
        });
      }
    }

    return results;
  }

  async getVoices(language: Language): Promise<VoiceInfo[]> {
    if (language !== 'ro') {
      return [];
    }

    if (this.availableVoices.length === 0) {
      await this.fetchVoicesFromAPI();
    }

    return this.availableVoices;
  }

  getSupportedLanguages(): Language[] {
    return [...F5SupportedLanguages];
  }

  private async fetchVoicesFromAPI(): Promise<void> {
    try {
      const response = await this.fetchWithTimeout('/voices', { method: 'GET' });
      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.status}`);
      }

      const data = await response.json() as { voices: F5Voice[] };
      this.availableVoices = data.voices
        .filter(voice => voice.language === 'ro')
        .map(voice => ({
          id: voice.voice,
          name: voice.description,
          gender: voice.gender || 'neutral'
        }));
    } catch (error) {
      throw new ProviderUnavailableError(this.config.name, error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async synthesize(request: AudioRequest): Promise<AudioData> {
    try {
      const response = await this.fetchWithTimeout('/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: request.text,
          language: 'ro',
          voice: request.voice || this.f5Config.defaultVoice,
          speed: request.speed,
          output_format: 'wav'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(errorData.error || `Synthesis failed with status: ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const { sampleRate, duration } = this.parseWavHeader(buffer);

      return { buffer, mimeType: 'audio/wav', duration, sampleRate };
    } catch (error) {
      throw new ProviderUnavailableError(this.config.name, error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async fetchWithTimeout(path: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      return await fetch(`${this.config.baseUrl}${path}`, { ...options, signal: controller.signal });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ProviderTimeoutError(this.config.name, this.config.timeout);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private parseWavHeader(buffer: Buffer): { sampleRate: number; duration: number } {
    const defaultSampleRate = 24000;

    try {
      const sampleRate = buffer.readUInt32LE(24);
      const dataSize = buffer.readUInt32LE(40);
      const bytesPerSample = buffer.readUInt16LE(34) / 8;
      const channels = buffer.readUInt16LE(22);
      const duration = dataSize / (sampleRate * bytesPerSample * channels);
      return { sampleRate, duration: Math.max(0, duration) };
    } catch {
      return { sampleRate: defaultSampleRate, duration: 0 };
    }
  }
}
```

- [ ] **Step 2: Run the provider test and verify it passes**

Run from `packages/ai-content`:

```bash
npm run test:run -- src/providers/audio/__tests__/F5RomanianProvider.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run TypeScript compile for the package**

Run from `packages/ai-content`:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit provider implementation**

```bash
git add packages/ai-content/src/providers/audio/F5RomanianProvider.ts packages/ai-content/src/providers/audio/__tests__/F5RomanianProvider.test.ts
git commit -m "feat: add F5 Romanian audio provider"
```

## Task 3: Provider Factory Registration

**Files:**
- Modify: `packages/ai-content/src/providers/factory/ProviderFactory.ts`
- Modify: `packages/ai-content/src/providers/factory/__tests__/ProviderFactory.test.ts`
- Test: `packages/ai-content/src/providers/factory/__tests__/ProviderFactory.test.ts`

- [ ] **Step 1: Add failing factory test**

In `packages/ai-content/src/providers/factory/__tests__/ProviderFactory.test.ts`, add this test inside the existing `describe('ProviderFactory', () => { ... })` block:

```ts
  it('creates configured F5 Romanian audio providers', async () => {
    const config: FactoryConfig = {
      mode: 'self-hosted',
      providers: {
        image: { provider: 'mock', config: {} },
        text: { provider: 'mock', config: {} },
        audio: {
          provider: 'f5-romanian',
          config: {
            baseUrl: 'http://localhost:5001',
            timeout: 120000,
            retries: 0,
            healthCheckInterval: 30000
          }
        }
      },
      cache: { enabled: false }
    };

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      voices: [{ language: 'ro', voice: 'f5-ro-reference', description: 'F5 Romanian reference voice' }]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));
    vi.stubGlobal('fetch', fetchMock);

    const factory = ProviderFactory.getInstance(config);
    await factory.initialize();
    const audioProvider = await factory.getAudioProvider();

    expect(audioProvider.constructor.name).toBe('F5RomanianProvider');
    expect(audioProvider.getSupportedLanguages()).toEqual(['ro']);

    vi.unstubAllGlobals();
  });
```

Also change the first import line to include `vi`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
```

- [ ] **Step 2: Run factory test and verify it fails**

Run from `packages/ai-content`:

```bash
npm run test:run -- src/providers/factory/__tests__/ProviderFactory.test.ts
```

Expected: FAIL with `Unknown provider: audio:f5-romanian`.

- [ ] **Step 3: Register the provider**

In `packages/ai-content/src/providers/factory/ProviderFactory.ts`, add the import near the Piper import:

```ts
import { F5RomanianProvider, type F5RomanianProviderConfig } from '../audio/F5RomanianProvider';
```

Add this registration after the existing `audio:piper` registration:

```ts
    this.registry.set('audio:f5-romanian', {
      type: 'audio',
      name: 'f5-romanian',
      factory: (config) => new F5RomanianProvider({
        name: 'f5-romanian',
        baseUrl: 'http://localhost:5001',
        timeout: 120000,
        ...config
      } as F5RomanianProviderConfig)
    });
```

- [ ] **Step 4: Run factory test and verify it passes**

Run from `packages/ai-content`:

```bash
npm run test:run -- src/providers/factory/__tests__/ProviderFactory.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run affected tests together**

Run from `packages/ai-content`:

```bash
npm run test:run -- src/providers/audio/__tests__/F5RomanianProvider.test.ts src/providers/factory/__tests__/ProviderFactory.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit factory registration**

```bash
git add packages/ai-content/src/providers/factory/ProviderFactory.ts packages/ai-content/src/providers/factory/__tests__/ProviderFactory.test.ts
git commit -m "feat: register F5 Romanian audio provider"
```

## Task 4: F5 Docker HTTP Service

**Files:**
- Create: `packages/ai-content/docker/f5-romanian/Dockerfile`
- Create: `packages/ai-content/docker/f5-romanian/f5-server.py`
- Modify: `packages/ai-content/docker/docker-compose.yml`

- [ ] **Step 1: Add Dockerfile**

Create `packages/ai-content/docker/f5-romanian/Dockerfile`:

```Dockerfile
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/app/.cache/huggingface

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN pip install --no-cache-dir flask f5-tts huggingface_hub soundfile requests

RUN mkdir -p /app/models /app/reference

COPY f5-server.py /app/f5-server.py

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD python -c "import requests; r = requests.get('http://localhost:5001/health', timeout=5); raise SystemExit(0 if r.ok else 1)"

CMD ["python", "f5-server.py"]
```

- [ ] **Step 2: Add Flask server**

Create `packages/ai-content/docker/f5-romanian/f5-server.py`:

```python
from __future__ import annotations

import os
import tempfile
import threading
from pathlib import Path

import soundfile as sf
from flask import Flask, after_this_request, jsonify, request, send_file
from f5_tts.api import F5TTS
from huggingface_hub import snapshot_download

app = Flask(__name__)

MODEL_REPO = os.environ.get("F5_MODEL_REPO", "cdorob/f5-tts-romanian")
MODEL_DIR = Path(os.environ.get("F5_MODEL_DIR", "/app/models/f5-tts-romanian"))
REF_AUDIO_PATH = Path(os.environ.get("F5_REF_AUDIO_PATH", "/app/reference/reference.wav"))
REF_TEXT = os.environ.get("F5_REF_TEXT", "").strip()
VOICE_ID = os.environ.get("F5_VOICE_ID", "f5-ro-reference")
VOICE_DESCRIPTION = os.environ.get("F5_VOICE_DESCRIPTION", "F5 Romanian reference voice")

_model_lock = threading.Lock()
_model: F5TTS | None = None
_model_error: str | None = None


def _load_model() -> F5TTS:
    global _model, _model_error

    with _model_lock:
        if _model is not None:
            return _model

        try:
            snapshot_download(
                repo_id=MODEL_REPO,
                local_dir=str(MODEL_DIR),
                allow_patterns=["model_last.pt", "vocab.txt"],
            )
            ckpt_file = MODEL_DIR / "model_last.pt"
            vocab_file = MODEL_DIR / "vocab.txt"
            if not ckpt_file.exists() or not vocab_file.exists():
                raise FileNotFoundError("Expected model_last.pt and vocab.txt after Hugging Face download")

            _model = F5TTS(
                model="F5TTS_v1_Base",
                ckpt_file=str(ckpt_file),
                vocab_file=str(vocab_file),
            )
            _model_error = None
            return _model
        except Exception as exc:
            _model_error = str(exc)
            raise


def _reference_error() -> str | None:
    if not REF_AUDIO_PATH.exists():
        return f"Reference audio not found: {REF_AUDIO_PATH}"
    if not REF_TEXT:
        return "F5_REF_TEXT is required"
    return None


@app.route("/health", methods=["GET"])
def health():
    ref_error = _reference_error()
    if ref_error is not None:
        return jsonify({"status": "unhealthy", "modelLoaded": _model is not None, "error": ref_error}), 503

    try:
        _load_model()
    except Exception as exc:
        return jsonify({"status": "unhealthy", "modelLoaded": False, "error": str(exc)}), 503

    return jsonify({"status": "healthy", "service": "f5-romanian-tts", "modelLoaded": True}), 200


@app.route("/voices", methods=["GET"])
def voices():
    return jsonify({
        "voices": [{
            "language": "ro",
            "voice": VOICE_ID,
            "description": VOICE_DESCRIPTION,
            "gender": "neutral",
        }]
    }), 200


@app.route("/synthesize", methods=["POST"])
def synthesize():
    ref_error = _reference_error()
    if ref_error is not None:
        return jsonify({"error": ref_error}), 500

    data = request.get_json(silent=True) or {}
    text = str(data.get("text", "")).strip()
    language = data.get("language", "ro")
    speed = float(data.get("speed", 1.0))

    if not text:
        return jsonify({"error": "Text is required"}), 400
    if language != "ro":
        return jsonify({"error": f"Unsupported language: {language}"}), 400
    if speed < 0.5 or speed > 2.0:
        return jsonify({"error": "Speed must be between 0.5 and 2.0"}), 400

    output_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    output_path = output_file.name
    output_file.close()

    try:
        model = _load_model()
        wav, sr, _spec = model.infer(
            ref_file=str(REF_AUDIO_PATH),
            ref_text=REF_TEXT,
            gen_text=text,
            speed=speed,
            file_wave=None,
            seed=None,
        )
        sf.write(output_path, wav, sr)

        @after_this_request
        def cleanup(response):
            try:
                os.remove(output_path)
            except FileNotFoundError:
                pass
            return response

        return send_file(output_path, mimetype="audio/wav", as_attachment=True, download_name="speech_ro.wav")
    except Exception as exc:
        try:
            os.remove(output_path)
        except FileNotFoundError:
            pass
        return jsonify({"error": f"F5 inference failed: {exc}"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=False, threaded=False)
```

- [ ] **Step 3: Add Compose service under profile**

In `packages/ai-content/docker/docker-compose.yml`, add this service after the `piper` service and before `redis`:

```yaml
  # F5 Romanian TTS - Optional experimental Romanian voice provider
  f5-romanian:
    profiles:
      - f5
    build:
      context: ./f5-romanian
      dockerfile: Dockerfile
    container_name: edu-f5-romanian
    ports:
      - "5001:5001"
    volumes:
      - f5-romanian-models:/app/models
      - ../.runtime/f5-romanian/reference:/app/reference:ro
    environment:
      - NVIDIA_VISIBLE_DEVICES=all
      - F5_MODEL_REPO=cdorob/f5-tts-romanian
      - F5_MODEL_DIR=/app/models/f5-tts-romanian
      - F5_REF_AUDIO_PATH=/app/reference/reference.wav
      - F5_REF_TEXT=${F5_REF_TEXT:-}
      - F5_VOICE_ID=f5-ro-reference
      - F5_VOICE_DESCRIPTION=F5 Romanian reference voice
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    restart: unless-stopped
    networks:
      - ai-content-network
```

Add the volume name near existing volumes:

```yaml
  f5-romanian-models:
```

- [ ] **Step 4: Validate Compose config**

Run from `packages/ai-content/docker`:

```bash
docker compose --profile f5 config
```

Expected: PASS and output includes `edu-f5-romanian`.

- [ ] **Step 5: Commit Docker service**

```bash
git add packages/ai-content/docker/f5-romanian/Dockerfile packages/ai-content/docker/f5-romanian/f5-server.py packages/ai-content/docker/docker-compose.yml
git commit -m "feat: add optional F5 Romanian TTS service"
```

## Task 5: Documentation

**Files:**
- Modify: `packages/ai-content/README.md`
- Modify: `packages/ai-content/docs/DEPLOYMENT.md`
- Reference spec: `docs/superpowers/specs/2026-05-23-f5-romanian-tts-design.md`

- [ ] **Step 1: Update README current surface**

In `packages/ai-content/README.md`, keep the current Piper default language. Add a new section after `## Runtime Notes` using this exact content:

````md
## Experimental F5 Romanian TTS

Piper remains the default audio provider. The optional `f5-romanian` provider can be used to evaluate `cdorob/f5-tts-romanian` for Romanian output only.

Prepare a short Romanian reference clip and exact transcript:

```powershell
mkdir .runtime/f5-romanian/reference
copy C:\path\to\reference.wav .runtime\f5-romanian\reference\reference.wav
$env:F5_REF_TEXT="textul exact din clipul de referinta"
```

Start the optional service:

```bash
cd packages/ai-content/docker
docker compose --profile f5 up -d --build f5-romanian
```

Then opt in through `.ai-content.json`:

```json
"audio": {
  "provider": "f5-romanian",
  "config": {
    "baseUrl": "http://localhost:5001",
    "timeout": 120000,
    "defaultVoice": "f5-ro-reference"
  }
}
```

The provider rejects non-Romanian requests. Keep Piper configured when generating English audio.
````

- [ ] **Step 2: Update deployment notes**

In `packages/ai-content/docs/DEPLOYMENT.md`, add this under `## Runtime Responsibilities`:

```md
F5 Romanian TTS is an experimental opt-in audio provider. It is not part of the default supported runtime. When selected, it runs as the `f5-romanian` Docker Compose profile on `localhost:5001`, requires a user-supplied Romanian reference WAV plus exact transcript, and handles Romanian requests only.
```

Add this under `## What Is Out Of Scope`:

```md
- treating F5 Romanian TTS as the default audio path before quality and performance validation
```

- [ ] **Step 3: Verify documentation edits**

Use the repository read tool on these exact ranges after editing:

- `packages/ai-content/README.md`, from the inserted `## Experimental F5 Romanian TTS` heading through the following paragraph.
- `packages/ai-content/docs/DEPLOYMENT.md`, from `## Runtime Responsibilities` through the inserted F5 paragraph, and from `## What Is Out Of Scope` through the inserted bullet.

Expected: README has exactly one `Experimental F5 Romanian TTS` section and deployment notes state F5 is experimental.

- [ ] **Step 4: Commit docs**

```bash
git add packages/ai-content/README.md packages/ai-content/docs/DEPLOYMENT.md
git commit -m "docs: document optional F5 Romanian TTS"
```

## Task 6: Final Verification

**Files:**
- All files modified by Tasks 1-5.

- [ ] **Step 1: Run affected unit tests**

Run from `packages/ai-content`:

```bash
npm run test:run -- src/providers/audio/__tests__/F5RomanianProvider.test.ts src/providers/factory/__tests__/ProviderFactory.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run package build**

Run from `packages/ai-content`:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Validate Docker Compose shape**

Run from `packages/ai-content/docker`:

```bash
docker compose --profile f5 config
```

Expected: PASS and output contains `f5-romanian`, `5001:5001`, and `f5-romanian-models`.

- [ ] **Step 4: Verify default config is unchanged**

Read `packages/ai-content/.ai-content.json` and confirm:

```json
"audio": {
  "provider": "piper"
}
```

Expected: the checked-in default still selects Piper.

- [ ] **Step 5: Commit verification fixes when edits were made**

If verification required edits, commit the changed integration files with an explicit path list:

```bash
git add packages/ai-content/src/providers/audio/F5RomanianProvider.ts packages/ai-content/src/providers/audio/__tests__/F5RomanianProvider.test.ts packages/ai-content/src/providers/factory/ProviderFactory.ts packages/ai-content/src/providers/factory/__tests__/ProviderFactory.test.ts packages/ai-content/docker/f5-romanian/Dockerfile packages/ai-content/docker/f5-romanian/f5-server.py packages/ai-content/docker/docker-compose.yml packages/ai-content/README.md packages/ai-content/docs/DEPLOYMENT.md
git commit -m "fix: stabilize F5 Romanian TTS integration"
```
