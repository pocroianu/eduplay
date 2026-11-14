# F5 Romanian TTS Optional Provider Design

## Goal

Add an opt-in Romanian F5-TTS audio provider to `packages/ai-content` so we can evaluate `cdorob/f5-tts-romanian` in the existing generation workflow without changing the current Piper default.

## Context

`packages/ai-content` currently routes audio through `IAudioProvider`, with `PiperProvider` registered as `audio:piper` in `ProviderFactory`. The checked-in `.ai-content.json` selects Piper at `http://localhost:5000`, and the Docker Compose stack builds a small Flask API around Piper with `/health`, `/voices`, and `/synthesize` endpoints.

The candidate model is `cdorob/f5-tts-romanian` on Hugging Face. It is a Romanian-only MIT-licensed F5-TTS checkpoint with `model_last.pt` and `vocab.txt`. F5-TTS inference requires a short reference audio clip and exact reference text, then generates speech for requested Romanian text.

## Decision

Implement F5 as a separate optional provider named `f5-romanian`. Do not replace Piper, do not change `.ai-content.json` defaults, and do not route English audio to F5.

This keeps the supported local workflow stable while giving us a real integration path for quality and performance comparison.

## Runtime Shape

Add a new Docker service for an F5 Romanian HTTP server. The server should mirror the Piper API shape where practical:

- `GET /health` returns service readiness and whether the model is loaded.
- `GET /voices` returns one Romanian voice entry for the configured reference voice.
- `POST /synthesize` accepts JSON with `text`, `language`, optional `voice`, `speed`, and `output_format`.

The service should load the F5 model once during process startup. It should use the Hugging Face checkpoint `cdorob/f5-tts-romanian` and the bundled `vocab.txt`. It should require configured reference assets:

- `F5_REF_AUDIO_PATH`
- `F5_REF_TEXT`

The service should reject non-Romanian requests with HTTP 400. It should return WAV audio only for the first integration pass, matching what the provider already normalizes as `audio/wav`.

## TypeScript Provider

Add `F5RomanianProvider` under `packages/ai-content/src/providers/audio/`. It should implement the existing `IAudioProvider` interface and follow `PiperProvider` conventions for:

- zod config validation
- request validation via `AudioRequestSchema`
- provider lifecycle and health checks
- request events and latency recording
- WAV header parsing for `sampleRate` and `duration`
- `generateBatch` behavior

Provider-specific behavior:

- `getSupportedLanguages()` returns `['ro']`.
- `getVoices('ro')` returns server-provided voices.
- `generate()` rejects any language other than `ro` before making an HTTP request.
- The default voice id is `f5-ro-reference` unless overridden by config.

Register the provider in `ProviderFactory` as `audio:f5-romanian`.

## Configuration

Keep the checked-in default config on Piper. Document opt-in usage like:

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

Docker Compose should expose F5 on `localhost:5001` to avoid colliding with Piper on `5000`.

## Error Handling

The server should return structured JSON errors for bad input, missing reference assets, missing model files, and inference failure. The TypeScript provider should translate HTTP failures into existing provider errors consistently with `PiperProvider`.

F5 inference is heavier than Piper. The provider timeout should be configurable and default higher than Piper's current audio path.

## Tests

Add focused tests without requiring real model inference:

- provider rejects non-Romanian requests locally
- provider calls `/synthesize` with Romanian language and selected voice
- provider parses successful WAV responses
- provider surfaces server errors
- `getVoices('ro')` uses `/voices`; `getVoices('en')` returns empty
- `ProviderFactory` creates `audio:f5-romanian`

Do not add mocked success paths that imply real model quality or performance was validated.

## Documentation

Update `packages/ai-content/README.md` and deployment notes to state:

- Piper remains the default supported audio provider.
- F5 Romanian is experimental and opt-in.
- F5 requires reference audio/text configuration.
- `download-models --piper` remains the default quick-start audio preparation; F5 model preparation is separate.

## Non-Goals

- No default cutover from Piper to F5.
- No English F5 support.
- No automatic voice cloning UI.
- No generated placeholder reference audio.
- No production deployment claim for the F5 service.
