/**
 * Unit tests for AudioContentGenerator.
 *
 * @module generators/__tests__/AudioContentGenerator.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioContentGenerator } from '../AudioContentGenerator';
import { AudioProviderBase } from '../../providers/audio/AudioProvider';
import { AudioGenerationSpec } from '../types';

describe('AudioContentGenerator', () => {
  let generator: AudioContentGenerator;
  let mockProvider: AudioProviderBase;

  beforeEach(() => {
    mockProvider = {
      generate: vi.fn().mockResolvedValue({
        data: {
          buffer: Buffer.from('test-audio'),
          duration: 3
        }
      })
    } as any;

    generator = new AudioContentGenerator(mockProvider);
  });

  describe('generate', () => {
    it('should generate audio from text', async () => {
      const spec: AudioGenerationSpec = {
        text: 'Which one is an apple?',
        language: 'en',
        voice: 'en-us-amy',
        speed: 1.0
      };

      const result = await generator.generate(spec);

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.duration).toBe(3);
      expect(mockProvider.generate).toHaveBeenCalledWith({
        text: 'Which one is an apple?',
        language: 'en',
        voice: 'en-us-amy',
        speed: 1.0,
        pitch: 1.0,
        format: 'mp3'
      });
    });

    it('should use default speed if not provided', async () => {
      const spec: AudioGenerationSpec = {
        text: 'Which one is an apple?',
        language: 'en'
      };

      const result = await generator.generate(spec);

      expect(result.duration).toBe(3);
      expect(mockProvider.generate).toHaveBeenCalledWith(
        expect.objectContaining({ speed: 1.0 })
      );
    });

    it('should handle missing duration from provider', async () => {
      mockProvider.generate = vi.fn().mockResolvedValue({
        data: {
          buffer: Buffer.from('test-audio'),
          duration: undefined
        }
      }) as any;

      const spec: AudioGenerationSpec = {
        text: 'Test question?',
        language: 'en'
      };

      const result = await generator.generate(spec);

      expect(result.duration).toBe(0);
    });
  });

  describe('generateBatch', () => {
    it('should generate multiple audio files with concurrent processing', async () => {
      const specs: AudioGenerationSpec[] = [
        { text: 'Question 1?', language: 'en' },
        { text: 'Question 2?', language: 'en' }
      ];

      const results = await generator.generateBatch(specs);

      expect(results).toHaveLength(2);
      expect(results[0].buffer).toBeInstanceOf(Buffer);
      expect(results[0].duration).toBe(3);
      expect(results[1].duration).toBe(3);
      expect(mockProvider.generate).toHaveBeenCalledTimes(2);
    });

    it('should handle empty array', async () => {
      const results = await generator.generateBatch([]);

      expect(results).toHaveLength(0);
      expect(mockProvider.generate).not.toHaveBeenCalled();
    });

    it('should call onProgress callback', async () => {
      const specs: AudioGenerationSpec[] = [
        { text: 'Question 1?', language: 'en' },
        { text: 'Question 2?', language: 'en' }
      ];

      const onProgress = vi.fn();

      await generator.generateBatch(specs, { onProgress });

      expect(onProgress).toHaveBeenCalledWith(1, 2);
      expect(onProgress).toHaveBeenCalledWith(2, 2);
      expect(onProgress).toHaveBeenCalledTimes(2);
    });

    it('should handle different languages', async () => {
      const specs: AudioGenerationSpec[] = [
        { text: 'Which one is an apple?', language: 'en' },
        { text: 'Care este un măr?', language: 'ro' }
      ];

      await generator.generateBatch(specs);

      expect(mockProvider.generate).toHaveBeenCalledWith(
        expect.objectContaining({ language: 'en' })
      );
      expect(mockProvider.generate).toHaveBeenCalledWith(
        expect.objectContaining({ language: 'ro' })
      );
    });

    it('should maintain result order with concurrent processing', async () => {
      // Mock provider to return different durations
      let callCount = 0;
      mockProvider.generate = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          data: {
            buffer: Buffer.from(`audio-${callCount}`),
            duration: callCount
          }
        });
      }) as any;

      const specs: AudioGenerationSpec[] = [
        { text: 'Question 1?', language: 'en' },
        { text: 'Question 2?', language: 'en' },
        { text: 'Question 3?', language: 'en' }
      ];

      const results = await generator.generateBatch(specs);

      // Results should be in the same order as specs
      expect(results[0].buffer.toString()).toBe('audio-1');
      expect(results[0].duration).toBe(1);
      expect(results[1].buffer.toString()).toBe('audio-2');
      expect(results[1].duration).toBe(2);
      expect(results[2].buffer.toString()).toBe('audio-3');
      expect(results[2].duration).toBe(3);
    });

    it('should enhance error messages with index', async () => {
      mockProvider.generate = vi.fn()
        .mockResolvedValueOnce({
          data: { buffer: Buffer.from('audio-1'), duration: 1 }
        })
        .mockRejectedValueOnce(new Error('Generation failed'))
        .mockResolvedValueOnce({
          data: { buffer: Buffer.from('audio-3'), duration: 3 }
        }) as any;

      const specs: AudioGenerationSpec[] = [
        { text: 'Question 1?', language: 'en' },
        { text: 'Question 2?', language: 'en' },
        { text: 'Question 3?', language: 'en' }
      ];

      await expect(generator.generateBatch(specs)).rejects.toThrow(
        /Failed to generate audio 2\/3/
      );
    });

    it('should respect custom concurrency option', async () => {
      const specs: AudioGenerationSpec[] = [
        { text: 'Question 1?', language: 'en' },
        { text: 'Question 2?', language: 'en' },
        { text: 'Question 3?', language: 'en' }
      ];

      await generator.generateBatch(specs, { concurrency: 1 });

      // With concurrency=1, calls should be sequential
      expect(mockProvider.generate).toHaveBeenCalledTimes(3);
    });
  });
});
