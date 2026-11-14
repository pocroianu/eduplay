/**
 * Unit tests for ImageContentGenerator.
 *
 * @module generators/__tests__/ImageContentGenerator.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageContentGenerator } from '../ImageContentGenerator';
import { ImageProviderBase } from '../../providers/image/ImageProvider';
import { ImageGenerationSpec } from '../types';
import { PromptBuilder } from '../../training/PromptBuilder';

describe('ImageContentGenerator', () => {
  let generator: ImageContentGenerator;
  let mockProvider: ImageProviderBase;
  let mockPromptBuilder: {
    buildPrompt: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockProvider = {
      generate: vi.fn().mockResolvedValue({
        data: {
          buffer: Buffer.from('test-image'),
          width: 512,
          height: 512
        },
        provider: 'qwen'
      }),
      generateBatch: vi.fn().mockImplementation(
        async (
          requests,
          options?: { progressCallback?: (completed: number, total: number) => void }
        ) => {
          options?.progressCallback?.(1, requests.length);
          options?.progressCallback?.(requests.length, requests.length);
          return requests.map((request, index) => ({
            data: {
              buffer: Buffer.from(`image-${index}`),
              width: request.width,
              height: request.height
            },
            provider: 'qwen',
            providerDetails: {
              route: 'primary-batch'
            }
          }));
        }
      ),
      getName: vi.fn().mockReturnValue('mock-image')
    } as any;

    mockPromptBuilder = {
      buildPrompt: vi.fn().mockReturnValue({
        success: true,
        prompt: {
          prompt: 'A cartoon apple',
          negativePrompt: 'bad quality'
        }
      })
    };

    generator = new ImageContentGenerator(mockProvider, mockPromptBuilder as any);
  });

  describe('generate', () => {
    it('should generate a single image', async () => {
      const spec: ImageGenerationSpec = {
        subject: 'apple',
        category: 'fruits',
        style: 'cartoon-friendly',
        loraModel: 'fruits-lora'
      };

      const result = await generator.generate(spec);

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.provider).toBe('qwen');
      expect(mockProvider.generate).toHaveBeenCalledWith({
        prompt: 'A cartoon apple',
        negativePrompt: 'bad quality',
        width: 512,
        height: 512,
        lora: 'fruits-lora',
        seed: undefined
      });
    });

    it('should use seed if provided', async () => {
      const spec: ImageGenerationSpec = {
        subject: 'apple',
        category: 'fruits',
        style: 'cartoon-friendly',
        seed: 42
      };

      await generator.generate(spec);

      expect(mockProvider.generate).toHaveBeenCalledWith(
        expect.objectContaining({ seed: 42 })
      );
    });

    it('should throw error if prompt building fails', async () => {
      const spec: ImageGenerationSpec = {
        subject: 'apple',
        category: 'fruits',
        style: 'cartoon-friendly'
      };

      mockPromptBuilder.buildPrompt.mockReturnValueOnce({
        success: false,
        error: 'Failed to build image prompt'
      });

      await expect(generator.generate(spec)).rejects.toThrow('Failed to build image prompt');
    });

    it('maps the animal subject into the real prompt template variables', async () => {
      const provider = {
        generate: vi.fn().mockResolvedValue({
          data: {
            buffer: Buffer.from('test-image'),
            width: 512,
            height: 512
          },
          provider: 'qwen'
        }),
        getName: vi.fn().mockReturnValue('qwen')
      } as any as ImageProviderBase;

      const realGenerator = new ImageContentGenerator(provider, new PromptBuilder());

      await realGenerator.generate({
        subject: 'elephant',
        category: 'animals',
        style: 'cartoon-friendly',
        loraModel: 'animals-bulk_20260327_143605.safetensors'
      });

      expect(provider.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('elephant'),
          lora: 'animals-bulk_20260327_143605.safetensors'
        })
      );
    });
  });

  describe('generateBatch', () => {
    it('delegates the full batch to the provider and preserves provider info', async () => {
      const specs: ImageGenerationSpec[] = [
        { subject: 'apple', category: 'fruits', style: 'cartoon-friendly' },
        { subject: 'banana', category: 'fruits', style: 'cartoon-friendly' }
      ];

      const results = await generator.generateBatch(specs);

      expect(results).toHaveLength(2);
      expect(mockProvider.generateBatch).toHaveBeenCalledTimes(1);
      expect(results[0].provider).toBe('qwen');
      expect(results[0].providerDetails).toEqual({ route: 'primary-batch' });
      expect(generator.getUsedProviders()).toEqual(['qwen']);
    });

    it('wires the batch progress callback through the provider', async () => {
      const specs: ImageGenerationSpec[] = [
        { subject: 'apple', category: 'fruits', style: 'cartoon-friendly' },
        { subject: 'banana', category: 'fruits', style: 'cartoon-friendly' }
      ];

      const onProgress = vi.fn();

      await generator.generateBatch(specs, { onProgress, concurrency: 2 });

      expect(mockProvider.generateBatch).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          concurrency: 2,
          progressCallback: onProgress
        })
      );
      expect(onProgress).toHaveBeenCalledWith(1, 2);
      expect(onProgress).toHaveBeenCalledWith(2, 2);
    });
  });
});
