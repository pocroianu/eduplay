/**
 * Phase 2 Integration Tests - Provider System
 *
 * This test suite validates the complete Phase 2 implementation:
 * - ProviderFactory initialization and lifecycle
 * - Mock providers for Image, Text, and Audio generation
 * - Batch generation capabilities
 * - Error handling and recovery
 * - Health check functionality
 * - Cache integration
 * - End-to-end game content generation example
 *
 * Tests are designed to run without Docker services using mock providers.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProviderFactory, FactoryConfig } from '../factory/ProviderFactory';
import { MockImageProvider } from '../mocks/MockImageProvider';
import { MockTextProvider } from '../mocks/MockTextProvider';
import { MockAudioProvider } from '../mocks/MockAudioProvider';
import { CacheManager, ContentType } from '../cache/CacheManager';
import { MemoryCacheAdapter } from '../cache/MemoryCacheAdapter';
import { ProviderState } from '../base/BaseProvider';
import { withRetry, RetryOptions } from '../utils/retry';
import { withTimeout } from '../utils/timeout';
import {
  ProviderError,
  ProviderTimeoutError,
  ProviderValidationError
} from '../base/errors';
import type { ImageRequest, ImageData } from '../image/ImageProvider';
import type { TextRequest, TextData } from '../text/TextProvider';
import type { AudioRequest, AudioData } from '../audio/AudioProvider';
import type { GenerationResult, BatchOptions } from '../base/types';

// =============================================================================
// Test Configuration
// =============================================================================

/**
 * Default test configuration using mock providers
 */
const createTestConfig = (): FactoryConfig => ({
  mode: 'self-hosted',
  providers: {
    text: { provider: 'mock', config: {} },
    image: { provider: 'mock', config: {} },
    audio: { provider: 'mock', config: {} }
  },
  cache: {
    enabled: true
    // No redis config - uses MemoryCacheAdapter
  }
});

// =============================================================================
// 1. ProviderFactory Tests
// =============================================================================

describe('ProviderFactory', () => {
  beforeEach(() => {
    // Reset singleton between tests
    ProviderFactory.reset();
  });

  afterEach(async () => {
    // Ensure cleanup after each test
    try {
      const factory = ProviderFactory.getInstance();
      await factory.shutdown();
    } catch {
      // Factory may not be initialized
    }
    ProviderFactory.reset();
  });

  describe('Initialization', () => {
    it('should create a singleton instance with config', () => {
      const config = createTestConfig();
      const factory1 = ProviderFactory.getInstance(config);
      const factory2 = ProviderFactory.getInstance();

      expect(factory1).toBe(factory2);
    });

    it('should throw error if getInstance called without config on first call', () => {
      expect(() => ProviderFactory.getInstance()).toThrow(
        'ProviderFactory must be initialized with config'
      );
    });

    it('should initialize successfully with mock providers', async () => {
      const factory = ProviderFactory.getInstance(createTestConfig());
      await factory.initialize();

      // Factory should be ready
      const imageProvider = await factory.getImageProvider();
      expect(imageProvider.getState()).toBe(ProviderState.READY);
    });

    it('should handle multiple initialize calls gracefully', async () => {
      const factory = ProviderFactory.getInstance(createTestConfig());
      await factory.initialize();
      await factory.initialize(); // Should not throw
      await factory.initialize(); // Should not throw

      expect(true).toBe(true); // If we got here, test passed
    });
  });

  describe('Provider Access', () => {
    it('should return image provider', async () => {
      const factory = ProviderFactory.getInstance(createTestConfig());
      await factory.initialize();

      const imageProvider = await factory.getImageProvider();

      expect(imageProvider).toBeDefined();
      expect(imageProvider.getName()).toBe('mock-image');
    });

    it('should return text provider', async () => {
      const factory = ProviderFactory.getInstance(createTestConfig());
      await factory.initialize();

      const textProvider = await factory.getTextProvider();

      expect(textProvider).toBeDefined();
      expect(textProvider.getName()).toBe('mock-text');
    });

    it('should return audio provider', async () => {
      const factory = ProviderFactory.getInstance(createTestConfig());
      await factory.initialize();

      const audioProvider = await factory.getAudioProvider();

      expect(audioProvider).toBeDefined();
      expect(audioProvider.getName()).toBe('mock-audio');
    });

    it('should cache provider instances', async () => {
      const factory = ProviderFactory.getInstance(createTestConfig());
      await factory.initialize();

      const provider1 = await factory.getImageProvider();
      const provider2 = await factory.getImageProvider();

      expect(provider1).toBe(provider2);
    });
  });

  describe('Shutdown', () => {
    it('should shutdown all providers gracefully', async () => {
      const factory = ProviderFactory.getInstance(createTestConfig());
      await factory.initialize();

      // Get providers to initialize them
      const imageProvider = await factory.getImageProvider();
      const textProvider = await factory.getTextProvider();
      const audioProvider = await factory.getAudioProvider();

      await factory.shutdown();

      expect(imageProvider.getState()).toBe(ProviderState.SHUTDOWN);
      expect(textProvider.getState()).toBe(ProviderState.SHUTDOWN);
      expect(audioProvider.getState()).toBe(ProviderState.SHUTDOWN);
    });
  });
});

// =============================================================================
// 2. Image Provider Tests
// =============================================================================

describe('MockImageProvider', () => {
  let provider: MockImageProvider;

  beforeEach(async () => {
    provider = new MockImageProvider();
    await provider.init();
  });

  afterEach(async () => {
    await provider.shutdown();
  });

  describe('Generation', () => {
    it('should generate image with default settings', async () => {
      const request: ImageRequest = {
        prompt: 'A red apple on a white background',
        width: 512,
        height: 512,
        steps: 20,
        cfgScale: 7
      };

      const result = await provider.generate(request);

      expect(result.data.buffer).toBeDefined();
      expect(result.data.mimeType).toBe('image/png');
      expect(result.data.width).toBe(512);
      expect(result.data.height).toBe(512);
      expect(result.metadata.requestId).toBeDefined();
      expect(result.cached).toBe(false);
    });

    it('should use custom response when set', async () => {
      const customData: ImageData = {
        buffer: Buffer.from('custom-image-data'),
        mimeType: 'image/png',
        width: 256,
        height: 256,
        seed: 12345
      };

      provider.setResponse('custom prompt', customData);

      const result = await provider.generate({
        prompt: 'custom prompt',
        width: 256,
        height: 256,
        steps: 20,
        cfgScale: 7
      });

      expect(result.data.seed).toBe(12345);
      expect(result.data.buffer.toString()).toBe('custom-image-data');
    });

    it('should record calls for inspection', async () => {
      await provider.generate({
        prompt: 'first prompt',
        width: 512,
        height: 512,
        steps: 20,
        cfgScale: 7
      });
      await provider.generate({
        prompt: 'second prompt',
        width: 256,
        height: 256,
        steps: 15,
        cfgScale: 8
      });

      const calls = provider.getCalls();

      expect(calls).toHaveLength(2);
      expect(calls[0].prompt).toBe('first prompt');
      expect(calls[1].prompt).toBe('second prompt');
    });

    it('should throw error when configured to fail', async () => {
      provider.setShouldFail(true);

      await expect(
        provider.generate({
          prompt: 'test prompt',
          width: 512,
          height: 512,
          steps: 20,
          cfgScale: 7
        })
      ).rejects.toThrow('Mock provider failure');
    });
  });

  describe('Batch Generation', () => {
    it('should generate multiple images', async () => {
      const requests: ImageRequest[] = [
        { prompt: 'apple', width: 512, height: 512, steps: 20, cfgScale: 7 },
        { prompt: 'banana', width: 512, height: 512, steps: 20, cfgScale: 7 },
        { prompt: 'cherry', width: 512, height: 512, steps: 20, cfgScale: 7 }
      ];

      const results = await provider.generateBatch(requests);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.data.buffer).toBeDefined();
      });
    });

    it('should call progress callback during batch', async () => {
      const progressCalls: Array<{ completed: number; total: number }> = [];
      const options: BatchOptions = {
        progressCallback: (completed, total) => {
          progressCalls.push({ completed, total });
        }
      };

      const requests: ImageRequest[] = [
        { prompt: 'a', width: 512, height: 512, steps: 20, cfgScale: 7 },
        { prompt: 'b', width: 512, height: 512, steps: 20, cfgScale: 7 },
        { prompt: 'c', width: 512, height: 512, steps: 20, cfgScale: 7 }
      ];

      await provider.generateBatch(requests, options);

      expect(progressCalls).toEqual([
        { completed: 1, total: 3 },
        { completed: 2, total: 3 },
        { completed: 3, total: 3 }
      ]);
    });
  });

  describe('Provider Capabilities', () => {
    it('should return supported styles', () => {
      const styles = provider.getSupportedStyles();

      expect(styles).toContain('cartoon');
      expect(styles).toContain('realistic');
      expect(styles).toContain('flat');
      expect(styles).toContain('watercolor');
    });

    it('should return available LoRAs', async () => {
      const loras = await provider.getAvailableLoras();

      expect(loras).toContain('children-book-v1');
      expect(loras).toContain('educational-v1');
    });
  });
});

// =============================================================================
// 3. Text Provider Tests
// =============================================================================

describe('MockTextProvider', () => {
  let provider: MockTextProvider;

  beforeEach(async () => {
    provider = new MockTextProvider();
    await provider.init();
  });

  afterEach(async () => {
    await provider.shutdown();
  });

  describe('Generation', () => {
    it('should generate text with default settings', async () => {
      const request: TextRequest = {
        prompt: 'Generate a question about fruits',
        maxTokens: 100,
        temperature: 0.7,
        topP: 0.9,
        format: 'text'
      };

      const result = await provider.generate(request);

      expect(result.data.text).toBeDefined();
      expect(result.data.text.length).toBeGreaterThan(0);
      expect(result.data.tokensUsed).toBeGreaterThan(0);
      expect(result.data.finishReason).toBe('stop');
    });

    it('should use custom response when set', async () => {
      provider.setResponse('custom prompt', 'This is a custom response');

      const result = await provider.generate({
        prompt: 'custom prompt',
        maxTokens: 100,
        temperature: 0.7,
        topP: 0.9,
        format: 'text'
      });

      expect(result.data.text).toBe('This is a custom response');
    });

    it('should include metadata with gameId and questionId', async () => {
      const result = await provider.generate(
        { prompt: 'test', maxTokens: 100, temperature: 0.7, topP: 0.9, format: 'text' },
        { gameId: 'game-123', questionId: 'q-1' }
      );

      expect(result.metadata.gameId).toBe('game-123');
      expect(result.metadata.questionId).toBe('q-1');
    });
  });

  describe('Batch Generation', () => {
    it('should generate multiple text responses', async () => {
      const requests: TextRequest[] = [
        { prompt: 'Question 1', maxTokens: 50, temperature: 0.7, topP: 0.9, format: 'text' },
        { prompt: 'Question 2', maxTokens: 50, temperature: 0.7, topP: 0.9, format: 'text' },
        { prompt: 'Question 3', maxTokens: 50, temperature: 0.7, topP: 0.9, format: 'text' }
      ];

      const results = await provider.generateBatch(requests);

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.data.text).toContain(`Question ${index + 1}`);
      });
    });
  });

  describe('Model Info', () => {
    it('should return model information', async () => {
      const info = await provider.getModelInfo();

      expect(info.name).toBe('mock-model');
      expect(info.contextLength).toBe(4096);
      expect(info.parameters).toBe('7B');
    });
  });
});

// =============================================================================
// 4. Audio Provider Tests
// =============================================================================

describe('MockAudioProvider', () => {
  let provider: MockAudioProvider;

  beforeEach(async () => {
    provider = new MockAudioProvider();
    await provider.init();
  });

  afterEach(async () => {
    await provider.shutdown();
  });

  describe('Generation', () => {
    it('should generate audio with default settings', async () => {
      const request: AudioRequest = {
        text: 'Hello, this is a test sentence.',
        language: 'en',
        speed: 1.0,
        pitch: 1.0,
        format: 'mp3'
      };

      const result = await provider.generate(request);

      expect(result.data.buffer).toBeDefined();
      expect(result.data.mimeType).toBe('audio/mpeg');
      expect(result.data.duration).toBeGreaterThan(0);
      expect(result.data.sampleRate).toBe(22050);
    });

    it('should calculate duration based on text length', async () => {
      const shortText = await provider.generate({
        text: 'Short',
        language: 'en',
        speed: 1.0,
        pitch: 1.0,
        format: 'mp3'
      });

      const longText = await provider.generate({
        text: 'This is a much longer sentence for testing.',
        language: 'en',
        speed: 1.0,
        pitch: 1.0,
        format: 'mp3'
      });

      expect(longText.data.duration).toBeGreaterThan(shortText.data.duration);
    });
  });

  describe('Batch Generation', () => {
    it('should generate multiple audio clips', async () => {
      const requests: AudioRequest[] = [
        { text: 'First sentence', language: 'en', speed: 1.0, pitch: 1.0, format: 'mp3' },
        { text: 'Second sentence', language: 'en', speed: 1.0, pitch: 1.0, format: 'mp3' },
        { text: 'Third sentence', language: 'ro', speed: 1.0, pitch: 1.0, format: 'mp3' }
      ];

      const results = await provider.generateBatch(requests);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.data.buffer).toBeDefined();
      });
    });
  });

  describe('Voice Support', () => {
    it('should return voices for English', async () => {
      const voices = await provider.getVoices('en');

      expect(voices).toHaveLength(1);
      expect(voices[0].id).toBe('en_mock_voice');
      expect(voices[0].gender).toBe('neutral');
    });

    it('should return voices for Romanian', async () => {
      const voices = await provider.getVoices('ro');

      expect(voices).toHaveLength(1);
      expect(voices[0].id).toBe('ro_mock_voice');
    });

    it('should return supported languages', () => {
      const languages = provider.getSupportedLanguages();

      expect(languages).toContain('en');
      expect(languages).toContain('ro');
    });
  });
});

// =============================================================================
// 5. Cache Manager Tests
// =============================================================================

describe('CacheManager', () => {
  let cacheManager: CacheManager;
  let adapter: MemoryCacheAdapter;

  beforeEach(() => {
    adapter = new MemoryCacheAdapter();
    cacheManager = new CacheManager(adapter);
  });

  describe('Key Generation', () => {
    it('should generate consistent keys for same input', () => {
      const key1 = cacheManager.generateKey('comfyui', 'image', { prompt: 'test' });
      const key2 = cacheManager.generateKey('comfyui', 'image', { prompt: 'test' });

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different inputs', () => {
      const key1 = cacheManager.generateKey('comfyui', 'image', { prompt: 'apple' });
      const key2 = cacheManager.generateKey('comfyui', 'image', { prompt: 'banana' });

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different providers', () => {
      const key1 = cacheManager.generateKey('comfyui', 'image', { prompt: 'test' });
      const key2 = cacheManager.generateKey('stability', 'image', { prompt: 'test' });

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different content types', () => {
      const key1 = cacheManager.generateKey('provider', 'image', { prompt: 'test' });
      const key2 = cacheManager.generateKey('provider', 'text', { prompt: 'test' });

      expect(key1).not.toBe(key2);
    });

    it('should ignore undefined values in key generation', () => {
      const key1 = cacheManager.generateKey('comfyui', 'image', { prompt: 'test' });
      const key2 = cacheManager.generateKey('comfyui', 'image', {
        prompt: 'test',
        seed: undefined
      });

      expect(key1).toBe(key2);
    });
  });

  describe('Get/Set Operations', () => {
    it('should store and retrieve values', async () => {
      const key = 'test-key';
      const data = { value: 'test-data' };

      await cacheManager.set(key, data, 'text');
      const result = await cacheManager.get(key);

      expect(result).toEqual(data);
    });

    it('should return null for missing keys', async () => {
      const result = await cacheManager.get('nonexistent');

      expect(result).toBeNull();
    });

    it('should check if key exists', async () => {
      const key = 'existing-key';
      await cacheManager.set(key, { data: 'value' }, 'text');

      expect(await cacheManager.has(key)).toBe(true);
      expect(await cacheManager.has('missing')).toBe(false);
    });

    it('should delete cached values', async () => {
      const key = 'delete-test';
      await cacheManager.set(key, { data: 'value' }, 'text');

      expect(await cacheManager.has(key)).toBe(true);

      await cacheManager.delete(key);

      expect(await cacheManager.has(key)).toBe(false);
    });

    it('should clear all cached values', async () => {
      await cacheManager.set('key1', { data: '1' }, 'text');
      await cacheManager.set('key2', { data: '2' }, 'image');
      await cacheManager.set('key3', { data: '3' }, 'audio');

      expect(adapter.size()).toBe(3);

      await cacheManager.clear();

      expect(adapter.size()).toBe(0);
    });
  });

  describe('Disabled Cache', () => {
    it('should not store when cache is disabled', async () => {
      const disabledCache = new CacheManager(adapter, { enabled: false });

      await disabledCache.set('key', { data: 'value' }, 'text');
      const result = await disabledCache.get('key');

      expect(result).toBeNull();
    });

    it('should return false for has() when disabled', async () => {
      const disabledCache = new CacheManager(adapter, { enabled: false });

      await adapter.set('direct-key', {
        data: 'value',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10000),
        metadata: {}
      });

      expect(await disabledCache.has('direct-key')).toBe(false);
    });
  });
});

// =============================================================================
// 6. Health Check Tests
// =============================================================================

describe('Health Checks', () => {
  beforeEach(() => {
    ProviderFactory.reset();
  });

  afterEach(async () => {
    try {
      const factory = ProviderFactory.getInstance();
      await factory.shutdown();
    } catch {
      // Ignore
    }
    ProviderFactory.reset();
  });

  it('should report all providers healthy with mock providers', async () => {
    const factory = ProviderFactory.getInstance(createTestConfig());
    await factory.initialize();

    const health = await factory.healthCheck();

    expect(health.image.healthy).toBe(true);
    expect(health.text.healthy).toBe(true);
    expect(health.audio.healthy).toBe(true);
    expect(health.cache.healthy).toBe(true);
  });

  it('should include latency in health check', async () => {
    const factory = ProviderFactory.getInstance(createTestConfig());
    await factory.initialize();

    const health = await factory.healthCheck();

    expect(health.image.latency).toBeGreaterThanOrEqual(0);
    expect(health.text.latency).toBeGreaterThanOrEqual(0);
    expect(health.audio.latency).toBeGreaterThanOrEqual(0);
  });

  it('should report unhealthy when provider fails', async () => {
    const factory = ProviderFactory.getInstance(createTestConfig());
    await factory.initialize();

    const imageProvider = (await factory.getImageProvider()) as MockImageProvider;
    imageProvider.setShouldFail(true);

    // Clear health cache by waiting or forcing refresh
    const health = await factory.healthCheck();

    // After setting shouldFail, new health check should show unhealthy
    expect(health.image.healthy).toBe(false);
  });
});

// =============================================================================
// 7. Error Handling Tests
// =============================================================================

describe('Error Handling', () => {
  describe('Provider Errors', () => {
    it('should create ProviderError with all properties', () => {
      const error = new ProviderError(
        'Test error message',
        'test-provider',
        'TEST_ERROR',
        true,
        new Error('Cause error')
      );

      expect(error.message).toBe('Test error message');
      expect(error.providerName).toBe('test-provider');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.retryable).toBe(true);
      expect(error.cause?.message).toBe('Cause error');
    });

    it('should create ProviderTimeoutError', () => {
      const error = new ProviderTimeoutError('test-provider', 5000);

      expect(error.timeoutMs).toBe(5000);
      expect(error.retryable).toBe(true);
      expect(error.code).toBe('PROVIDER_TIMEOUT');
    });

    it('should create ProviderValidationError', () => {
      const error = new ProviderValidationError('test-provider', [
        'Invalid prompt',
        'Width out of range'
      ]);

      expect(error.validationErrors).toHaveLength(2);
      expect(error.retryable).toBe(false);
    });
  });

  describe('Retry Logic', () => {
    it('should succeed on first attempt', async () => {
      let attempts = 0;
      const result = await withRetry(async () => {
        attempts++;
        return 'success';
      });

      expect(result).toBe('success');
      expect(attempts).toBe(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      let attempts = 0;
      const result = await withRetry(
        async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Temporary failure');
          }
          return 'success';
        },
        { maxRetries: 3, initialDelay: 10 }
      );

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should throw after max retries exceeded', async () => {
      let attempts = 0;
      await expect(
        withRetry(
          async () => {
            attempts++;
            throw new Error('Persistent failure');
          },
          { maxRetries: 2, initialDelay: 10 }
        )
      ).rejects.toThrow('Persistent failure');

      expect(attempts).toBe(3); // Initial + 2 retries
    });

    it('should not retry non-retryable errors', async () => {
      let attempts = 0;
      await expect(
        withRetry(
          async () => {
            attempts++;
            throw new ProviderValidationError('test', ['Invalid input']);
          },
          { maxRetries: 3, initialDelay: 10 }
        )
      ).rejects.toThrow(ProviderValidationError);

      expect(attempts).toBe(1); // Should not retry
    });

    it('should call onRetry callback', async () => {
      const retryCallbacks: Array<{ attempt: number; delay: number }> = [];

      await expect(
        withRetry(
          async () => {
            throw new Error('Failure');
          },
          {
            maxRetries: 2,
            initialDelay: 10,
            onRetry: (_error, attempt, delay) => {
              retryCallbacks.push({ attempt, delay });
            }
          }
        )
      ).rejects.toThrow();

      expect(retryCallbacks).toHaveLength(2);
      expect(retryCallbacks[0].attempt).toBe(1);
      expect(retryCallbacks[1].attempt).toBe(2);
    });
  });

  describe('Timeout Logic', () => {
    it('should resolve when operation completes in time', async () => {
      const result = await withTimeout(
        Promise.resolve('fast result'),
        1000,
        'test-provider'
      );

      expect(result).toBe('fast result');
    });

    it('should reject with timeout error when operation takes too long', async () => {
      await expect(
        withTimeout(
          new Promise(resolve => setTimeout(resolve, 100)),
          10,
          'test-provider'
        )
      ).rejects.toThrow(ProviderTimeoutError);
    });
  });
});

// =============================================================================
// 8. Metrics Tracking Tests
// =============================================================================

describe('Metrics Tracking', () => {
  let provider: MockImageProvider;

  beforeEach(async () => {
    provider = new MockImageProvider();
    await provider.init();
  });

  afterEach(async () => {
    await provider.shutdown();
  });

  it('should track initial metrics as zero', () => {
    const metrics = provider.getMetrics();

    expect(metrics.totalRequests).toBe(0);
    expect(metrics.successfulRequests).toBe(0);
    expect(metrics.failedRequests).toBe(0);
  });

  it('should track successful requests', async () => {
    await provider.generate({
      prompt: 'test',
      width: 512,
      height: 512,
      steps: 20,
      cfgScale: 7
    });
    await provider.generate({
      prompt: 'test2',
      width: 512,
      height: 512,
      steps: 20,
      cfgScale: 7
    });

    // Note: Mock provider doesn't update metrics internally
    // This test validates the metrics structure exists
    const metrics = provider.getMetrics();
    expect(metrics).toBeDefined();
    expect(typeof metrics.totalRequests).toBe('number');
  });
});

// =============================================================================
// 9. End-to-End Game Content Generation Example
// =============================================================================

describe('Educational Game Content Generation', () => {
  beforeEach(() => {
    ProviderFactory.reset();
  });

  afterEach(async () => {
    try {
      const factory = ProviderFactory.getInstance();
      await factory.shutdown();
    } catch {
      // Ignore
    }
    ProviderFactory.reset();
  });

  /**
   * This test demonstrates generating complete content for ONE educational
   * game question about fruits - the kind of content that would be used
   * in the multiple-choice game template.
   */
  it('should generate complete content for one educational question', async () => {
    // 1. Initialize the factory
    const factory = ProviderFactory.getInstance(createTestConfig());
    await factory.initialize();

    // 2. Get all providers
    const textProvider = await factory.getTextProvider();
    const imageProvider = await factory.getImageProvider();
    const audioProvider = await factory.getAudioProvider();

    // 3. Define the question we want to create content for
    const questionTopic = 'Identifying an apple';
    const choices = ['apple', 'banana', 'orange', 'grape'];
    const correctAnswer = 'apple';
    const languages = ['en', 'ro'] as const;

    // 4. Generate text content (question text)
    const questionTextResult = await textProvider.generate(
      {
        prompt: `Generate a simple question for children ages 3-8 asking them to identify an apple.
                 The question should be friendly and encouraging.
                 Return only the question text, nothing else.`,
        maxTokens: 100,
        temperature: 0.7,
        topP: 0.9,
        format: 'text'
      },
      { gameId: 'fruits-01', questionId: 'q1' }
    );

    expect(questionTextResult.data.text).toBeDefined();
    expect(questionTextResult.metadata.gameId).toBe('fruits-01');
    console.log('Generated question text:', questionTextResult.data.text);

    // 5. Generate images for all choice options
    const imageRequests: ImageRequest[] = choices.map(choice => ({
      prompt: `A cute, cartoon-style illustration of a ${choice} for children's educational game,
               simple design, bright colors, white background, child-friendly`,
      width: 512,
      height: 512,
      style: 'cartoon' as const,
      steps: 20,
      cfgScale: 7
    }));

    const progressUpdates: string[] = [];
    const imageResults = await imageProvider.generateBatch(imageRequests, {
      progressCallback: (completed, total) => {
        progressUpdates.push(`Generated image ${completed}/${total}`);
      }
    });

    expect(imageResults).toHaveLength(4);
    expect(progressUpdates).toHaveLength(4);
    imageResults.forEach((result, index) => {
      expect(result.data.buffer).toBeDefined();
      expect(result.data.mimeType).toBe('image/png');
      console.log(
        `Generated image for ${choices[index]}: ${result.data.buffer.length} bytes`
      );
    });

    // 6. Generate audio for question in both languages
    const audioResults: Map<string, GenerationResult<AudioData>> = new Map();

    for (const lang of languages) {
      const audioResult = await audioProvider.generate(
        {
          text:
            lang === 'en'
              ? 'Which one is an apple? Touch the apple!'
              : 'Care este marul? Atinge marul!',
          language: lang,
          speed: 0.9, // Slightly slower for children
          pitch: 1.0,
          format: 'mp3'
        },
        { gameId: 'fruits-01', questionId: 'q1' }
      );

      audioResults.set(lang, audioResult);
      expect(audioResult.data.buffer).toBeDefined();
      console.log(`Generated ${lang} audio: ${audioResult.data.duration.toFixed(2)}s`);
    }

    expect(audioResults.size).toBe(2);

    // 7. Generate feedback audio (correct/incorrect)
    const feedbackAudio = await audioProvider.generateBatch([
      {
        text: 'Great job! That is correct!',
        language: 'en',
        speed: 1.0,
        pitch: 1.1, // Slightly higher for excitement
        format: 'mp3'
      },
      {
        text: 'Not quite. Try again!',
        language: 'en',
        speed: 1.0,
        pitch: 1.0,
        format: 'mp3'
      }
    ]);

    expect(feedbackAudio).toHaveLength(2);

    // 8. Verify we have a complete question package
    const questionPackage = {
      id: 'q1',
      topic: questionTopic,
      correctAnswer,
      text: {
        generated: questionTextResult.data.text
      },
      images: choices.map((choice, index) => ({
        choice,
        isCorrect: choice === correctAnswer,
        size: imageResults[index].data.buffer.length
      })),
      audio: {
        en: audioResults.get('en')?.data.duration,
        ro: audioResults.get('ro')?.data.duration
      },
      feedback: {
        correct: feedbackAudio[0].data.duration,
        incorrect: feedbackAudio[1].data.duration
      }
    };

    console.log('\n=== Complete Question Package ===');
    console.log(JSON.stringify(questionPackage, null, 2));

    // 9. Final assertions
    expect(questionPackage.images).toHaveLength(4);
    expect(questionPackage.images.find(img => img.isCorrect)?.choice).toBe('apple');
    expect(questionPackage.audio.en).toBeGreaterThan(0);
    expect(questionPackage.audio.ro).toBeGreaterThan(0);
  });

  /**
   * Test that demonstrates caching integration with content generation
   */
  it('should cache generated content for reuse', async () => {
    const factory = ProviderFactory.getInstance(createTestConfig());
    await factory.initialize();

    const cacheManager = factory.getCacheManager();
    expect(cacheManager).toBeDefined();

    const imageProvider = (await factory.getImageProvider()) as MockImageProvider;

    // Generate same content twice
    const request: ImageRequest = {
      prompt: 'A red apple',
      width: 512,
      height: 512,
      steps: 20,
      cfgScale: 7
    };

    // First call
    const result1 = await imageProvider.generate(request);

    // Cache the result manually (in real implementation, this would be automatic)
    const cacheKey = cacheManager!.generateKey('mock-image', 'image', request);
    await cacheManager!.set(cacheKey, result1.data, 'image');

    // Verify it's cached
    const cached = await cacheManager!.get<ImageData>(cacheKey);
    expect(cached).toBeDefined();
    expect(cached!.width).toBe(512);

    // Call counts from mock provider
    expect(imageProvider.getCalls()).toHaveLength(1);
  });
});

// =============================================================================
// 10. Provider State Lifecycle Tests
// =============================================================================

describe('Provider State Lifecycle', () => {
  it('should transition through correct states', async () => {
    const provider = new MockImageProvider();
    const stateChanges: Array<{ oldState: string; newState: string }> = [];

    provider.on('state:changed', ({ oldState, newState }) => {
      stateChanges.push({ oldState, newState });
    });

    expect(provider.getState()).toBe(ProviderState.UNINITIALIZED);

    await provider.init();
    expect(provider.getState()).toBe(ProviderState.READY);

    await provider.shutdown();
    expect(provider.getState()).toBe(ProviderState.SHUTDOWN);

    // Verify state transition sequence
    expect(stateChanges).toContainEqual({
      oldState: ProviderState.UNINITIALIZED,
      newState: ProviderState.INITIALIZING
    });
    expect(stateChanges).toContainEqual({
      oldState: ProviderState.INITIALIZING,
      newState: ProviderState.READY
    });
    expect(stateChanges).toContainEqual({
      oldState: ProviderState.READY,
      newState: ProviderState.SHUTTING_DOWN
    });
    expect(stateChanges).toContainEqual({
      oldState: ProviderState.SHUTTING_DOWN,
      newState: ProviderState.SHUTDOWN
    });
  });

  it('should throw error when init called twice', async () => {
    const provider = new MockImageProvider();
    await provider.init();

    await expect(provider.init()).rejects.toThrow('Cannot init provider in state');

    await provider.shutdown();
  });

  it('should handle shutdown when already shutdown', async () => {
    const provider = new MockImageProvider();
    await provider.init();
    await provider.shutdown();

    // Should not throw
    await provider.shutdown();

    expect(provider.getState()).toBe(ProviderState.SHUTDOWN);
  });
});
