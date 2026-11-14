import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FallbackImageProvider } from '../FallbackImageProvider';
import { ImageProviderBase, ImageRequest, ImageData } from '../ImageProvider';
import { GenerationResult, BatchOptions, RequestMetadata } from '../../base/types';
import { HealthCheckResult } from '../../base/BaseProvider';
import {
  ProviderError,
  ProviderUnavailableError,
  ProviderValidationError
} from '../../base/errors';

describe('FallbackImageProvider', () => {
  let primary: TestImageProvider;
  let fallback: TestImageProvider;
  let provider: FallbackImageProvider;

  beforeEach(async () => {
    primary = new TestImageProvider('qwen');
    fallback = new TestImageProvider('comfyui');
    await primary.init();
    await fallback.init();
    provider = new FallbackImageProvider(
      { name: 'qwen-with-fallback', timeout: 1000 },
      primary,
      fallback
    );
    await provider.init();
  });

  afterEach(async () => {
    await provider.shutdown();
    await primary.shutdown();
    await fallback.shutdown();
  });

  it('uses the fallback immediately for unsupported LoRA batches', async () => {
    primary.supportOverride = {
      supported: false,
      reason: 'Qwen base production mode does not support LoRA selection.'
    };

    const results = await provider.generateBatch([
      { prompt: 'fox', width: 512, height: 512, lora: 'animals-lora.safetensors' }
    ]);

    expect(primary.batchCalls).toHaveLength(0);
    expect(fallback.batchCalls).toHaveLength(1);
    expect(results[0].provider).toBe('comfyui (fallback)');
    expect(results[0].providerDetails).toMatchObject({
      route: 'fallback-batch-unsupported',
      primaryProvider: 'qwen',
      fallbackProvider: 'comfyui'
    });
  });

  it('reruns the full batch on fallback when the primary batch fails with a retryable error', async () => {
    primary.batchError = new ProviderUnavailableError('qwen');

    const results = await provider.generateBatch([
      { prompt: 'fox', width: 512, height: 512 },
      { prompt: 'rabbit', width: 512, height: 512 }
    ]);

    expect(primary.batchCalls).toHaveLength(1);
    expect(fallback.batchCalls).toHaveLength(1);
    expect(results).toHaveLength(2);
    expect(results.every((result) => result.provider === 'comfyui (fallback)')).toBe(true);
    expect(results[0].providerDetails).toMatchObject({
      route: 'fallback-batch-error',
      primaryProvider: 'qwen',
      fallbackProvider: 'comfyui'
    });
  });

  it('still falls back for single-request primary errors', async () => {
    primary.singleError = new Error('qwen bridge crashed');

    const result = await provider.generate({
      prompt: 'fox',
      width: 512,
      height: 512
    });

    expect(result.provider).toBe('comfyui (fallback)');
    expect(result.providerDetails).toMatchObject({
      route: 'fallback-single-error'
    });
  });

  it('surfaces non-retryable primary batch errors', async () => {
    primary.batchError = new ProviderValidationError('qwen', ['bad prompt']);

    await expect(
      provider.generateBatch([{ prompt: 'fox', width: 512, height: 512 }])
    ).rejects.toBeInstanceOf(ProviderValidationError);

    expect(fallback.batchCalls).toHaveLength(0);
  });
});

class TestImageProvider extends ImageProviderBase {
  supportOverride?: { supported: boolean; reason?: string };
  singleError?: Error;
  batchError?: Error;
  singleCalls: ImageRequest[] = [];
  batchCalls: ImageRequest[][] = [];

  constructor(name: string) {
    super({
      name,
      baseUrl: `http://localhost/${name}`,
      timeout: 1000,
      retries: 0,
      healthCheckInterval: 30000
    });
  }

  async generate(
    request: ImageRequest,
    metadata?: Partial<RequestMetadata>
  ): Promise<GenerationResult<ImageData>> {
    this.singleCalls.push(request);
    if (this.singleError) {
      throw this.singleError;
    }

    return this.buildResult(request, metadata);
  }

  async generateBatch(
    requests: ImageRequest[],
    options?: BatchOptions,
    metadata?: Partial<RequestMetadata>
  ): Promise<GenerationResult<ImageData>[]> {
    this.batchCalls.push(requests);
    if (this.batchError) {
      throw this.batchError;
    }

    return requests.map((request, index) => {
      options?.progressCallback?.(index + 1, requests.length);
      return this.buildResult(request, metadata);
    });
  }

  getSupportedStyles(): string[] {
    return ['cartoon'];
  }

  async getAvailableLoras(): Promise<string[]> {
    return ['animals-lora.safetensors'];
  }

  supportsRequest(_request: ImageRequest) {
    return this.supportOverride || { supported: true };
  }

  protected async _doInit(): Promise<void> {}

  protected async _doHealthCheck(): Promise<Omit<HealthCheckResult, 'latency' | 'timestamp'>> {
    return { healthy: true };
  }

  protected async _doShutdown(): Promise<void> {}

  private buildResult(
    request: ImageRequest,
    metadata?: Partial<RequestMetadata>
  ): GenerationResult<ImageData> {
    return {
      data: {
        buffer: Buffer.from(`${this.getName()}-${request.prompt}`),
        mimeType: 'image/png',
        width: request.width ?? 512,
        height: request.height ?? 512,
        seed: request.seed ?? 1
      },
      metadata: {
        requestId: metadata?.requestId || `${this.getName()}-request`,
        gameId: metadata?.gameId,
        questionId: metadata?.questionId,
        timestamp: new Date()
      },
      cached: false,
      latency: 1,
      provider: this.getName()
    };
  }
}
