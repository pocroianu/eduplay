# API Reference

Current API notes for the supported `@edu-play/ai-content` surface.

## Package Root

```typescript
import {
  GameContentGenerator,
  ImageContentGenerator,
  TextContentGenerator,
  AudioContentGenerator,
  ProviderFactory,
  PromptBuilder,
  QualityValidator,
  GenerationEvents
} from '@edu-play/ai-content';
```

## Provider Bootstrap

```typescript
const config = ProviderFactory.loadConfig();
const factory = ProviderFactory.getInstance(config);
await factory.initialize();

const imageProvider = await factory.getImageProvider();
const textProvider = await factory.getTextProvider();
const audioProvider = await factory.getAudioProvider();
```

## Image Provider Notes

`getImageProvider()` currently resolves to:

- `QwenImageProvider` when the primary runtime is available and the batch is supported
- `FallbackImageProvider` when an image fallback is configured in `.ai-content.json`

`ImageProviderBase` now supports preflight request checks:

```typescript
const support = imageProvider.supportsRequest({
  prompt: 'friendly cartoon fox',
  width: 512,
  height: 512,
  lora: 'animals-lora.safetensors'
});
```

For the default Qwen path, any request with `lora` is marked unsupported and should be expected to route to the fallback provider.

## Generation Results

Provider generation results may include:

```typescript
interface GenerationResult<T> {
  data: T;
  metadata: RequestMetadata;
  cached: boolean;
  latency: number;
  provider?: string;
  providerDetails?: Record<string, unknown>;
}
```

`providerDetails` is used by the fallback wrapper to annotate routes such as:

- `primary-single`
- `primary-batch`
- `fallback-single-error`
- `fallback-batch-unsupported`
- `fallback-batch-error`

## Minimal Orchestration Example

```typescript
const promptBuilder = new PromptBuilder();

const generator = new GameContentGenerator(
  new ImageContentGenerator(await factory.getImageProvider(), promptBuilder),
  new TextContentGenerator(await factory.getTextProvider(), promptBuilder),
  new AudioContentGenerator(await factory.getAudioProvider()),
  new QualityValidator()
);

const result = await generator.generate({
  category: 'animals',
  theme: 'nature',
  difficulty: 'easy',
  languages: ['en'],
  questionCount: 1,
  choicesPerQuestion: 3,
  validateBeforeCommit: true,
  retryOnFailure: true,
  maxRetries: 2,
  outputDir: './generated-games',
  gameId: 'animals-demo'
});
```

## Output Metadata

`GameContentGenerator` writes:

- package-level `providersUsed.image` for the committed image provider
- `asset-manifest.json` for saved asset metadata
- per-image asset metadata including:
  - `provider`
  - `providerDetails`
  - `subject`
  - dimensions

That metadata is the supported way to inspect whether a batch committed on Qwen or ComfyUI fallback.

## Common Package Exports

```typescript
import {
  Logger,
  ErrorHandler,
  CircuitBreaker,
  HealthCheck,
  PerformanceOptimizer,
  SecurityValidator
} from '@edu-play/ai-content/common';
```

## Supported CLI

```bash
edu-generate setup-services
edu-generate check-health
edu-generate download-models --all
edu-generate generate --category animals --theme nature --questions 1
```

## Not Covered Here

This reference intentionally does not document older exploratory surfaces such as:

- batch/workflow/metrics CLI commands
- generic validation-pipeline command docs
- training-data extraction or full LoRA user workflows as stable public APIs
