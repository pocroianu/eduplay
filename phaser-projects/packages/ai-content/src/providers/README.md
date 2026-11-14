# Provider Infrastructure

This directory contains the core provider infrastructure for AI content generation in the edu-play platform.

## Architecture

The provider system follows a layered architecture:

```
┌─────────────────────────────────────────┐
│         ProviderFactory                 │  ← Entry point
│  (Singleton, lifecycle management)      │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┴─────────┬─────────┐
        │                   │         │
┌───────▼─────┐  ┌─────────▼──────┐  ┌▼─────────┐
│ImageProvider│  │  TextProvider  │  │AudioProv │
│  (ComfyUI)  │  │  (Template)    │  │ (Piper)  │
└─────────────┘  └────────────────┘  └──────────┘
        │                   │               │
        └───────────┬───────┴───────────────┘
                    │
        ┌───────────▼────────────┐
        │    CacheManager        │
        │  (Redis/Memory)        │
        └────────────────────────┘
```

## Quick Start

### Basic Usage

```typescript
import { ProviderFactory } from './providers';

// Initialize factory with config
const config = ProviderFactory.loadConfig(); // Loads .ai-content.json
const factory = ProviderFactory.getInstance(config);
await factory.initialize();

// Get providers
const imageProvider = await factory.getImageProvider();
const textProvider = await factory.getTextProvider();
const audioProvider = await factory.getAudioProvider();

// Generate content
const image = await imageProvider.generate({
  prompt: 'A friendly cartoon apple',
  width: 512,
  height: 512,
  style: 'cartoon'
});

const text = await textProvider.generate({
  prompt: 'Write a question about fruits for children',
  maxTokens: 100
});

const audio = await audioProvider.generate({
  text: 'Which one is an apple?',
  language: 'en'
});

// Cleanup
await factory.shutdown();
```

### Testing with Mocks

```typescript
import { ProviderFactory, MockImageProvider } from './providers';

// Create test factory
const config = {
  mode: 'self-hosted',
  providers: {
    image: { provider: 'mock', config: {} },
    text: { provider: 'mock', config: {} },
    audio: { provider: 'mock', config: {} }
  },
  cache: { enabled: false }
};

const factory = ProviderFactory.getInstance(config);
await factory.initialize();

// Use mock providers
const imageProvider = await factory.getImageProvider();
const result = await imageProvider.generate({
  prompt: 'test',
  width: 512,
  height: 512
});

expect(result.data.width).toBe(512);
```

## Directory Structure

```
providers/
├── index.ts                    # Public API exports
├── base/
│   ├── BaseProvider.ts         # Abstract provider base class
│   ├── types.ts               # Common types
│   └── errors.ts              # Error hierarchy
├── image/
│   ├── ImageProvider.ts       # Image provider interface
│   └── ComfyUIProvider.ts     # ComfyUI implementation
├── text/
│   ├── TextProvider.ts        # Text provider interface
│   ├── TemplateTextProvider.ts # deterministic local text implementation
│   └── OllamaProvider.ts      # optional Ollama implementation
├── audio/
│   ├── AudioProvider.ts       # Audio provider interface
│   └── PiperProvider.ts       # Piper implementation
├── cache/
│   ├── CacheManager.ts        # Cache orchestration
│   ├── RedisCacheAdapter.ts   # Redis adapter
│   └── MemoryCacheAdapter.ts  # Memory adapter (testing)
├── factory/
│   └── ProviderFactory.ts     # Provider lifecycle manager
├── utils/
│   ├── retry.ts              # Retry with backoff
│   └── timeout.ts            # Timeout handling
└── mocks/
    ├── MockImageProvider.ts   # Mock image provider
    ├── MockTextProvider.ts    # Mock text provider
    └── MockAudioProvider.ts   # Mock audio provider
```

## Key Concepts

### Provider Lifecycle

All providers follow a consistent lifecycle:

1. **Construction**: Provider is created with configuration
2. **Initialization** (`init()`): Provider connects to service, validates config
3. **Ready**: Provider accepts generation requests
4. **Shutdown** (`shutdown()`): Provider closes connections gracefully

```typescript
const provider = new SomeProvider(config);
await provider.init();        // Connect to service
// ... use provider ...
await provider.shutdown();    // Cleanup
```

### State Management

Providers are **stateless after initialization**:
- Configuration is immutable
- No request-specific state is stored
- Safe for concurrent requests
- Can be reused across multiple requests

### Error Handling

All errors inherit from `ProviderError`:

```typescript
try {
  await provider.generate(request);
} catch (error) {
  if (error instanceof ProviderUnavailableError) {
    // Service is down, retry later
  } else if (error instanceof ProviderTimeoutError) {
    // Request took too long
  } else if (error instanceof ProviderValidationError) {
    // Invalid request parameters
  }
}
```

Retryable errors:
- `ProviderUnavailableError` - Service unreachable
- `ProviderTimeoutError` - Request timeout
- `ProviderRateLimitError` - Rate limit exceeded

Non-retryable errors:
- `ProviderValidationError` - Bad request
- `ContentRejectedError` - Content filter
- `ModelNotFoundError` - Model not loaded

### Caching

The cache system is transparent to providers:

```typescript
// Cache is managed by factory
const factory = ProviderFactory.getInstance(config);
const cacheManager = factory.getCacheManager();

// Generate cache key
const key = cacheManager.generateKey('comfyui', 'image', request);

// Check cache
const cached = await cacheManager.get(key);
if (cached) {
  return cached;
}

// Generate and cache
const result = await provider.generate(request);
await cacheManager.set(key, result.data, 'image');
```

Cache TTLs by content type:
- Images: 7 days
- Text: 1 day
- Audio: 7 days

### Health Checks

Providers implement health checks:

```typescript
const health = await provider.isHealthy();
console.log(health.healthy);   // true/false
console.log(health.latency);   // Response time in ms
console.log(health.message);   // Error message if unhealthy

// Factory-level health check
const status = await factory.healthCheck();
console.log(status.image.healthy);
console.log(status.text.latency);
console.log(status.cache.healthy);
```

### Metrics

Providers track metrics:

```typescript
const metrics = provider.getMetrics();
console.log(metrics.totalRequests);
console.log(metrics.successfulRequests);
console.log(metrics.averageLatency);
console.log(metrics.cacheHits);
```

## Configuration

Configuration is loaded from `.ai-content.json`:

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

## Extending

### Adding a New Provider

1. Extend the appropriate base class:

```typescript
import { ImageProviderBase } from './image/ImageProvider';

export class MyImageProvider extends ImageProviderBase {
  protected async _doInit(): Promise<void> {
    // Connect to your service
  }

  protected async _doHealthCheck() {
    // Check service health
    return { healthy: true };
  }

  protected async _doShutdown(): Promise<void> {
    // Cleanup
  }

  async generate(request: ImageRequest): Promise<GenerationResult<ImageData>> {
    // Implementation
  }

  // ... implement other methods
}
```

2. Register with factory:

```typescript
factory.registerProvider({
  type: 'image',
  name: 'my-provider',
  factory: (config) => new MyImageProvider(config)
});
```

3. Update config:

```json
{
  "providers": {
    "image": {
      "provider": "my-provider",
      "config": { ... }
    }
  }
}
```

## Testing

Use mock providers for testing:

```typescript
import { MockImageProvider, MockTextProvider, MockAudioProvider } from './providers/mocks';

// Create mock
const mockImage = new MockImageProvider();
mockImage.setResponse('test', mockImageData);
await mockImage.init();

// Use in tests
const result = await mockImage.generate({ prompt: 'test' });

// Verify calls
const calls = mockImage.getCalls();
expect(calls[0].prompt).toBe('test');

// Simulate failures
mockImage.setShouldFail(true);
await expect(mockImage.generate({ prompt: 'test' })).rejects.toThrow();
```

## Best Practices

1. **Always initialize before use**
   ```typescript
   await factory.initialize();
   ```

2. **Always shutdown gracefully**
   ```typescript
   await factory.shutdown();
   ```

3. **Use factory for provider access**
   ```typescript
   // ✓ Good
   const provider = await factory.getImageProvider();

   // ✗ Bad
   const provider = new ComfyUIProvider(config);
   ```

4. **Handle errors appropriately**
   ```typescript
   try {
     await provider.generate(request);
   } catch (error) {
     if (error.retryable) {
       // Retry logic
     } else {
       // Fatal error
     }
   }
   ```

5. **Use retry utilities for transient failures**
   ```typescript
   import { withRetry } from './providers/utils/retry';

   const result = await withRetry(
     () => provider.generate(request),
     { maxRetries: 3 }
   );
   ```

## Status

✅ **Implemented**
- BaseProvider infrastructure
- Provider interfaces (Image, Text, Audio)
- ProviderFactory with singleton pattern
- CacheManager with Redis and Memory adapters
- Error hierarchy
- Retry and timeout utilities
- Mock providers for testing

✅ **Current local default**
- ComfyUIProvider using the Qwen workflow
- TemplateTextProvider for deterministic short game text
- PiperProvider for local TTS

🧩 **Optional**
- OllamaProvider for configured self-hosted LLM text generation

🔮 **Future**
- API providers (OpenAI, Stability, ElevenLabs)
- Provider monitoring and metrics dashboard
- Hot-swapping providers at runtime
- Multi-region support
