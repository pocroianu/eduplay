import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageProviderBase, ImageRequest, ImageData } from '../../image/ImageProvider';
import { GenerationResult, BatchOptions, RequestMetadata } from '../../base/types';
import { HealthCheckResult } from '../../base/BaseProvider';
import { ProviderFactory, type FactoryConfig } from '../ProviderFactory';

const mockConfig: FactoryConfig = {
  mode: 'self-hosted',
  providers: {
    image: {
      provider: 'mock',
      config: {}
    },
    text: {
      provider: 'mock',
      config: {}
    },
    audio: {
      provider: 'mock',
      config: {}
    }
  },
  cache: {
    enabled: false
  }
};

describe('ProviderFactory', () => {
  beforeEach(() => {
    ProviderFactory.reset();
  });

  afterEach(async () => {
    const factory = ProviderFactory.getInstance(mockConfig);
    await factory.shutdown();
    ProviderFactory.reset();
  });

  it('creates and caches configured mock providers', async () => {
    const factory = ProviderFactory.getInstance(mockConfig);
    await factory.initialize();

    const [imageProvider, textProvider, audioProvider] = await Promise.all([
      factory.getImageProvider(),
      factory.getTextProvider(),
      factory.getAudioProvider()
    ]);

    expect(imageProvider.constructor.name).toBe('MockImageProvider');
    expect(textProvider.constructor.name).toBe('MockTextProvider');
    expect(audioProvider.constructor.name).toBe('MockAudioProvider');

    expect(await factory.getImageProvider()).toBe(imageProvider);
    expect(await factory.getTextProvider()).toBe(textProvider);
    expect(await factory.getAudioProvider()).toBe(audioProvider);
  });

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
      service: 'f5-romanian-tts',
      voices: [{ language: 'ro', voice: 'f5-ro-reference', description: 'F5 Romanian reference voice' }]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      const factory = ProviderFactory.getInstance(config);
      await factory.initialize();
      const audioProvider = await factory.getAudioProvider();

      expect(audioProvider.constructor.name).toBe('F5RomanianProvider');
      expect(audioProvider.getSupportedLanguages()).toEqual(['ro']);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('parses the new qwen image config with explicit fallback', () => {
    const config: FactoryConfig = {
      mode: 'self-hosted',
      providers: {
        image: {
          provider: 'qwen',
          config: {
            pythonPath: '.runtime/qwen-image/.venv/Scripts/python.exe'
          },
          fallback: {
            provider: 'comfyui',
            config: {
              baseUrl: 'http://localhost:8188'
            }
          }
        },
        text: {
          provider: 'mock',
          config: {}
        },
        audio: {
          provider: 'mock',
          config: {}
        }
      },
      cache: {
        enabled: false
      }
    };

    expect(() => ProviderFactory.getInstance(config)).not.toThrow();
  });

  it('falls back to the configured image provider when the primary init fails', async () => {
    const config: FactoryConfig = {
      mode: 'self-hosted',
      providers: {
        image: {
          provider: 'fail-init',
          config: {},
          fallback: {
            provider: 'mock',
            config: {}
          }
        },
        text: {
          provider: 'mock',
          config: {}
        },
        audio: {
          provider: 'mock',
          config: {}
        }
      },
      cache: {
        enabled: false
      }
    };

    const factory = ProviderFactory.getInstance(config);
    factory.registerProvider({
      type: 'image',
      name: 'fail-init',
      factory: () => new FailInitImageProvider()
    });
    await factory.initialize();

    const imageProvider = await factory.getImageProvider();
    const result = await imageProvider.generate({
      prompt: 'fox',
      width: 512,
      height: 512
    });

    expect(result.provider).toContain('fallback');
  });

  it('falls back to the configured image provider when the primary generate call fails', async () => {
    const config: FactoryConfig = {
      mode: 'self-hosted',
      providers: {
        image: {
          provider: 'fail-generate',
          config: {},
          fallback: {
            provider: 'mock',
            config: {}
          }
        },
        text: {
          provider: 'mock',
          config: {}
        },
        audio: {
          provider: 'mock',
          config: {}
        }
      },
      cache: {
        enabled: false
      }
    };

    const factory = ProviderFactory.getInstance(config);
    factory.registerProvider({
      type: 'image',
      name: 'fail-generate',
      factory: () => new FailGenerateImageProvider()
    });
    await factory.initialize();

    const imageProvider = await factory.getImageProvider();
    const result = await imageProvider.generate({
      prompt: 'fox',
      width: 512,
      height: 512
    });

    expect(result.provider).toContain('fallback');
  });

  it('routes unsupported image batches to the configured fallback provider', async () => {
    const config: FactoryConfig = {
      mode: 'self-hosted',
      providers: {
        image: {
          provider: 'unsupported-primary',
          config: {},
          fallback: {
            provider: 'mock',
            config: {}
          }
        },
        text: {
          provider: 'mock',
          config: {}
        },
        audio: {
          provider: 'mock',
          config: {}
        }
      },
      cache: {
        enabled: false
      }
    };

    const factory = ProviderFactory.getInstance(config);
    factory.registerProvider({
      type: 'image',
      name: 'unsupported-primary',
      factory: () => new UnsupportedPrimaryImageProvider()
    });
    await factory.initialize();

    const imageProvider = await factory.getImageProvider();
    const results = await imageProvider.generateBatch([
      {
        prompt: 'fox',
        width: 512,
        height: 512,
        lora: 'animals-lora.safetensors'
      }
    ]);

    expect(results[0].provider).toContain('fallback');
    expect(results[0].providerDetails).toMatchObject({
      route: 'fallback-batch-unsupported'
    });
  });
});

class FailInitImageProvider extends ImageProviderBase {
  constructor() {
    super({
      name: 'fail-init',
      baseUrl: 'http://localhost/fail-init',
      timeout: 5000,
      retries: 0,
      healthCheckInterval: 30000
    });
  }

  async generate(): Promise<GenerationResult<ImageData>> {
    throw new Error('not used');
  }

  async generateBatch(_requests: ImageRequest[], _options?: BatchOptions): Promise<GenerationResult<ImageData>[]> {
    throw new Error('not used');
  }

  getSupportedStyles(): string[] {
    return [];
  }

  async getAvailableLoras(): Promise<string[]> {
    return [];
  }

  protected async _doInit(): Promise<void> {
    throw new Error('init failed');
  }

  protected async _doHealthCheck(): Promise<Omit<HealthCheckResult, 'latency' | 'timestamp'>> {
    return { healthy: false };
  }

  protected async _doShutdown(): Promise<void> {}
}

class FailGenerateImageProvider extends ImageProviderBase {
  constructor() {
    super({
      name: 'fail-generate',
      baseUrl: 'http://localhost/fail-generate',
      timeout: 5000,
      retries: 0,
      healthCheckInterval: 30000
    });
  }

  async generate(
    _request: ImageRequest,
    metadata?: Partial<RequestMetadata>
  ): Promise<GenerationResult<ImageData>> {
    throw new Error(`generate failed for ${metadata?.requestId || 'request'}`);
  }

  async generateBatch(_requests: ImageRequest[], _options?: BatchOptions): Promise<GenerationResult<ImageData>[]> {
    throw new Error('not used');
  }

  getSupportedStyles(): string[] {
    return ['cartoon'];
  }

  async getAvailableLoras(): Promise<string[]> {
    return [];
  }

  protected async _doInit(): Promise<void> {}

  protected async _doHealthCheck(): Promise<Omit<HealthCheckResult, 'latency' | 'timestamp'>> {
    return { healthy: true };
  }

  protected async _doShutdown(): Promise<void> {}
}

class UnsupportedPrimaryImageProvider extends ImageProviderBase {
  constructor() {
    super({
      name: 'unsupported-primary',
      baseUrl: 'http://localhost/unsupported-primary',
      timeout: 5000,
      retries: 0,
      healthCheckInterval: 30000
    });
  }

  async generate(): Promise<GenerationResult<ImageData>> {
    throw new Error('not used');
  }

  async generateBatch(): Promise<GenerationResult<ImageData>[]> {
    throw new Error('not used');
  }

  getSupportedStyles(): string[] {
    return ['cartoon'];
  }

  async getAvailableLoras(): Promise<string[]> {
    return [];
  }

  supportsRequest(_request: ImageRequest) {
    return {
      supported: false,
      reason: 'LoRA requests are not supported by the primary provider.'
    };
  }

  protected async _doInit(): Promise<void> {}

  protected async _doHealthCheck(): Promise<Omit<HealthCheckResult, 'latency' | 'timestamp'>> {
    return { healthy: true };
  }

  protected async _doShutdown(): Promise<void> {}
}
