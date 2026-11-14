/**
 * Mock text provider for testing
 */

import { v4 as uuid } from 'uuid';
import { TextProviderBase, TextRequest, TextData, ModelInfo } from '../text/TextProvider';
import { GenerationResult, BatchOptions, RequestMetadata } from '../base/types';
import { HealthCheckResult } from '../base/BaseProvider';

/**
 * Mock text provider for testing.
 * Returns deterministic results for testing purposes.
 */
export class MockTextProvider extends TextProviderBase {
  private responses: Map<string, string> = new Map();
  private callLog: TextRequest[] = [];
  private shouldFail: boolean = false;
  private latency: number = 10;

  constructor() {
    super({
      name: 'mock-text',
      baseUrl: 'http://mock:11434',
      timeout: 5000,
      retries: 0,
      healthCheckInterval: 60000
    });
  }

  // Test helpers

  setResponse(prompt: string, text: string): void {
    this.responses.set(prompt, text);
  }

  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }

  setLatency(ms: number): void {
    this.latency = ms;
  }

  getCalls(): TextRequest[] {
    return [...this.callLog];
  }

  clearCalls(): void {
    this.callLog = [];
  }

  // Provider implementation

  async generate(
    request: TextRequest,
    metadata?: Partial<RequestMetadata>
  ): Promise<GenerationResult<TextData>> {
    this.callLog.push(request);

    if (this.shouldFail) {
      throw new Error('Mock provider failure');
    }

    await this.simulateLatency();

    const text = this.responses.get(request.prompt) || `Mock response to: ${request.prompt}`;

    const data: TextData = {
      text,
      tokensUsed: text.split(' ').length,
      finishReason: 'stop'
    };

    return {
      data,
      metadata: {
        requestId: metadata?.requestId || uuid(),
        gameId: metadata?.gameId,
        questionId: metadata?.questionId,
        timestamp: new Date()
      },
      cached: false,
      latency: this.latency
    };
  }

  async generateBatch(
    requests: TextRequest[],
    options?: BatchOptions
  ): Promise<GenerationResult<TextData>[]> {
    const results: GenerationResult<TextData>[] = [];

    for (let i = 0; i < requests.length; i++) {
      const result = await this.generate(requests[i]);
      results.push(result);
      options?.progressCallback?.(i + 1, requests.length);
    }

    return results;
  }

  async getModelInfo(): Promise<ModelInfo> {
    return {
      name: 'mock-model',
      contextLength: 4096,
      parameters: '7B'
    };
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
}
