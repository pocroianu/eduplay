/**
 * Generates text content (questions, choices, feedback).
 *
 * @module generators/TextContentGenerator
 */

import PQueue from 'p-queue';
import { TextGenerationSpec, BatchGenerationOptions } from './types';
import { TextProviderBase } from '../providers/text/TextProvider';
import { PromptBuilder } from '../training/PromptBuilder';

const ROMANIAN_LABELS: Record<string, string> = {
  fruits: 'fructul',
  fruit: 'fructul',
  animals: 'animalul',
  animal: 'animalul',
  colors: 'culoarea',
  color: 'culoarea',
  shapes: 'forma',
  shape: 'forma',
  apple: 'mărul',
  banana: 'banana',
  orange: 'portocala',
  grape: 'strugurele',
  strawberry: 'căpșuna',
  watermelon: 'pepenele',
  dog: 'câinele',
  cat: 'pisica',
  rabbit: 'iepurele',
  bird: 'pasărea',
  fish: 'peștele',
  elephant: 'elefantul',
  red: 'roșu',
  blue: 'albastru',
  yellow: 'galben',
  green: 'verde',
  purple: 'mov',
  circle: 'cercul',
  square: 'pătratul',
  triangle: 'triunghiul',
  rectangle: 'dreptunghiul',
  star: 'steaua',
  heart: 'inima'
};

/**
 * Generates text content (questions, choices, feedback).
 */
export class TextContentGenerator {
  constructor(
    private provider: TextProviderBase,
    private promptBuilder: PromptBuilder
  ) {}

  getProviderName(): string {
    return this.provider.getName();
  }

  /**
   * Generate question text
   */
  async generateQuestion(spec: TextGenerationSpec): Promise<string> {
    const category = this.normalizeCategory(spec.subject);
    if (spec.language === 'ro') {
      return `Care este ${this.getRomanianLabel(category)}?`;
    }

    const builtPrompt = this.promptBuilder.buildPrompt('question-identification-simple', {
      category,
      difficulty: spec.difficulty,
      targetAge: '3-8',
      item: category
    });

    if (!builtPrompt.success || !builtPrompt.prompt) {
      throw new Error(builtPrompt.error || 'Question template not found');
    }

    const result = await this.provider.generate({
      prompt: builtPrompt.prompt.prompt,
      maxTokens: 100,
      temperature: 0.7,
      topP: 0.9,
      format: 'text'
    });

    return result.data.text.trim();
  }

  /**
   * Generate choice text
   */
  async generateChoiceText(spec: TextGenerationSpec): Promise<string> {
    if (spec.language === 'ro') {
      return this.getRomanianLabel(spec.subject);
    }

    // For simple categories, just return the subject
    return spec.subject.charAt(0).toUpperCase() + spec.subject.slice(1);
  }

  /**
   * Generate feedback text
   */
  async generateFeedback(correct: boolean, subject: string, language = 'en'): Promise<string> {
    if (language === 'ro') {
      return correct
        ? `Bravo, ai găsit ${this.getRomanianLabel(subject)}!`
        : 'Nu chiar, încearcă din nou!';
    }

    const templateId = correct
      ? 'feedback-correct-specific'
      : 'feedback-incorrect-gentle';
    const builtPrompt = correct
      ? this.promptBuilder.buildPrompt(templateId, { item: subject })
      : this.promptBuilder.buildPrompt(templateId, {});

    if (!builtPrompt.success || !builtPrompt.prompt) {
      return correct ? 'Great job!' : 'Try again!';
    }

    const result = await this.provider.generate({
      prompt: builtPrompt.prompt.prompt,
      maxTokens: 50,
      temperature: 0.8,
      topP: 0.9,
      format: 'text'
    });

    return result.data.text.trim();
  }

  /**
   * Generate multiple texts in batch with concurrent processing
   */
  async generateBatch(
    specs: TextGenerationSpec[],
    options?: BatchGenerationOptions
  ): Promise<string[]> {
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
    const results: string[] = new Array(specs.length);

    // Queue all generation tasks
    const promises = specs.map((spec, index) =>
      queue.add(async () => {
        try {
          const text = await this.generateQuestion(spec);

          // Store result at correct index to maintain order
          results[index] = text;

          // Update progress
          completed++;
          if (options?.onProgress) {
            options.onProgress(completed, specs.length);
          }

          return results[index];
        } catch (error) {
          // Attach index to error for better debugging
          const err = error as Error;
          err.message = `Failed to generate text ${index + 1}/${specs.length}: ${err.message}`;
          throw err;
        }
      })
    );

    // Wait for all tasks to complete
    await Promise.all(promises);

    return results;
  }

  private normalizeCategory(subject: string): string {
    const normalized = subject.toLowerCase();
    const categoryMap: Record<string, string> = {
      fruits: 'fruit',
      fruit: 'fruit',
      animals: 'animal',
      animal: 'animal',
      colors: 'color',
      color: 'color',
      shapes: 'shape',
      shape: 'shape',
      numbers: 'number',
      number: 'number',
      objects: 'object',
      object: 'object',
      letters: 'letter',
      letter: 'letter'
    };

    return categoryMap[normalized] || 'object';
  }

  private getRomanianLabel(subject: string): string {
    return ROMANIAN_LABELS[subject.toLowerCase()] || subject;
  }
}
