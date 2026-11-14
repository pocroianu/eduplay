/**
 * OllamaProvider - Text generation via Ollama REST API
 *
 * Uses Mistral 3 Small (24B params) for educational content generation.
 * Supports both streaming and non-streaming modes.
 *
 * API Reference: https://github.com/ollama/ollama/blob/main/docs/api.md
 */

import { z } from 'zod';
import {
  TextProviderBase,
  TextRequest,
  TextRequestSchema,
  TextData,
  ModelInfo
} from './TextProvider';
import { GenerationResult, BatchOptions, RequestMetadata } from '../base/types';
import {
  ProviderError,
  ProviderUnavailableError,
  ProviderTimeoutError,
  ModelNotFoundError
} from '../base/errors';
import { withTimeout } from '../utils/timeout';

/**
 * Ollama-specific configuration schema
 */
export const OllamaConfigSchema = z.object({
  name: z.string(),
  baseUrl: z.string().url(),
  timeout: z.number().min(1000).max(300000).default(120000), // 2 minutes
  retries: z.number().int().min(0).max(10).default(3),
  healthCheckInterval: z.number().min(1000).default(30000),
  model: z.string().default('mistral:small'),
  seed: z.number().int().optional(),
  keepAlive: z.string().default('5m'), // Keep model in memory
  streaming: z.boolean().default(false),
  numPredict: z.number().int().min(-2).default(500), // -1 = infinite, -2 = fill context
  numCtx: z.number().int().min(1).default(2048), // Context window
  repeatPenalty: z.number().min(0).default(1.1),
  presencePenalty: z.number().min(0).max(2).default(0),
  frequencyPenalty: z.number().min(0).max(2).default(0)
});

export type OllamaConfig = z.infer<typeof OllamaConfigSchema>;

/**
 * Ollama API response schemas
 */
const OllamaGenerateResponseSchema = z.object({
  model: z.string(),
  created_at: z.string(),
  response: z.string(),
  done: z.boolean(),
  context: z.array(z.number()).optional(),
  total_duration: z.number().optional(),
  load_duration: z.number().optional(),
  prompt_eval_count: z.number().optional(),
  prompt_eval_duration: z.number().optional(),
  eval_count: z.number().optional(),
  eval_duration: z.number().optional()
});

const OllamaModelInfoSchema = z.object({
  modelfile: z.string().optional(),
  parameters: z.string().optional(),
  template: z.string().optional(),
  details: z.object({
    parent_model: z.string().optional(),
    format: z.string().optional(),
    family: z.string().optional(),
    families: z.array(z.string()).optional(),
    parameter_size: z.string().optional(),
    quantization_level: z.string().optional()
  }).optional()
});

const OllamaModelsListSchema = z.object({
  models: z.array(z.object({
    name: z.string(),
    modified_at: z.string(),
    size: z.number(),
    digest: z.string(),
    details: z.object({
      format: z.string().optional(),
      family: z.string().optional(),
      parameter_size: z.string().optional()
    }).optional()
  }))
});

/**
 * OllamaProvider implementation for text generation.
 *
 * Features:
 * - Streaming and non-streaming generation
 * - Automatic model loading
 * - Keep-alive for hot models
 * - JSON mode support
 * - System prompts and few-shot learning
 * - Batch processing with concurrency control
 *
 * @example
 * ```typescript
 * const provider = new OllamaProvider({
 *   name: 'ollama',
 *   baseUrl: 'http://localhost:11434',
 *   model: 'mistral:small',
 *   timeout: 120000
 * });
 *
 * await provider.init();
 *
 * const result = await provider.generate({
 *   prompt: 'Generate a question about fruits for 5-year-olds',
 *   maxTokens: 100,
 *   temperature: 0.7
 * });
 *
 * console.log(result.data.text);
 * ```
 */
export class OllamaProvider extends TextProviderBase {
  protected readonly config: OllamaConfig;
  private modelLoaded: boolean = false;

  constructor(config: Partial<OllamaConfig>) {
    const validatedConfig = OllamaConfigSchema.parse(config);
    super({
      name: validatedConfig.name,
      baseUrl: validatedConfig.baseUrl,
      timeout: validatedConfig.timeout,
      retries: validatedConfig.retries,
      healthCheckInterval: validatedConfig.healthCheckInterval
    });
    this.config = validatedConfig;
  }

  /**
   * Initialize provider and pre-load model
   */
  protected async _doInit(): Promise<void> {
    try {
      // Check if Ollama is running
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(`${this.config.baseUrl}/api/tags`, {
          method: 'GET',
          signal: controller.signal
        });

        if (!response.ok) {
          throw new ProviderUnavailableError(this.config.name);
        }

        const data = await response.json();
        const models = OllamaModelsListSchema.parse(data);

        // Check if our model is available
        const modelExists = models.models.some(m => m.name === this.config.model);
        if (!modelExists) {
          throw new ModelNotFoundError(this.config.name, this.config.model);
        }

        // Pre-load the model by making a dummy request
        await this._preloadModel();

        this.modelLoaded = true;
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'TimeoutError' || error.message.includes('timeout') || error.message.includes('aborted')) {
          throw new ProviderTimeoutError(this.config.name, 5000, error);
        }
        if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
          throw new ProviderUnavailableError(this.config.name, error);
        }
      }

      throw new ProviderUnavailableError(this.config.name, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Health check - verify Ollama service and model availability
   */
  protected async _doHealthCheck(): Promise<{ healthy: boolean; message?: string; details?: Record<string, unknown> }> {
    try {
      // Check service availability
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return {
          healthy: false,
          message: `Ollama service returned ${response.status}`
        };
      }

      const data = await response.json();
      const models = OllamaModelsListSchema.parse(data);

      // Check if model is available
      const modelExists = models.models.some(m => m.name === this.config.model);
      if (!modelExists) {
        return {
          healthy: false,
          message: `Model ${this.config.model} not found`,
          details: {
            availableModels: models.models.map(m => m.name)
          }
        };
      }

      return {
        healthy: true,
        message: 'Ollama service and model available',
        details: {
          model: this.config.model,
          modelLoaded: this.modelLoaded,
          totalModels: models.models.length
        }
      };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown health check error'
      };
    }
  }

  /**
   * Shutdown - unload model if configured
   */
  protected async _doShutdown(): Promise<void> {
    // Ollama handles model lifecycle automatically
    // We just mark as not loaded
    this.modelLoaded = false;
  }

  /**
   * Generate text from prompt
   */
  async generate(
    request: TextRequest,
    metadata?: Partial<RequestMetadata>
  ): Promise<GenerationResult<TextData>> {
    // Validate request
    const validatedRequest = TextRequestSchema.parse(request);

    const requestMetadata: RequestMetadata = {
      requestId: metadata?.requestId || crypto.randomUUID(),
      gameId: metadata?.gameId,
      questionId: metadata?.questionId,
      timestamp: new Date()
    };

    this.emit('request:start', { provider: this.config.name, metadata: requestMetadata });

    const startTime = Date.now();

    try {
      // Build Ollama request
      const ollamaRequest = this._buildOllamaRequest(validatedRequest);

      // Make request with timeout
      const response = await withTimeout(
        fetch(`${this.config.baseUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ollamaRequest)
        }),
        this.config.timeout,
        `Ollama text generation timeout after ${this.config.timeout}ms`
      );

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`Ollama API error ${response.status}: ${errorText}`);
        throw new ProviderError(
          `Ollama API error ${response.status}: ${errorText}`,
          this.config.name,
          'API_ERROR',
          false,
          error
        );
      }

      // Handle streaming vs non-streaming
      let fullText = '';
      let evalCount = 0;

      if (this.config.streaming) {
        // Read streaming response
        const reader = response.body?.getReader();
        if (!reader) {
          throw new ProviderError('No response body for streaming', this.config.name, 'NO_BODY');
        }

        const decoder = new TextDecoder();
        let done = false;

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;

          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim());

            for (const line of lines) {
              try {
                const data = JSON.parse(line);
                const parsed = OllamaGenerateResponseSchema.parse(data);
                fullText += parsed.response;

                if (parsed.done) {
                  evalCount = parsed.eval_count || 0;
                }
              } catch {
                // Skip invalid JSON lines
              }
            }
          }
        }
      } else {
        // Non-streaming response
        const data = await response.json();
        const parsed = OllamaGenerateResponseSchema.parse(data);
        fullText = parsed.response;
        evalCount = parsed.eval_count || 0;
      }

      const duration = Date.now() - startTime;

      // Determine finish reason
      let finishReason: 'stop' | 'length' | 'content_filter' = 'stop';
      if (evalCount >= validatedRequest.maxTokens) {
        finishReason = 'length';
      }

      const result: GenerationResult<TextData> = {
        data: {
          text: fullText.trim(),
          tokensUsed: evalCount,
          finishReason
        },
        metadata: requestMetadata,
        latency: duration,
        cached: false
      };

      this.recordRequest(true, duration);
      this.emit('request:success', { provider: this.config.name, metadata: requestMetadata, duration });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordRequest(false, duration);

      if (error instanceof ProviderError) {
        this.emit('request:error', { provider: this.config.name, error, metadata: requestMetadata });
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
          const timeoutError = new ProviderTimeoutError(this.config.name, this.config.timeout, error);
          this.emit('request:error', { provider: this.config.name, error: timeoutError, metadata: requestMetadata });
          throw timeoutError;
        }
      }

      const providerError = new ProviderError(
        error instanceof Error ? error.message : 'Unknown error during text generation',
        this.config.name,
        'GENERATION_ERROR',
        false,
        error instanceof Error ? error : undefined
      );
      this.emit('request:error', { provider: this.config.name, error: providerError, metadata: requestMetadata });
      throw providerError;
    }
  }

  /**
   * Generate multiple texts in batch with concurrency control
   */
  async generateBatch(
    requests: TextRequest[],
    options: BatchOptions = {},
    metadata?: Partial<RequestMetadata>
  ): Promise<GenerationResult<TextData>[]> {
    const { concurrency = 3, stopOnError = false, progressCallback } = options;

    const results: GenerationResult<TextData>[] = [];
    const errors: Error[] = [];

    // Process in batches
    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency);
      const batchPromises = batch.map(request =>
        this.generate(request, metadata).catch(error => {
          errors.push(error);
          if (stopOnError) throw error;
          return null;
        })
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter((r): r is GenerationResult<TextData> => r !== null));

      if (progressCallback) {
        progressCallback(Math.min(i + concurrency, requests.length), requests.length);
      }
    }

    if (errors.length > 0 && stopOnError) {
      throw new ProviderError(
        `Batch generation failed: ${errors.length} errors occurred`,
        this.config.name,
        'BATCH_ERROR'
      );
    }

    return results;
  }

  /**
   * Get model information
   */
  async getModelInfo(): Promise<ModelInfo> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.config.baseUrl}/api/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: this.config.model }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new ProviderError(
          `Failed to get model info: ${response.status}`,
          this.config.name,
          'MODEL_INFO_ERROR'
        );
      }

      const data = await response.json();
      const parsed = OllamaModelInfoSchema.parse(data);

      return {
        name: this.config.model,
        contextLength: this.config.numCtx,
        parameters: parsed.details?.parameter_size || 'unknown'
      };
    } catch (error) {
      throw new ProviderError(
        error instanceof Error ? error.message : 'Failed to get model info',
        this.config.name,
        'MODEL_INFO_ERROR',
        false,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Pre-load model into memory
   */
  private async _preloadModel(): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      await fetch(`${this.config.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          prompt: 'Hello',
          stream: false,
          options: {
            num_predict: 1
          }
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Build Ollama API request from TextRequest
   */
  private _buildOllamaRequest(request: TextRequest): Record<string, unknown> {
    const ollamaRequest: Record<string, unknown> = {
      model: this.config.model,
      prompt: request.prompt,
      stream: this.config.streaming,
      options: {
        num_predict: request.maxTokens,
        temperature: request.temperature,
        top_p: request.topP,
        num_ctx: this.config.numCtx,
        repeat_penalty: this.config.repeatPenalty,
        presence_penalty: this.config.presencePenalty,
        frequency_penalty: this.config.frequencyPenalty
      },
      keep_alive: this.config.keepAlive
    };

    // Add system prompt if provided
    if (request.systemPrompt) {
      ollamaRequest.system = request.systemPrompt;
    }

    // Add stop sequences if provided
    if (request.stopSequences && request.stopSequences.length > 0) {
      (ollamaRequest.options as Record<string, unknown>).stop = request.stopSequences;
    }

    // Add format for JSON mode
    if (request.format === 'json') {
      ollamaRequest.format = 'json';
      if (request.jsonSchema) {
        ollamaRequest.schema = request.jsonSchema;
      }
    }

    // Add seed if configured
    if (this.config.seed !== undefined) {
      (ollamaRequest.options as Record<string, unknown>).seed = this.config.seed;
    }

    return ollamaRequest;
  }
}
