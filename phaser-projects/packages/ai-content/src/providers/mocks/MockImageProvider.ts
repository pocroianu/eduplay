/**
 * Mock image provider for testing
 */

import { v4 as uuid } from 'uuid';
import { ImageProviderBase, ImageRequest, ImageData } from '../image/ImageProvider';
import { GenerationResult, BatchOptions, RequestMetadata } from '../base/types';
import { HealthCheckResult } from '../base/BaseProvider';

/**
 * Mock image provider for testing.
 * Returns deterministic results for testing purposes.
 */
export class MockImageProvider extends ImageProviderBase {
  private responses: Map<string, ImageData> = new Map();
  private callLog: ImageRequest[] = [];
  private shouldFail: boolean = false;
  private latency: number = 10;

  constructor() {
    super({
      name: 'mock-image',
      baseUrl: 'http://mock:8188',
      timeout: 5000,
      retries: 0,
      healthCheckInterval: 60000
    });
  }

  // Test helpers

  setResponse(prompt: string, data: ImageData): void {
    this.responses.set(prompt, data);
  }

  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }

  setLatency(ms: number): void {
    this.latency = ms;
  }

  getCalls(): ImageRequest[] {
    return [...this.callLog];
  }

  clearCalls(): void {
    this.callLog = [];
  }

  // Provider implementation

  async generate(
    request: ImageRequest,
    metadata?: Partial<RequestMetadata>
  ): Promise<GenerationResult<ImageData>> {
    this.callLog.push(request);

    if (this.shouldFail) {
      throw new Error('Mock provider failure');
    }

    await this.simulateLatency();

    const data = this.responses.get(request.prompt) || this.createDefaultImage(request);

    return {
      data,
      metadata: {
        requestId: metadata?.requestId || uuid(),
        gameId: metadata?.gameId,
        questionId: metadata?.questionId,
        timestamp: new Date()
      },
      cached: false,
      latency: this.latency,
      provider: this.getName()
    };
  }

  async generateBatch(
    requests: ImageRequest[],
    options?: BatchOptions
  ): Promise<GenerationResult<ImageData>[]> {
    const results: GenerationResult<ImageData>[] = [];

    for (let i = 0; i < requests.length; i++) {
      const result = await this.generate(requests[i]);
      results.push(result);
      options?.progressCallback?.(i + 1, requests.length);
    }

    return results;
  }

  getSupportedStyles(): string[] {
    return ['cartoon', 'realistic', 'flat', 'watercolor'];
  }

  async getAvailableLoras(): Promise<string[]> {
    return ['children-book-v1', 'educational-v1'];
  }

  protected async _doInit(): Promise<void> {
    // No-op for mock
  }

  protected async _doHealthCheck(): Promise<Omit<HealthCheckResult, 'latency' | 'timestamp'>> {
    return { healthy: !this.shouldFail };
  }

  protected async _doShutdown(): Promise<void> {
    // No-op for mock
  }

  private async simulateLatency(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.latency));
  }

  private createDefaultImage(request: ImageRequest): ImageData {
    // Return a 1x1 transparent PNG
    const transparentPixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    return {
      buffer: transparentPixel,
      mimeType: 'image/png',
      width: request.width,
      height: request.height,
      seed: request.seed || Math.floor(Math.random() * 1000000)
    };
  }
}
