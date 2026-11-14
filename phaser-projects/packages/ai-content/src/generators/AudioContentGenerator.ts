/**
 * Generates audio narration for game content.
 *
 * @module generators/AudioContentGenerator
 */

import PQueue from 'p-queue';
import { AudioGenerationSpec, BatchGenerationOptions } from './types';
import { AudioProviderBase } from '../providers/audio/AudioProvider';

/**
 * Generates audio narration for game content.
 */
export class AudioContentGenerator {
  constructor(private provider: AudioProviderBase) {}

  getProviderName(): string {
    return this.provider.getName();
  }

  /**
   * Generate audio from text
   */
  async generate(spec: AudioGenerationSpec): Promise<{ buffer: Buffer; duration: number }> {
    const result = await this.provider.generate({
      text: spec.text,
      language: spec.language as 'en' | 'ro',
      voice: spec.voice,
      speed: spec.speed || 1.0,
      pitch: 1.0,
      format: 'mp3'
    });

    return {
      buffer: result.data.buffer,
      duration: result.data.duration ?? 0
    };
  }

  /**
   * Generate multiple audio files in batch with concurrent processing
   */
  async generateBatch(
    specs: AudioGenerationSpec[],
    options?: BatchGenerationOptions
  ): Promise<Array<{ buffer: Buffer; duration: number }>> {
    // Handle edge case: empty array
    if (specs.length === 0) {
      return [];
    }

    // Create queue with configurable concurrency (default to 3 per ADR-4)
    const concurrency = options?.concurrency ?? 3;
    const queue = new PQueue({ concurrency });

    // Track progress
    let completed = 0;

    // Create array to store results in original order
    const results: Array<{ buffer: Buffer; duration: number }> =
      new Array(specs.length);

    // Queue all generation tasks
    const promises = specs.map((spec, index) =>
      queue.add(async () => {
        try {
          const { buffer, duration } = await this.generate(spec);

          // Store result at correct index to maintain order
          results[index] = { buffer, duration };

          // Update progress
          completed++;
          if (options?.onProgress) {
            options.onProgress(completed, specs.length);
          }

          return results[index];
        } catch (error) {
          // Attach index to error for better debugging
          const err = error as Error;
          err.message = `Failed to generate audio ${index + 1}/${specs.length}: ${err.message}`;
          throw err;
        }
      })
    );

    // Wait for all tasks to complete
    await Promise.all(promises);

    return results;
  }
}
