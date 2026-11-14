/**
 * Unit tests for TextContentGenerator.
 *
 * @module generators/__tests__/TextContentGenerator.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TextContentGenerator } from '../TextContentGenerator';
import { TextProviderBase } from '../../providers/text/TextProvider';
import { TextGenerationSpec } from '../types';

describe('TextContentGenerator', () => {
  let generator: TextContentGenerator;
  let mockProvider: TextProviderBase;
  let mockPromptBuilder: {
    buildPrompt: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockProvider = {
      generate: vi.fn().mockResolvedValue({
        data: {
          text: 'Which one is an apple?'
        }
      })
    } as any;

    mockPromptBuilder = {
      buildPrompt: vi.fn().mockReturnValue({
        success: true,
        prompt: {
          prompt: 'Generate a question about fruits'
        }
      })
    };

    generator = new TextContentGenerator(mockProvider, mockPromptBuilder as any);
  });

  describe('generateQuestion', () => {
    it('should generate question text', async () => {
      const spec: TextGenerationSpec = {
        type: 'question',
        subject: 'fruits',
        language: 'en',
        difficulty: 'easy'
      };

      const result = await generator.generateQuestion(spec);

      expect(result).toBe('Which one is an apple?');
      expect(mockProvider.generate).toHaveBeenCalledWith({
        prompt: 'Generate a question about fruits',
        maxTokens: 100,
        temperature: 0.7,
        topP: 0.9,
        format: 'text'
      });
    });
    it('should use deterministic Romanian question text without calling provider', async () => {
      const spec: TextGenerationSpec = {
        type: 'question',
        subject: 'fruits',
        language: 'ro',
        difficulty: 'easy'
      };

      const result = await generator.generateQuestion(spec);

      expect(result).toBe('Care este fructul?');
      expect(result).not.toContain('Which one is');
      expect(mockPromptBuilder.buildPrompt).not.toHaveBeenCalled();
      expect(mockProvider.generate).not.toHaveBeenCalled();
    });

    it('should throw error if template not found', async () => {
      mockPromptBuilder.buildPrompt.mockReturnValueOnce({
        success: false,
        error: 'Question template not found'
      });

      const spec: TextGenerationSpec = {
        type: 'question',
        subject: 'fruits',
        language: 'en',
        difficulty: 'easy'
      };

      await expect(generator.generateQuestion(spec)).rejects.toThrow('Question template not found');
    });
  });

  describe('generateChoiceText', () => {
    it('should capitalize subject for choice text', async () => {
      const spec: TextGenerationSpec = {
        type: 'choice',
        subject: 'apple',
        language: 'en',
        difficulty: 'easy'
      };

      const result = await generator.generateChoiceText(spec);

      expect(result).toBe('Apple');
    });

    it('should use Romanian label for Romanian choice text', async () => {
      const spec: TextGenerationSpec = {
        type: 'choice',
        subject: 'apple',
        language: 'ro',
        difficulty: 'easy'
      };

      const result = await generator.generateChoiceText(spec);

      expect(result).toBe('mărul');
      expect(result).not.toBe('Apple');
    });

  });

  describe('generateFeedback', () => {
    it('should generate correct feedback', async () => {
      mockProvider.generate = vi.fn().mockResolvedValue({
        data: { text: 'Excellent! You got it right!' }
      });

      const result = await generator.generateFeedback(true, 'fruits');

      expect(result).toBe('Excellent! You got it right!');
      expect(mockProvider.generate).toHaveBeenCalledWith({
        prompt: 'Generate a question about fruits',
        maxTokens: 50,
        temperature: 0.8,
        topP: 0.9,
        format: 'text'
      });
    });

    it('should generate incorrect feedback', async () => {
      mockProvider.generate = vi.fn().mockResolvedValue({
        data: { text: 'Not quite, try again!' }
      });

      const result = await generator.generateFeedback(false, 'fruits');

      expect(result).toBe('Not quite, try again!');
    });

    it('should use deterministic Romanian feedback text without English templates', async () => {
      const correctResult = await generator.generateFeedback(true, 'apple', 'ro');
      const incorrectResult = await generator.generateFeedback(false, 'apple', 'ro');

      expect(correctResult).toBe('Bravo, ai găsit mărul!');
      expect(incorrectResult).toBe('Nu chiar, încearcă din nou!');
      expect(correctResult).not.toContain('Great job');
      expect(incorrectResult).not.toContain('Try again');
      expect(mockPromptBuilder.buildPrompt).not.toHaveBeenCalled();
      expect(mockProvider.generate).not.toHaveBeenCalled();
    });

    it('should return default feedback if template not found', async () => {
      mockPromptBuilder.buildPrompt.mockReturnValue({
        success: false,
        error: 'Template not found'
      });

      const correctResult = await generator.generateFeedback(true, 'fruits');
      const incorrectResult = await generator.generateFeedback(false, 'fruits');

      expect(correctResult).toBe('Great job!');
      expect(incorrectResult).toBe('Try again!');
    });
  });

  describe('generateBatch', () => {
    it('should generate multiple texts', async () => {
      const specs: TextGenerationSpec[] = [
        { type: 'question', subject: 'fruits', language: 'en', difficulty: 'easy' },
        { type: 'question', subject: 'animals', language: 'en', difficulty: 'easy' }
      ];

      const results = await generator.generateBatch(specs);

      expect(results).toHaveLength(2);
      expect(results[0]).toBe('Which one is an apple?');
      expect(mockProvider.generate).toHaveBeenCalledTimes(2);
    });

    it('should call onProgress callback', async () => {
      const specs: TextGenerationSpec[] = [
        { type: 'question', subject: 'fruits', language: 'en', difficulty: 'easy' },
        { type: 'question', subject: 'animals', language: 'en', difficulty: 'easy' }
      ];

      const onProgress = vi.fn();

      await generator.generateBatch(specs, { onProgress });

      expect(onProgress).toHaveBeenCalledWith(1, 2);
      expect(onProgress).toHaveBeenCalledWith(2, 2);
      expect(onProgress).toHaveBeenCalledTimes(2);
    });
  });
});
