/**
 * Piper TTS Provider
 *
 * Self-hosted text-to-speech provider using Piper.
 * Supports multiple languages (en, ro) and voices.
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';
import { BaseProvider, BaseProviderConfigSchema, HealthCheckResult } from '../base/BaseProvider';
import {
  IAudioProvider,
  AudioRequest,
  AudioRequestSchema,
  AudioData,
  VoiceInfo,
  Language,
  SupportedLanguages
} from './AudioProvider';
import { GenerationResult, BatchOptions, RequestMetadata } from '../base/types';
import {
  ProviderUnavailableError,
  ProviderTimeoutError,
  ProviderValidationError,
  ModelNotFoundError
} from '../base/errors';

/**
 * Piper-specific configuration schema
 */
export const PiperProviderConfigSchema = BaseProviderConfigSchema.extend({
  voices: z.record(z.string()).optional(),
  defaultVoices: z.object({
    en: z.string().default('en_US-lessac-medium'),
    ro: z.string().default('ro_RO-mihai-medium')
  }).optional()
});

export type PiperProviderConfig = z.infer<typeof PiperProviderConfigSchema>;

/**
 * Voice metadata from Piper API
 */
interface PiperVoice {
  language: string;
  voice: string;
  description: string;
}

/**
 * PiperProvider implements text-to-speech generation using the Piper TTS system.
 *
 * Features:
 * - Multi-language support (English, Romanian)
 * - Multiple voice options per language
 * - WAV output format (can be converted to MP3/OGG)
 * - Health checks and voice verification
 * - Proper error handling and timeouts
 * - Batch generation support
 *
 * @example
 * ```typescript
 * const provider = new PiperProvider({
 *   name: 'piper',
 *   baseUrl: 'http://localhost:5000',
 *   timeout: 30000
 * });
 *
 * await provider.init();
 *
 * const result = await provider.generate({
 *   text: 'Hello world',
 *   language: 'en',
 *   format: 'wav'
 * });
 * ```
 */
export class PiperProvider extends BaseProvider implements IAudioProvider {
  private piperConfig: PiperProviderConfig;
  private availableVoices: Map<Language, VoiceInfo[]> = new Map();

  constructor(config: PiperProviderConfig) {
    super(config);
    this.piperConfig = PiperProviderConfigSchema.parse(config);
  }

  /**
   * Initialize provider and verify voices are available
   */
  protected async _doInit(): Promise<void> {
    try {
      // Verify Piper service is accessible
      await this.fetchVoicesFromAPI();
    } catch (error) {
      throw new ProviderUnavailableError(
        this.config.name,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Health check - verify service is responsive and voices are available
   */
  protected async _doHealthCheck(): Promise<Omit<HealthCheckResult, 'latency' | 'timestamp'>> {
    try {
      const response = await this.fetchWithTimeout('/health', {
        method: 'GET'
      });

      if (!response.ok) {
        return {
          healthy: false,
          message: `Health check failed with status: ${response.status}`
        };
      }

      const data = await response.json() as { status?: string; service?: string };

      // Verify voices are available
      const voicesAvailable = this.availableVoices.size > 0;

      return {
        healthy: true,
        message: data.status || 'Service healthy',
        details: {
          service: data.service,
          voicesLoaded: voicesAvailable,
          supportedLanguages: Array.from(this.availableVoices.keys())
        }
      };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Health check failed'
      };
    }
  }

  /**
   * Cleanup resources
   */
  protected async _doShutdown(): Promise<void> {
    // Clear voice cache
    this.availableVoices.clear();
  }

  /**
   * Generate audio from text
   */
  async generate(
    request: AudioRequest,
    metadata?: Partial<RequestMetadata>
  ): Promise<GenerationResult<AudioData>> {
    // Validate request
    const validatedRequest = AudioRequestSchema.parse(request);

    const requestId = metadata?.requestId || randomUUID();
    const startTime = Date.now();

    this.emit('request:start', { requestId, type: 'audio', request: validatedRequest });

    try {
      // Validate language support
      if (!SupportedLanguages.includes(validatedRequest.language)) {
        throw new ProviderValidationError(
          this.config.name,
          [`Unsupported language: ${validatedRequest.language}`]
        );
      }

      // Get voice for language
      const voice = this.resolveVoice(validatedRequest.language, validatedRequest.voice);

      // Make synthesis request
      const audioData = await this.synthesize(validatedRequest.text, voice);

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

  /**
   * Generate multiple audio clips in batch
   */
  async generateBatch(
    requests: AudioRequest[],
    options?: BatchOptions,
    metadata?: Partial<RequestMetadata>
  ): Promise<GenerationResult<AudioData>[]> {
    const {
      concurrency = 3,
      stopOnError = false,
      progressCallback
    } = options || {};

    const results: GenerationResult<AudioData>[] = [];
    let completed = 0;
    // Process in chunks based on concurrency
    for (let i = 0; i < requests.length; i += concurrency) {
      const chunk = requests.slice(i, i + concurrency);

      const chunkPromises = chunk.map(async (request) => {
        try {
          const result = await this.generate(request, metadata);
          completed++;
          progressCallback?.(completed, requests.length);
          return result;
        } catch (error) {
          if (stopOnError) {
            throw error;
          }
          // Return error result for failed generation
          throw error;
        }
      });

      if (stopOnError) {
        // Fail fast on first error
        const chunkResults = await Promise.all(chunkPromises);
        results.push(...chunkResults);
      } else {
        // Continue on errors
        const chunkResults = await Promise.allSettled(chunkPromises);
        chunkResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          }
        });
      }
    }

    return results;
  }

  /**
   * Get available voices for a language
   */
  async getVoices(language: Language): Promise<VoiceInfo[]> {
    // Refresh voices if not loaded
    if (this.availableVoices.size === 0) {
      await this.fetchVoicesFromAPI();
    }

    const voices = this.availableVoices.get(language);
    if (!voices) {
      return [];
    }

    return voices;
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): Language[] {
    return [...SupportedLanguages];
  }

  // Private methods

  /**
   * Fetch available voices from Piper API
   */
  private async fetchVoicesFromAPI(): Promise<void> {
    try {
      const response = await this.fetchWithTimeout('/voices', {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.status}`);
      }

      const data = await response.json() as { voices: PiperVoice[] };

      // Parse and organize voices by language
      this.availableVoices.clear();

      for (const voice of data.voices) {
        const lang = voice.language as Language;

        if (SupportedLanguages.includes(lang)) {
          if (!this.availableVoices.has(lang)) {
            this.availableVoices.set(lang, []);
          }

          // Infer gender from voice name (heuristic)
          const gender = this.inferGender(voice.voice);

          this.availableVoices.get(lang)!.push({
            id: voice.voice,
            name: voice.description,
            gender
          });
        }
      }
    } catch (error) {
      throw new ProviderUnavailableError(
        this.config.name,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Resolve voice ID for a language
   */
  private resolveVoice(language: Language, requestedVoice?: string): string {
    // Use requested voice if provided
    if (requestedVoice) {
      return requestedVoice;
    }

    // Use default voice from config
    const defaultVoices = this.piperConfig.defaultVoices || {
      en: 'en_US-lessac-medium',
      ro: 'ro_RO-mihai-medium'
    };

    return defaultVoices[language];
  }

  /**
   * Synthesize speech from text
   */
  private async synthesize(text: string, voice: string): Promise<AudioData> {
    try {
      const response = await this.fetchWithTimeout('/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          language: this.getLanguageFromVoice(voice),
          output_format: 'wav'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: string };

        if (response.status === 500 && errorData.error?.includes('not found')) {
          throw new ModelNotFoundError(this.config.name, voice);
        }

        throw new Error(
          errorData.error || `Synthesis failed with status: ${response.status}`
        );
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      // Parse WAV header to get sample rate and duration
      const { sampleRate, duration } = this.parseWavHeader(buffer);

      return {
        buffer,
        mimeType: 'audio/wav',
        duration,
        sampleRate
      };
    } catch (error) {
      if (error instanceof ModelNotFoundError) {
        throw error;
      }

      throw new ProviderUnavailableError(
        this.config.name,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Make HTTP request with timeout
   */
  private async fetchWithTimeout(
    path: string,
    options: RequestInit
  ): Promise<Response> {
    const url = `${this.config.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ProviderTimeoutError(this.config.name, this.config.timeout);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse WAV header to extract sample rate and calculate duration
   */
  private parseWavHeader(buffer: Buffer): { sampleRate: number; duration: number } {
    // Default values if parsing fails
    const defaultSampleRate = 22050;

    try {
      // WAV format: RIFF header at bytes 0-3, file size at 4-7
      // fmt chunk starts at byte 12
      // Sample rate is at bytes 24-27 (little endian)
      // Data chunk size is typically at bytes 40-43

      const sampleRate = buffer.readUInt32LE(24);
      const dataSize = buffer.length - 44; // Subtract header size
      const bytesPerSample = 2; // 16-bit audio
      const channels = buffer.readUInt16LE(22);

      const duration = dataSize / (sampleRate * bytesPerSample * channels);

      return {
        sampleRate,
        duration: Math.max(0, duration)
      };
    } catch {
      // Fallback if parsing fails
      return {
        sampleRate: defaultSampleRate,
        duration: 0
      };
    }
  }

  /**
   * Extract language code from voice ID
   */
  private getLanguageFromVoice(voice: string): Language {
    // Voice format: en_US-lessac-medium or ro_RO-mihai-medium
    const languageMatch = voice.match(/^([a-z]{2})_/);
    if (languageMatch) {
      const lang = languageMatch[1];
      if (SupportedLanguages.includes(lang as Language)) {
        return lang as Language;
      }
    }

    // Default to English
    return 'en';
  }

  /**
   * Infer gender from voice name (heuristic)
   */
  private inferGender(voiceName: string): 'male' | 'female' | 'neutral' {
    const lowerName = voiceName.toLowerCase();

    // Common patterns
    const femalePatterns = ['female', 'lessac', 'amy', 'jenny', 'joanna', 'kendra', 'kimberly', 'salli'];
    const malePatterns = ['male', 'mihai', 'matthew', 'joey', 'justin', 'kevin'];

    for (const pattern of femalePatterns) {
      if (lowerName.includes(pattern)) {
        return 'female';
      }
    }

    for (const pattern of malePatterns) {
      if (lowerName.includes(pattern)) {
        return 'male';
      }
    }

    return 'neutral';
  }
}
