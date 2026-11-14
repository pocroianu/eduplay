import { randomUUID } from 'crypto';
import { z } from 'zod';
import { BaseProvider, BaseProviderConfigSchema, HealthCheckResult } from '../base/BaseProvider';
import { ProviderTimeoutError, ProviderUnavailableError, ProviderValidationError } from '../base/errors';
import { BatchOptions, GenerationResult, RequestMetadata } from '../base/types';
import { AudioData, AudioRequest, AudioRequestSchema, IAudioProvider, Language, VoiceInfo } from './AudioProvider';

const F5SupportedLanguages = ['ro'] as const;

export const F5RomanianProviderConfigSchema = BaseProviderConfigSchema.extend({
  defaultVoice: z.string().default('f5-ro-reference')
});

export type F5RomanianProviderConfig = z.infer<typeof F5RomanianProviderConfigSchema>;
type F5RomanianProviderConstructorConfig = Omit<F5RomanianProviderConfig, 'defaultVoice'> & {
  defaultVoice?: string;
};


interface F5Voice {
  language: string;
  voice: string;
  description: string;
  gender?: 'male' | 'female' | 'neutral';
}

export class F5RomanianProvider extends BaseProvider implements IAudioProvider {
  private readonly f5Config: F5RomanianProviderConfig;
  private availableVoices: VoiceInfo[] = [];
  private defaultVoice: string;

  constructor(config: F5RomanianProviderConstructorConfig) {
    super(config);
    this.f5Config = F5RomanianProviderConfigSchema.parse(config);
    this.defaultVoice = this.f5Config.defaultVoice;
  }

  protected async _doInit(): Promise<void> {
    const deadline = Date.now() + Math.max(this.config.timeout, 10 * 60 * 1000);

    while (true) {
      try {
        await this.fetchVoicesFromAPI();
        return;
      } catch (error) {
        if (
          error instanceof ProviderUnavailableError &&
          /still loading|retrying/i.test(error.cause?.message ?? '') &&
          Date.now() < deadline
        ) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        throw error;
      }
    }
  }

  protected async _doHealthCheck(): Promise<Omit<HealthCheckResult, 'latency' | 'timestamp'>> {
    try {
      const response = await this.fetchWithTimeout('/health', { method: 'GET' });
      const data = await response.json().catch(() => ({})) as {
        service?: string;
        status?: string;
        modelLoaded?: boolean;
        error?: string;
      };

      if (!response.ok) {
        return { healthy: false, message: data.error || `Health check failed with status: ${response.status}` };
      }
      if (data.service !== 'f5-romanian-tts') {
        return { healthy: false, message: `Unexpected service at ${this.config.baseUrl}: ${data.service || 'unknown'}` };
      }

      const voicesResponse = await this.fetchWithTimeout('/voices', { method: 'GET' });
      const voicesData = await voicesResponse.json().catch(() => ({})) as {
        service?: string;
        voices?: Array<{ language?: string }>;
        error?: string;
        message?: string;
      };
      const romanianVoices = voicesData.voices?.filter(voice => voice.language === 'ro') ?? [];

      if (!voicesResponse.ok || voicesData.service !== 'f5-romanian-tts' || romanianVoices.length === 0) {
        return {
          healthy: false,
          message: voicesData.error || voicesData.message || 'No Romanian F5 voice available'
        };
      }

      return {
        healthy: data.modelLoaded !== false,
        message: data.status || 'Service healthy',
        details: {
          modelLoaded: data.modelLoaded,
          supportedLanguages: ['ro'],
          voiceCount: romanianVoices.length
        }
      };
    } catch (error) {
      return { healthy: false, message: error instanceof Error ? error.message : 'Health check failed' };
    }
  }

  protected async _doShutdown(): Promise<void> {
    this.availableVoices = [];
  }

  async generate(request: AudioRequest, metadata?: Partial<RequestMetadata>): Promise<GenerationResult<AudioData>> {
    const requestId = metadata?.requestId || randomUUID();
    const startTime = Date.now();

    try {
      const requestedLanguage = typeof request === 'object' && request !== null
        ? (request as { language?: unknown }).language
        : undefined;
      if (requestedLanguage !== undefined && requestedLanguage !== 'ro') {
        throw new ProviderValidationError(this.config.name, [`Unsupported language: ${String(requestedLanguage)}`]);
      }

      const validatedRequest = AudioRequestSchema.parse(request);

      this.emit('request:start', { requestId, type: 'audio', request: validatedRequest });

      if (validatedRequest.language !== 'ro') {
        throw new ProviderValidationError(this.config.name, [`Unsupported language: ${validatedRequest.language}`]);
      }
      if (
        validatedRequest.voice &&
        this.availableVoices.length > 0 &&
        !this.availableVoices.some(voice => voice.id === validatedRequest.voice)
      ) {
        throw new ProviderValidationError(this.config.name, [`Unsupported voice: ${validatedRequest.voice}`]);
      }
      const audioData = await this.synthesize(validatedRequest);
      const latency = Date.now() - startTime;
      this.recordRequest(true, latency);

      const result: GenerationResult<AudioData> = {
        data: audioData,
        metadata: {
          requestId,
          gameId: metadata?.gameId,
          questionId: metadata?.questionId,
          timestamp: new Date()
        },
        cached: false,
        latency
      };

      this.emit('request:success', { requestId, latency });
      return result;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.recordRequest(false, latency);
      this.emit('request:error', { requestId, error, latency });
      throw error;
    }
  }

  async generateBatch(
    requests: AudioRequest[],
    options?: BatchOptions,
    metadata?: Partial<RequestMetadata>
  ): Promise<GenerationResult<AudioData>[]> {
    const { concurrency = 2, stopOnError = false, progressCallback } = options || {};
    const results: GenerationResult<AudioData>[] = [];
    let completed = 0;

    for (let i = 0; i < requests.length; i += concurrency) {
      const chunk = requests.slice(i, i + concurrency);
      const chunkPromises = chunk.map(async request => {
        const result = await this.generate(request, metadata);
        completed++;
        progressCallback?.(completed, requests.length);
        return result;
      });

      if (stopOnError) {
        results.push(...await Promise.all(chunkPromises));
      } else {
        const settled = await Promise.allSettled(chunkPromises);
        settled.forEach(result => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          }
        });
      }
    }

    return results;
  }

  async getVoices(language: Language): Promise<VoiceInfo[]> {
    if (language !== 'ro') {
      return [];
    }

    if (this.availableVoices.length === 0) {
      await this.fetchVoicesFromAPI();
    }

    return this.availableVoices;
  }

  getSupportedLanguages(): Language[] {
    return [...F5SupportedLanguages];
  }

  private async fetchVoicesFromAPI(): Promise<void> {
    try {
      const response = await this.fetchWithTimeout('/voices', { method: 'GET' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: string; message?: string };
        throw new Error(errorData.error || errorData.message || `Failed to fetch voices: ${response.status}`);
      }

      const data = await response.json() as { service?: string; voices: F5Voice[] };
      if (data.service !== 'f5-romanian-tts') {
        throw new Error(`Unexpected service at ${this.config.baseUrl}: ${data.service || 'unknown'}`);
      }
      this.availableVoices = data.voices
        .filter(voice => voice.language === 'ro')
        .map(voice => ({
          id: voice.voice,
          name: voice.description,
          gender: voice.gender || 'neutral'
        }));
      if (this.availableVoices.length === 0) {
        throw new Error(`No Romanian F5 voice available at ${this.config.baseUrl}`);
      }
      if (!this.availableVoices.some(voice => voice.id === this.defaultVoice)) {
        this.defaultVoice = this.availableVoices[0].id;
      }
    } catch (error) {
      if (error instanceof ProviderTimeoutError) {
        throw error;
      }
      throw new ProviderUnavailableError(this.config.name, error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async synthesize(request: AudioRequest): Promise<AudioData> {
    try {
      const response = await this.fetchWithTimeout('/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: request.text,
          language: 'ro',
          voice: request.voice || this.defaultVoice,
          speed: request.speed,
          output_format: request.format
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(errorData.error || `Synthesis failed with status: ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const mimeType = this.resolveMimeType(response.headers.get('Content-Type'), request.format);

      if (mimeType === 'audio/wav') {
        const { sampleRate, duration } = this.parseWavHeader(buffer);
        return { buffer, mimeType, duration, sampleRate };
      }

      return {
        buffer,
        mimeType,
        duration: this.parseOptionalNumber(response.headers.get('x-audio-duration')),
        sampleRate: this.parseOptionalNumber(response.headers.get('x-audio-sample-rate'))
      };
    } catch (error) {
      if (error instanceof ProviderTimeoutError) {
        throw error;
      }
      throw new ProviderUnavailableError(this.config.name, error instanceof Error ? error : new Error(String(error)));
    }
  }


  private async fetchWithTimeout(path: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      return await fetch(`${this.config.baseUrl}${path}`, { ...options, signal: controller.signal });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ProviderTimeoutError(this.config.name, this.config.timeout);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private parseWavHeader(buffer: Buffer): { sampleRate: number; duration: number } {
    const defaultSampleRate = 24000;

    try {
      const sampleRate = buffer.readUInt32LE(24);
      const dataSize = buffer.readUInt32LE(40);
      const bytesPerSample = buffer.readUInt16LE(34) / 8;
      const channels = buffer.readUInt16LE(22);
      const duration = dataSize / (sampleRate * bytesPerSample * channels);
      return { sampleRate, duration: Math.max(0, duration) };
    } catch {
      return { sampleRate: defaultSampleRate, duration: 0 };
    }
  }

  private resolveMimeType(contentType: string | null, format: AudioRequest['format']): AudioData['mimeType'] {
    const mimeType = contentType?.split(';', 1)[0].trim().toLowerCase();
    if (mimeType === 'audio/wav' || mimeType === 'audio/mpeg' || mimeType === 'audio/ogg') {
      return mimeType;
    }

    switch (format) {
      case 'wav':
        return 'audio/wav';
      case 'mp3':
        return 'audio/mpeg';
      case 'ogg':
        return 'audio/ogg';
    }
    const exhaustive: never = format;
    return exhaustive;
  }

  private parseOptionalNumber(value: string | null): number {
    if (value === null) {
      return 0;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
