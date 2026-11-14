/**
 * Mock audio provider for testing
 */

import { v4 as uuid } from 'uuid';
import { AudioProviderBase, AudioRequest, AudioData, Language, VoiceInfo } from '../audio/AudioProvider';
import { GenerationResult, BatchOptions, RequestMetadata } from '../base/types';
import { HealthCheckResult } from '../base/BaseProvider';

/**
 * Mock audio provider for testing.
 * Returns deterministic results for testing purposes.
 */
export class MockAudioProvider extends AudioProviderBase {
  private responses: Map<string, Buffer> = new Map();
  private callLog: AudioRequest[] = [];
  private shouldFail: boolean = false;
  private latency: number = 10;

  constructor() {
    super({
      name: 'mock-audio',
      baseUrl: 'http://mock:5000',
      timeout: 5000,
      retries: 0,
      healthCheckInterval: 60000
    });
  }

  // Test helpers

  setResponse(text: string, buffer: Buffer): void {
    this.responses.set(text, buffer);
  }

  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }

  setLatency(ms: number): void {
    this.latency = ms;
  }

  getCalls(): AudioRequest[] {
    return [...this.callLog];
  }

  clearCalls(): void {
    this.callLog = [];
  }

  // Provider implementation

  async generate(
    request: AudioRequest,
    metadata?: Partial<RequestMetadata>
  ): Promise<GenerationResult<AudioData>> {
    this.callLog.push(request);

    if (this.shouldFail) {
      throw new Error('Mock provider failure');
    }

    await this.simulateLatency();

    const buffer = this.responses.get(request.text) || this.createSilentAudio();

    const data: AudioData = {
      buffer,
      mimeType: 'audio/mpeg',
      duration: request.text.length * 0.05, // ~50ms per character
      sampleRate: 22050
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
    requests: AudioRequest[],
    options?: BatchOptions
  ): Promise<GenerationResult<AudioData>[]> {
    const results: GenerationResult<AudioData>[] = [];

    for (let i = 0; i < requests.length; i++) {
      const result = await this.generate(requests[i]);
      results.push(result);
      options?.progressCallback?.(i + 1, requests.length);
    }

    return results;
  }

  async getVoices(language: Language): Promise<VoiceInfo[]> {
    return [
      {
        id: `${language}_mock_voice`,
        name: `Mock Voice (${language})`,
        gender: 'neutral'
      }
    ];
  }

  getSupportedLanguages(): Language[] {
    return ['en', 'ro'];
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

  private createSilentAudio(): Buffer {
    // Return a minimal MP3 header (silent frame)
    return Buffer.from([
      0xFF, 0xFB, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    ]);
  }
}
