import { z } from 'zod';
import { BaseProvider } from '../base/BaseProvider';
import { GenerationResult, BatchOptions, RequestMetadata } from '../base/types';

/**
 * Text generation request schema
 */
export const TextRequestSchema = z.object({
  prompt: z.string().min(1).max(10000),
  systemPrompt: z.string().optional(),
  maxTokens: z.number().int().min(1).max(4096).default(500),
  temperature: z.number().min(0).max(2).default(0.7),
  topP: z.number().min(0).max(1).default(0.9),
  stopSequences: z.array(z.string()).optional(),
  format: z.enum(['text', 'json']).default('text'),
  jsonSchema: z.record(z.unknown()).optional()
});

export type TextRequest = z.infer<typeof TextRequestSchema>;

/**
 * Generated text data
 */
export interface TextData {
  text: string;
  tokensUsed: number;
  finishReason: 'stop' | 'length' | 'content_filter';
}

/**
 * Text provider interface.
 * Implementations: TemplateTextProvider, OllamaProvider, OpenAIProvider (future)
 */
export interface ITextProvider {
  /**
   * Generate text from prompt.
   */
  generate(
    request: TextRequest,
    metadata?: Partial<RequestMetadata>
  ): Promise<GenerationResult<TextData>>;

  /**
   * Generate multiple texts in batch.
   */
  generateBatch(
    requests: TextRequest[],
    options?: BatchOptions,
    metadata?: Partial<RequestMetadata>
  ): Promise<GenerationResult<TextData>[]>;

  /**
   * Get model information.
   */
  getModelInfo(): Promise<{
    name: string;
    contextLength: number;
    parameters: string;
  }>;
}

/**
 * Abstract base for text providers.
 */
export abstract class TextProviderBase extends BaseProvider implements ITextProvider {
  abstract generate(
    request: TextRequest,
    metadata?: Partial<RequestMetadata>
  ): Promise<GenerationResult<TextData>>;

  abstract generateBatch(
    requests: TextRequest[],
    options?: BatchOptions,
    metadata?: Partial<RequestMetadata>
  ): Promise<GenerationResult<TextData>[]>;

  abstract getModelInfo(): Promise<{
    name: string;
    contextLength: number;
    parameters: string;
  }>;
}
