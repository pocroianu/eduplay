/**
 * Deterministic text provider for simple educational game copy.
 *
 * This avoids requiring an external LLM for the current generation flow where
 * text needs are intentionally narrow: short identification questions and
 * encouraging feedback. It is not a general-purpose text model.
 */

import { v4 as uuid } from 'uuid';
import { TextProviderBase, TextRequest, TextRequestSchema, TextData, ModelInfo } from './TextProvider';
import { GenerationResult, BatchOptions, RequestMetadata } from '../base/types';
import { HealthCheckResult } from '../base/BaseProvider';

export class TemplateTextProvider extends TextProviderBase {
  constructor() {
    super({
      name: 'template-text',
      baseUrl: 'local://template-text',
      timeout: 5000,
      retries: 0,
      healthCheckInterval: 60000
    });
  }

  async generate(
    request: TextRequest,
    metadata?: Partial<RequestMetadata>
  ): Promise<GenerationResult<TextData>> {
    const validatedRequest = TextRequestSchema.parse(request);
    const text = this.renderText(validatedRequest.prompt);

    return {
      data: {
        text,
        tokensUsed: text.split(/\s+/).filter(Boolean).length,
        finishReason: 'stop'
      },
      metadata: {
        requestId: metadata?.requestId || uuid(),
        gameId: metadata?.gameId,
        questionId: metadata?.questionId,
        timestamp: new Date()
      },
      cached: false,
      latency: 0,
      provider: this.getName()
    };
  }

  async generateBatch(
    requests: TextRequest[],
    options?: BatchOptions,
    metadata?: Partial<RequestMetadata>
  ): Promise<GenerationResult<TextData>[]> {
    const results: GenerationResult<TextData>[] = [];

    for (let index = 0; index < requests.length; index++) {
      results.push(await this.generate(requests[index], metadata));
      options?.progressCallback?.(index + 1, requests.length);
    }

    return results;
  }

  async getModelInfo(): Promise<ModelInfo> {
    return {
      name: 'template-text',
      contextLength: 0,
      parameters: '0'
    };
  }

  protected async _doInit(): Promise<void> {
    // No external service to initialize.
  }

  protected async _doHealthCheck(): Promise<Omit<HealthCheckResult, 'latency' | 'timestamp'>> {
    return { healthy: true, message: 'Local deterministic templates available' };
  }

  protected async _doShutdown(): Promise<void> {
    // No-op.
  }

  private renderText(prompt: string): string {
    const normalizedPrompt = prompt.toLowerCase();

    if (normalizedPrompt.includes('incorrect answer')) {
      return 'Not quite, try again!';
    }

    const correctMatch = prompt.match(/correct\s+([a-z0-9 -]+?)\.?\s+be warm/i);
    if (correctMatch?.[1]) {
      return `Great job finding the ${correctMatch[1].trim()}!`;
    }

    const identifyMatch = prompt.match(/identify\s+(?:a|an|the)\s+([a-z]+)\b/i);
    if (identifyMatch?.[1]) {
      return `Which one is the ${identifyMatch[1].trim()}?`;
    }

    return 'Which one is correct?';
  }
}
