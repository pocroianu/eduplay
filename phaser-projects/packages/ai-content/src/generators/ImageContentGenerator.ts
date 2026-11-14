/**
 * Generates images for game content using trained LoRAs.
 *
 * @module generators/ImageContentGenerator
 */

import { ImageGenerationSpec, BatchGenerationOptions } from './types';
import { ImageProviderBase } from '../providers/image/ImageProvider';
import { PromptBuilder } from '../training/PromptBuilder';
import { getPromptById } from '../training/PromptTemplates';
import type { PromptTemplate } from '../training/types';

/**
 * Generates images for game content using trained LoRAs.
 */
export class ImageContentGenerator {
  private usedProviders: Set<string> = new Set();

  constructor(
    private provider: ImageProviderBase,
    private promptBuilder: PromptBuilder
  ) {}

  /**
   * Generate a single image
   */
  async generate(spec: ImageGenerationSpec): Promise<{
    buffer: Buffer;
    width: number;
    height: number;
    provider: string;
    providerDetails?: Record<string, unknown>;
  }> {
    const request = this.buildRequest(spec);
    const result = await this.provider.generate(request);

    this.usedProviders.add(result.provider || this.provider.getName());

    return {
      buffer: result.data.buffer,
      width: result.data.width,
      height: result.data.height,
      provider: result.provider || this.provider.getName(),
      providerDetails: result.providerDetails
    };
  }

  /**
   * Generate multiple images in batch.
   * Batch routing now lives inside the provider layer so fallback decisions
   * stay consistent for the full committed output.
   */
  async generateBatch(
    specs: ImageGenerationSpec[],
    options?: BatchGenerationOptions
  ): Promise<Array<{
    buffer: Buffer;
    width: number;
    height: number;
    provider: string;
    providerDetails?: Record<string, unknown>;
  }>> {
    if (specs.length === 0) {
      return [];
    }

    this.usedProviders.clear();

    const requests = specs.map((spec) => this.buildRequest(spec));
    const results = await this.provider.generateBatch(requests, {
      concurrency: options?.concurrency,
      progressCallback: options?.onProgress
    });

    for (const result of results) {
      this.usedProviders.add(result.provider || this.provider.getName());
    }

    return results.map((result) => ({
      buffer: result.data.buffer,
      width: result.data.width,
      height: result.data.height,
      provider: result.provider || this.provider.getName(),
      providerDetails: result.providerDetails
    }));
  }

  private selectPromptTemplate(category: string, style: string): string {
    const templateMap: Record<string, Record<string, string>> = {
      fruits: {
        'cartoon-friendly': 'fruit-cartoon-simple',
        kawaii: 'fruit-cartoon-with-face'
      },
      animals: {
        'cartoon-friendly': 'animal-cartoon-simple'
      },
      colors: {
        'flat-simple': 'color-object-simple'
      },
      shapes: {
        'geometric-simple': 'shape-basic-colored'
      }
    };

    return templateMap[category]?.[style] || 'fruit-cartoon-simple';
  }

  getUsedProviders(): string[] {
    return Array.from(this.usedProviders);
  }

  private buildRequest(spec: ImageGenerationSpec): {
    prompt: string;
    negativePrompt?: string;
    width: number;
    height: number;
    lora?: string;
    seed?: number;
  } {
    const templateId = this.selectPromptTemplate(spec.category, spec.style);
    const template = getPromptById(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const builtPrompt = this.promptBuilder.buildPrompt(
      templateId,
      this.buildPromptVariables(template, spec.subject)
    );

    if (!builtPrompt.success || !builtPrompt.prompt) {
      throw new Error(builtPrompt.error || 'Failed to build image prompt');
    }

    return {
      prompt: builtPrompt.prompt.prompt,
      negativePrompt: builtPrompt.prompt.negativePrompt,
      width: 512,
      height: 512,
      lora: spec.loraModel,
      seed: spec.seed
    };
  }

  private buildPromptVariables(
    template: PromptTemplate,
    subject: string
  ): Record<string, string> {
    const subjectVariableNames = new Set([
      'subject',
      'item',
      'fruit',
      'animal',
      'shape',
      'color',
      'letter',
      'word',
      'number'
    ]);

    return Object.fromEntries(
      template.variables.map((variable) => {
        if (subjectVariableNames.has(variable.name)) {
          return [variable.name, subject];
        }

        if (variable.default !== undefined) {
          return [variable.name, String(variable.default)];
        }

        if (variable.options && variable.options.length > 0) {
          return [variable.name, variable.options[0]];
        }

        return [variable.name, subject];
      })
    );
  }
}
