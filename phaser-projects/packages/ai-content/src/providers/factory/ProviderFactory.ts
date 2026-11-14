/**
 * Provider factory for managing provider lifecycle
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { z } from 'zod';
import { BaseProvider } from '../base/BaseProvider';
import { ImageProviderBase } from '../image/ImageProvider';
import { TextProviderBase } from '../text/TextProvider';
import { AudioProviderBase } from '../audio/AudioProvider';
import { CacheManager } from '../cache/CacheManager';
import { RedisCacheAdapter } from '../cache/RedisCacheAdapter';
import { MemoryCacheAdapter } from '../cache/MemoryCacheAdapter';
import { MockImageProvider } from '../mocks/MockImageProvider';
import { MockTextProvider } from '../mocks/MockTextProvider';
import { MockAudioProvider } from '../mocks/MockAudioProvider';
import { ComfyUIProvider, type ComfyUIConfig } from '../image/ComfyUIProvider';
import { FallbackImageProvider } from '../image/FallbackImageProvider';
import { QwenImageProvider, type QwenImageConfig } from '../image/QwenImageProvider';
import { OllamaProvider, type OllamaConfig } from '../text/OllamaProvider';
import { TemplateTextProvider } from '../text/TemplateTextProvider';
import { PiperProvider, type PiperProviderConfig } from '../audio/PiperProvider';
import { F5RomanianProvider, type F5RomanianProviderConfig } from '../audio/F5RomanianProvider';

/**
 * Factory configuration schema
 */
const ProviderSelectionSchema = z.object({
  provider: z.string(),
  config: z.record(z.unknown())
});

const ImageProviderSelectionSchema = ProviderSelectionSchema.extend({
  fallback: ProviderSelectionSchema.optional()
});

export const FactoryConfigSchema = z.object({
  mode: z.enum(['self-hosted', 'hybrid', 'api']).default('self-hosted'),
  providers: z.object({
    text: ProviderSelectionSchema,
    image: ImageProviderSelectionSchema,
    audio: ProviderSelectionSchema
  }),
  cache: z.object({
    enabled: z.boolean().default(true),
    redis: z.object({
      host: z.string().default('localhost'),
      port: z.number().default(6379),
      password: z.string().optional(),
      db: z.number().optional()
    }).optional()
  })
});

export type FactoryConfig = z.infer<typeof FactoryConfigSchema>;

/**
 * Provider type discriminator
 */
export type ProviderType = 'image' | 'text' | 'audio';

/**
 * Provider registry entry
 */
interface ProviderRegistration {
  type: ProviderType;
  name: string;
  factory: (config: Record<string, unknown>) => BaseProvider;
}

/**
 * ProviderFactory manages provider lifecycle and instantiation.
 *
 * Features:
 * - Singleton pattern for providers
 * - Lazy initialization
 * - Graceful shutdown
 * - Provider registration for extensibility
 * - Configuration loading from .ai-content.json
 * - Environment-based provider selection (test vs production)
 *
 * Usage:
 * ```typescript
     * const config = ProviderFactory.loadConfig();
     * const factory = ProviderFactory.getInstance(config);
 * await factory.initialize();
 * const imageProvider = await factory.getImageProvider();
 * const result = await imageProvider.generate({...});
 * ```
 */
export class ProviderFactory {
  private static instance: ProviderFactory | undefined;

  private config: FactoryConfig;
  private providers: Map<string, BaseProvider> = new Map();
  private registry: Map<string, ProviderRegistration> = new Map();
  private cacheManager: CacheManager | null = null;
  private initialized: boolean = false;

  private constructor(config: FactoryConfig) {
    this.config = FactoryConfigSchema.parse(config);
    this.registerBuiltInProviders();
  }

  /**
   * Get factory instance (singleton).
   * Must be initialized with config on first call.
   */
  static getInstance(config?: FactoryConfig): ProviderFactory {
    if (!ProviderFactory.instance) {
      if (!config) {
        throw new Error('ProviderFactory must be initialized with config');
      }
      ProviderFactory.instance = new ProviderFactory(config);
    }
    return ProviderFactory.instance;
  }

  /**
   * Load configuration from .ai-content.json file.
   */
  static loadConfig(configPath?: string): FactoryConfig {
    const path = configPath || resolve(process.cwd(), '.ai-content.json');
    const content = readFileSync(path, 'utf-8');
    return FactoryConfigSchema.parse(JSON.parse(content));
  }

  /**
   * Reset factory (for testing).
   */
  static reset(): void {
    if (ProviderFactory.instance) {
      void ProviderFactory.instance.shutdown();
    }
    ProviderFactory.instance = undefined;
  }

  /**
   * Initialize factory and cache.
   * Providers are initialized lazily when first requested.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize cache
    if (this.config.cache.enabled) {
      await this.initCache();
    }

    this.initialized = true;
  }

  /**
   * Shutdown all providers and cache gracefully.
   */
  async shutdown(): Promise<void> {
    const shutdownPromises: Promise<void>[] = [];

    this.providers.forEach(provider => {
      shutdownPromises.push(provider.shutdown());
    });

    await Promise.all(shutdownPromises);
    this.providers.clear();

    if (this.cacheManager && this.config.cache.redis) {
      const adapter = (this.cacheManager as any).adapter;
      if (adapter instanceof RedisCacheAdapter) {
        await adapter.disconnect();
      }
    }

    this.initialized = false;
  }

  /**
   * Get image provider instance.
   */
  async getImageProvider(): Promise<ImageProviderBase> {
    const primaryConfig = this.config.providers.image;

    if (!primaryConfig.fallback) {
      return this.getOrCreateProvider(
        `image:primary:${primaryConfig.provider}`,
        `image:${primaryConfig.provider}`,
        primaryConfig.config
      ) as Promise<ImageProviderBase>;
    }

    const wrapperKey = `image:primary:${primaryConfig.provider}:fallback:${primaryConfig.fallback.provider}`;
    if (this.providers.has(wrapperKey)) {
      return this.providers.get(wrapperKey) as ImageProviderBase;
    }

    let primaryProvider: ImageProviderBase | null = null;
    let primaryError: Error | undefined;

    try {
      primaryProvider = await this.getOrCreateProvider(
        `image:primary:${primaryConfig.provider}`,
        `image:${primaryConfig.provider}`,
        primaryConfig.config
      ) as ImageProviderBase;
    } catch (error) {
      primaryError = error instanceof Error ? error : new Error(String(error));
    }

    let fallbackProvider: ImageProviderBase | null = null;
    let fallbackError: Error | undefined;

    try {
      fallbackProvider = await this.getOrCreateProvider(
        `image:fallback:${primaryConfig.fallback.provider}`,
        `image:${primaryConfig.fallback.provider}`,
        primaryConfig.fallback.config
      ) as ImageProviderBase;
    } catch (error) {
      fallbackError = error instanceof Error ? error : new Error(String(error));
    }

    if (!primaryProvider && !fallbackProvider) {
      throw fallbackError || primaryError || new Error('No image provider could be initialized');
    }

    const fallbackWrapper = new FallbackImageProvider(
      {
        name: `${primaryConfig.provider}-with-fallback`,
        primaryName: primaryConfig.provider,
        fallbackName: primaryConfig.fallback.provider,
        timeout: Math.max(
          Number((primaryConfig.config as Record<string, unknown>).timeout || 30000),
          Number((primaryConfig.fallback.config as Record<string, unknown>).timeout || 30000)
        )
      },
      primaryProvider,
      fallbackProvider,
      primaryError,
      fallbackError
    );
    await fallbackWrapper.init();
    this.providers.set(wrapperKey, fallbackWrapper);

    return fallbackWrapper;
  }

  /**
   * Get text provider instance.
   */
  async getTextProvider(): Promise<TextProviderBase> {
    return this.getOrCreateProvider(
      `text:${this.config.providers.text.provider}`,
      `text:${this.config.providers.text.provider}`,
      this.config.providers.text.config
    ) as Promise<TextProviderBase>;
  }

  /**
   * Get audio provider instance.
   */
  async getAudioProvider(): Promise<AudioProviderBase> {
    return this.getOrCreateProvider(
      `audio:${this.config.providers.audio.provider}`,
      `audio:${this.config.providers.audio.provider}`,
      this.config.providers.audio.config
    ) as Promise<AudioProviderBase>;
  }

  /**
   * Get cache manager (if enabled).
   */
  getCacheManager(): CacheManager | null {
    return this.cacheManager;
  }

  /**
   * Register a custom provider.
   * Useful for adding new provider implementations.
   */
  registerProvider(registration: ProviderRegistration): void {
    const key = `${registration.type}:${registration.name}`;
    this.registry.set(key, registration);
  }

  /**
   * Check health of all providers.
   * Returns health status and latency for each provider.
   */
  async healthCheck(): Promise<{
    image: { healthy: boolean; latency: number };
    text: { healthy: boolean; latency: number };
    audio: { healthy: boolean; latency: number };
    cache: { healthy: boolean };
  }> {
    const [imageProvider, textProvider, audioProvider] = await Promise.all([
      this.getImageProvider(),
      this.getTextProvider(),
      this.getAudioProvider()
    ]);

    const [imageHealth, textHealth, audioHealth] = await Promise.all([
      imageProvider.isHealthy(),
      textProvider.isHealthy(),
      audioProvider.isHealthy()
    ]);

    let cacheHealthy = true;
    if (this.cacheManager) {
      try {
        await this.cacheManager.has('health-check');
      } catch {
        cacheHealthy = false;
      }
    }

    return {
      image: { healthy: imageHealth.healthy, latency: imageHealth.latency },
      text: { healthy: textHealth.healthy, latency: textHealth.latency },
      audio: { healthy: audioHealth.healthy, latency: audioHealth.latency },
      cache: { healthy: cacheHealthy }
    };
  }

  // Private methods

  private async initCache(): Promise<void> {
    if (this.config.cache.redis) {
      const redisConfig = {
        host: this.config.cache.redis.host || 'localhost',
        port: this.config.cache.redis.port || 6379,
        password: this.config.cache.redis.password,
        db: this.config.cache.redis.db
      };
      const adapter = new RedisCacheAdapter(redisConfig);
      await adapter.connect();
      this.cacheManager = new CacheManager(adapter);
    } else {
      // Fallback to memory cache (useful for testing)
      this.cacheManager = new CacheManager(new MemoryCacheAdapter());
    }
  }

  private registerBuiltInProviders(): void {
    // Register mock providers
    this.registry.set('image:mock', {
      type: 'image',
      name: 'mock',
      factory: () => new MockImageProvider()
    });

    this.registry.set('text:mock', {
      type: 'text',
      name: 'mock',
      factory: () => new MockTextProvider()
    });

    this.registry.set('audio:mock', {
      type: 'audio',
      name: 'mock',
      factory: () => new MockAudioProvider()
    });

    this.registry.set('image:comfyui', {
      type: 'image',
      name: 'comfyui',
      factory: (config) => new ComfyUIProvider({
        name: 'comfyui',
        ...config
      } as ComfyUIConfig)
    });

    this.registry.set('image:qwen', {
      type: 'image',
      name: 'qwen',
      factory: (config) => new QwenImageProvider({
        name: 'qwen',
        baseUrl: 'http://localhost/qwen-runtime',
        ...config
      } as QwenImageConfig)
    });

    this.registry.set('text:ollama', {
      type: 'text',
      name: 'ollama',
      factory: (config) => new OllamaProvider({
        name: 'ollama',
        ...config
      } as Partial<OllamaConfig>)
    });

    this.registry.set('text:template', {
      type: 'text',
      name: 'template',
      factory: () => new TemplateTextProvider()
    });

    this.registry.set('audio:piper', {
      type: 'audio',
      name: 'piper',
      factory: (config) => new PiperProvider({
        name: 'piper',
        ...config
      } as PiperProviderConfig)
    });

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
  }

  private async getOrCreateProvider(
    cacheKey: string,
    registrationKey: string,
    providerConfig: Record<string, unknown>
  ): Promise<BaseProvider> {
    // Return cached provider if exists
    if (this.providers.has(cacheKey)) {
      return this.providers.get(cacheKey)!;
    }

    // Get registration
    const registration = this.registry.get(registrationKey);
    if (!registration) {
      throw new Error(`Unknown provider: ${registrationKey}`);
    }

    // Create and initialize provider
    const provider = registration.factory(providerConfig);
    await provider.init();

    // Cache provider
    this.providers.set(cacheKey, provider);

    return provider;
  }
}
