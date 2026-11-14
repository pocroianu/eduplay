/**
 * Image provider interface and types
 */

import { z } from 'zod';
import { BaseProvider } from '../base/BaseProvider';
import { GenerationResult, BatchOptions, RequestMetadata } from '../base/types';

/**
 * Image generation request schema
 */
export const ImageRequestSchema = z.object({
  prompt: z.string().min(1).max(2000),
  negativePrompt: z.string().optional(),
  width: z.number().int().min(256).max(2048).default(512),
  height: z.number().int().min(256).max(2048).default(512),
  seed: z.number().int().optional(),
  steps: z.number().int().min(1).max(150).optional(),
  cfgScale: z.number().min(1).max(30).optional(),
  style: z.enum(['cartoon', 'realistic', 'flat', 'watercolor']).optional(),
  lora: z.string().optional()
});

export type ImageRequest = z.infer<typeof ImageRequestSchema>;

export interface ImageProviderSupport {
  supported: boolean;
  reason?: string;
}

/**
 * Generated image data
 */
export interface ImageData {
  buffer: Buffer;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  width: number;
  height: number;
  seed: number;
}

/**
 * Image provider interface.
 * Implementations: ComfyUIProvider, StabilityAPIProvider (future)
 */
export interface IImageProvider {
  /**
   * Generate a single image from prompt.
   */
  generate(
    request: ImageRequest,
    metadata?: Partial<RequestMetadata>
  ): Promise<GenerationResult<ImageData>>;

  /**
   * Generate multiple images in batch.
   */
  generateBatch(
    requests: ImageRequest[],
    options?: BatchOptions,
    metadata?: Partial<RequestMetadata>
  ): Promise<GenerationResult<ImageData>[]>;

  /**
   * Get supported styles for this provider.
   */
  getSupportedStyles(): string[];

  /**
   * Get available LoRA models.
   */
  getAvailableLoras(): Promise<string[]>;

  /**
   * Check whether a request is supported before generation starts.
   */
  supportsRequest(request: ImageRequest): ImageProviderSupport;
}

/**
 * Abstract base for image providers.
 * Extends BaseProvider with image generation capabilities.
 */
export abstract class ImageProviderBase extends BaseProvider implements IImageProvider {
  abstract generate(
    request: ImageRequest,
    metadata?: Partial<RequestMetadata>
  ): Promise<GenerationResult<ImageData>>;

  abstract generateBatch(
    requests: ImageRequest[],
    options?: BatchOptions,
    metadata?: Partial<RequestMetadata>
  ): Promise<GenerationResult<ImageData>[]>;

  abstract getSupportedStyles(): string[];

  abstract getAvailableLoras(): Promise<string[]>;

  supportsRequest(_request: ImageRequest): ImageProviderSupport {
    return { supported: true };
  }
}
