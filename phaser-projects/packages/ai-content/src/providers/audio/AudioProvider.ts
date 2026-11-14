/**
 * Audio provider interface and types
 */

import { z } from 'zod';
import { BaseProvider } from '../base/BaseProvider';
import { GenerationResult, BatchOptions, RequestMetadata } from '../base/types';

/**
 * Supported languages
 */
export const SupportedLanguages = ['en', 'ro'] as const;
export type Language = typeof SupportedLanguages[number];

/**
 * Audio generation request schema
 */
export const AudioRequestSchema = z.object({
  text: z.string().min(1).max(5000),
  language: z.enum(SupportedLanguages).default('en'),
  voice: z.string().optional(),
  speed: z.number().min(0.5).max(2.0).default(1.0),
  pitch: z.number().min(0.5).max(2.0).default(1.0),
  format: z.enum(['wav', 'mp3', 'ogg']).default('mp3')
});

export type AudioRequest = z.infer<typeof AudioRequestSchema>;

/**
 * Generated audio data
 */
export interface AudioData {
  buffer: Buffer;
  mimeType: 'audio/wav' | 'audio/mpeg' | 'audio/ogg';
  duration: number; // seconds
  sampleRate: number;
}

/**
 * Voice information
 */
export interface VoiceInfo {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
}

/**
 * Audio provider interface.
 * Implementations: PiperProvider, ElevenLabsProvider (future)
 */
export interface IAudioProvider {
  /**
   * Generate audio from text.
   */
  generate(
    request: AudioRequest,
    metadata?: Partial<RequestMetadata>
  ): Promise<GenerationResult<AudioData>>;

  /**
   * Generate multiple audio clips in batch.
   */
  generateBatch(
    requests: AudioRequest[],
    options?: BatchOptions,
    metadata?: Partial<RequestMetadata>
  ): Promise<GenerationResult<AudioData>[]>;

  /**
   * Get available voices for a language.
   */
  getVoices(language: Language): Promise<VoiceInfo[]>;

  /**
   * Get supported languages.
   */
  getSupportedLanguages(): Language[];
}

/**
 * Abstract base for audio providers.
 * Extends BaseProvider with audio generation capabilities.
 */
export abstract class AudioProviderBase extends BaseProvider implements IAudioProvider {
  abstract generate(
    request: AudioRequest,
    metadata?: Partial<RequestMetadata>
  ): Promise<GenerationResult<AudioData>>;

  abstract generateBatch(
    requests: AudioRequest[],
    options?: BatchOptions,
    metadata?: Partial<RequestMetadata>
  ): Promise<GenerationResult<AudioData>[]>;

  abstract getVoices(language: Language): Promise<VoiceInfo[]>;

  abstract getSupportedLanguages(): Language[];
}
