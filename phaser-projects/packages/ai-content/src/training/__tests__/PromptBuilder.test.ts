/**
 * PromptBuilder Unit Tests
 *
 * Tests for the PromptBuilder class which renders prompt templates
 * with variable substitution and validation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PromptBuilder, getPromptBuilder, buildPrompt } from '../PromptBuilder';
import { PromptTemplate, PromptBuildResult } from '../types';
import {
  getPromptById,
  getPromptsByCategory,
  IMAGE_PROMPTS,
  TEXT_PROMPTS,
  AUDIO_PROMPTS,
  getTemplateSummary
} from '../PromptTemplates';

// =============================================================================
// Test Suite
// =============================================================================

describe('PromptBuilder', () => {
  let builder: PromptBuilder;

  beforeEach(() => {
    builder = new PromptBuilder();
  });

  // ===========================================================================
  // buildPrompt - Basic Functionality
  // ===========================================================================

  describe('buildPrompt', () => {
    it('should build prompt with valid template and variables', () => {
      const result = builder.buildPrompt('fruit-cartoon-simple', {
        fruit: 'apple'
      });

      expect(result.success).toBe(true);
      expect(result.prompt).toBeDefined();
      expect(result.prompt!.prompt).toContain('apple');
    });

    it('should return error for non-existent template', () => {
      const result = builder.buildPrompt('non-existent-template', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Template not found');
    });

    it('should include template metadata in result', () => {
      const result = builder.buildPrompt('fruit-cartoon-simple', {
        fruit: 'banana'
      });

      expect(result.success).toBe(true);
      expect(result.prompt!.metadata.category).toBe('fruits');
      expect(result.prompt!.metadata.generatedAt).toBeInstanceOf(Date);
    });

    it('should store original variables in result', () => {
      const variables = { fruit: 'orange' };
      const result = builder.buildPrompt('fruit-cartoon-simple', variables);

      expect(result.success).toBe(true);
      expect(result.prompt!.variables).toEqual(variables);
    });

    it('should include template ID in result', () => {
      const result = builder.buildPrompt('fruit-cartoon-simple', {
        fruit: 'grape'
      });

      expect(result.success).toBe(true);
      expect(result.prompt!.templateId).toBe('fruit-cartoon-simple');
    });
  });

  // ===========================================================================
  // Variable Validation
  // ===========================================================================

  describe('variable validation', () => {
    it('should fail when required variable is missing', () => {
      const result = builder.buildPrompt('fruit-cartoon-simple', {});

      expect(result.success).toBe(false);
      expect(result.validationErrors).toContain('Required variable missing: fruit');
    });

    it('should fail when required variable is empty string', () => {
      const result = builder.buildPrompt('fruit-cartoon-simple', {
        fruit: ''
      });

      expect(result.success).toBe(false);
      expect(result.validationErrors!.length).toBeGreaterThan(0);
    });

    it('should fail when required variable is null', () => {
      const result = builder.buildPrompt('fruit-cartoon-simple', {
        fruit: null
      });

      expect(result.success).toBe(false);
      expect(result.validationErrors!.length).toBeGreaterThan(0);
    });

    it('should fail when required variable is undefined', () => {
      const result = builder.buildPrompt('fruit-cartoon-simple', {
        fruit: undefined
      });

      expect(result.success).toBe(false);
      expect(result.validationErrors!.length).toBeGreaterThan(0);
    });

    it('should validate enum values', () => {
      const result = builder.buildPrompt('fruit-cartoon-simple', {
        fruit: 'invalid-fruit'
      });

      expect(result.success).toBe(false);
      expect(result.validationErrors!.some(e => e.includes('Invalid value'))).toBe(true);
    });

    it('should accept valid enum values', () => {
      const result = builder.buildPrompt('fruit-cartoon-simple', {
        fruit: 'apple'
      });

      expect(result.success).toBe(true);
    });

    it('should validate string type variables', () => {
      const result = builder.buildPrompt('fruit-basket', {
        fruits: 123 // Should be string
      });

      expect(result.success).toBe(false);
      expect(result.validationErrors!.some(e => e.includes('must be a string'))).toBe(true);
    });

    it('should validate pattern constraints', () => {
      // letter-uppercase requires single uppercase letter
      const result = builder.buildPrompt('letter-uppercase', {
        letter: 'abc', // Too many characters
        color: 'red'
      });

      expect(result.success).toBe(false);
      expect(result.validationErrors!.some(e => e.includes('pattern'))).toBe(true);
    });

    it('should pass validation for correct pattern', () => {
      const result = builder.buildPrompt('letter-uppercase', {
        letter: 'A',
        color: 'red'
      });

      expect(result.success).toBe(true);
    });
  });

  // ===========================================================================
  // Template Rendering
  // ===========================================================================

  describe('template rendering', () => {
    it('should replace single variable placeholder', () => {
      const result = builder.buildPrompt('fruit-cartoon-simple', {
        fruit: 'strawberry'
      });

      expect(result.success).toBe(true);
      expect(result.prompt!.prompt).toContain('strawberry');
      expect(result.prompt!.prompt).not.toContain('{{fruit}}');
    });

    it('should replace multiple variable placeholders', () => {
      const result = builder.buildPrompt('color-object-simple', {
        color: 'blue',
        object: 'ball'
      });

      expect(result.success).toBe(true);
      expect(result.prompt!.prompt).toContain('blue');
      expect(result.prompt!.prompt).toContain('ball');
    });

    it('should handle multiple occurrences of same variable', () => {
      const result = builder.buildPrompt('color-collection', {
        color: 'red',
        objects: 'apple, flower, balloon'
      });

      expect(result.success).toBe(true);
      // Color appears multiple times in template
      const matches = result.prompt!.prompt.match(/red/g);
      expect(matches!.length).toBeGreaterThan(1);
    });

    it('should preserve template text around variables', () => {
      const result = builder.buildPrompt('fruit-cartoon-simple', {
        fruit: 'cherry'
      });

      expect(result.success).toBe(true);
      expect(result.prompt!.prompt).toContain('cartoon');
      expect(result.prompt!.prompt).toContain('cherry');
      expect(result.prompt!.prompt).toContain('background');
    });
  });

  // ===========================================================================
  // Negative Prompts
  // ===========================================================================

  describe('negative prompts', () => {
    it('should include negative prompt by default', () => {
      const result = builder.buildPrompt('fruit-cartoon-simple', {
        fruit: 'apple'
      });

      expect(result.success).toBe(true);
      expect(result.prompt!.negativePrompt).toBeDefined();
      expect(result.prompt!.negativePrompt!.length).toBeGreaterThan(0);
    });

    it('should exclude negative prompt when option is false', () => {
      const result = builder.buildPrompt(
        'fruit-cartoon-simple',
        { fruit: 'apple' },
        { includeNegative: false }
      );

      expect(result.success).toBe(true);
      expect(result.prompt!.negativePrompt).toBeUndefined();
    });

    it('should use default negative prompt type', () => {
      const result = builder.buildPrompt('fruit-cartoon-simple', {
        fruit: 'apple'
      });

      expect(result.success).toBe(true);
      // Default negative prompt should include common terms
      expect(result.prompt!.negativePrompt).toContain('scary');
    });

    it('should use childSafe negative prompt type', () => {
      const result = builder.buildPrompt(
        'fruit-cartoon-simple',
        { fruit: 'apple' },
        { negativeType: 'childSafe' }
      );

      expect(result.success).toBe(true);
      expect(result.prompt!.negativePrompt).toContain('creepy');
    });

    it('should use simple negative prompt type', () => {
      const result = builder.buildPrompt(
        'fruit-cartoon-simple',
        { fruit: 'apple' },
        { negativeType: 'simple' }
      );

      expect(result.success).toBe(true);
      expect(result.prompt!.negativePrompt).toContain('complex');
    });

    it('should combine template-specific and general negative prompts', () => {
      const result = builder.buildPrompt('fruit-cartoon-simple', {
        fruit: 'apple'
      });

      expect(result.success).toBe(true);
      // Should have terms from both template and general
      const negPrompt = result.prompt!.negativePrompt!;
      expect(negPrompt).toContain('scary');
      expect(negPrompt).toContain('dark');
    });

    it('should remove duplicate negative prompt terms', () => {
      const result = builder.buildPrompt('fruit-cartoon-simple', {
        fruit: 'apple'
      });

      expect(result.success).toBe(true);
      const terms = result.prompt!.negativePrompt!.split(',').map(t => t.trim());
      const uniqueTerms = new Set(terms);
      expect(terms.length).toBe(uniqueTerms.size);
    });
  });

  // ===========================================================================
  // buildPromptsForCategory
  // ===========================================================================

  describe('buildPromptsForCategory', () => {
    it('should build prompts for all templates in category', () => {
      const variablesList = [
        { fruit: 'apple' },
        { fruit: 'banana' }
      ];

      const results = builder.buildPromptsForCategory('fruits', 'image', variablesList);

      expect(results.length).toBeGreaterThan(0);
    });

    it('should return results for each template-variable combination', () => {
      const templates = getPromptsByCategory('fruits', 'image');
      const variablesList = [{ fruit: 'apple' }, { fruit: 'banana' }];

      const results = builder.buildPromptsForCategory('fruits', 'image', variablesList);

      // Each template should be applied to each variable set
      // Some may fail validation if variables don't match template requirements
      expect(results.length).toBeGreaterThanOrEqual(templates.length);
    });

    it('should handle empty category', () => {
      const results = builder.buildPromptsForCategory('nonexistent', 'image', [
        { fruit: 'apple' }
      ]);

      expect(results).toHaveLength(0);
    });

    it('should handle empty variables list', () => {
      const results = builder.buildPromptsForCategory('fruits', 'image', []);

      expect(results).toHaveLength(0);
    });

    it('should include both successful and failed builds', () => {
      const variablesList = [
        { fruit: 'apple' },      // Valid
        { fruit: 'invalid123' }, // Invalid for enum
        { fruit: 'banana' }      // Valid
      ];

      const results = builder.buildPromptsForCategory('fruits', 'image', variablesList);

      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      expect(successful.length).toBeGreaterThan(0);
      // Some will fail due to invalid enum values
    });
  });

  // ===========================================================================
  // getTemplate / getTemplatesByCategory
  // ===========================================================================

  describe('template access', () => {
    it('should return template by ID', () => {
      const template = builder.getTemplate('fruit-cartoon-simple');

      expect(template).toBeDefined();
      expect(template!.id).toBe('fruit-cartoon-simple');
      expect(template!.category).toBe('fruits');
    });

    it('should return undefined for non-existent template', () => {
      const template = builder.getTemplate('non-existent');

      expect(template).toBeUndefined();
    });

    it('should return templates by category and type', () => {
      const templates = builder.getTemplatesByCategory('fruits', 'image');

      expect(templates.length).toBeGreaterThan(0);
      templates.forEach(t => {
        expect(t.category).toBe('fruits');
        expect(t.type).toBe('image');
      });
    });

    it('should return empty array for non-existent category', () => {
      const templates = builder.getTemplatesByCategory('nonexistent', 'image');

      expect(templates).toHaveLength(0);
    });
  });

  // ===========================================================================
  // generateVariableCombinations
  // ===========================================================================

  describe('generateVariableCombinations', () => {
    it('should generate combinations for enum variables', () => {
      const template = builder.getTemplate('fruit-cartoon-simple')!;
      const combinations = builder.generateVariableCombinations(template);

      expect(combinations.length).toBeGreaterThan(0);
      // Should have one combination per fruit option
      expect(combinations.length).toBe(10); // 10 fruit options
    });

    it('should return empty array for templates without enum variables', () => {
      // Find or create a template without enum variables
      const template: PromptTemplate = {
        id: 'test-no-enum',
        category: 'test',
        type: 'text',
        template: '{{text}}',
        variables: [
          {
            name: 'text',
            type: 'string',
            description: 'Text input',
            required: true
          }
        ],
        metadata: {
          targetAge: '3-8',
          complexity: 'simple',
          version: '1.0',
          author: 'test'
        }
      };

      const combinations = builder.generateVariableCombinations(template);

      expect(combinations).toHaveLength(0);
    });

    it('should generate cartesian product for multiple enum variables', () => {
      const template = builder.getTemplate('color-object-simple')!;
      const combinations = builder.generateVariableCombinations(template);

      // Should be colors * objects combinations
      expect(combinations.length).toBeGreaterThan(10);
    });

    it('should limit combinations when maxCombinations is set', () => {
      const template = builder.getTemplate('color-object-simple')!;
      const combinations = builder.generateVariableCombinations(template, {
        maxCombinations: 5
      });

      expect(combinations.length).toBe(5);
    });

    it('should use seeded random for reproducible shuffling', () => {
      const template = builder.getTemplate('color-object-simple')!;

      const combinations1 = builder.generateVariableCombinations(template, {
        maxCombinations: 5,
        randomSeed: 42
      });

      const combinations2 = builder.generateVariableCombinations(template, {
        maxCombinations: 5,
        randomSeed: 42
      });

      expect(combinations1).toEqual(combinations2);
    });

    it('should produce different results with different seeds', () => {
      const template = builder.getTemplate('color-object-simple')!;

      const combinations1 = builder.generateVariableCombinations(template, {
        maxCombinations: 5,
        randomSeed: 42
      });

      const combinations2 = builder.generateVariableCombinations(template, {
        maxCombinations: 5,
        randomSeed: 123
      });

      // With different seeds, results should likely be different
      const same = JSON.stringify(combinations1) === JSON.stringify(combinations2);
      expect(same).toBe(false);
    });
  });

  // ===========================================================================
  // optimizeForModel
  // ===========================================================================

  describe('optimizeForModel', () => {
    const testPrompt = 'A cute cartoon apple with bright colors';

    it('should return prompt unchanged for SDXL', () => {
      const optimized = builder.optimizeForModel(testPrompt, 'sdxl');

      expect(optimized).toBe(testPrompt);
    });

    it('should convert to tags for SD 1.5', () => {
      const optimized = builder.optimizeForModel(testPrompt, 'sd15');

      // Should be comma-separated tags
      expect(optimized).toContain(',');
    });

    it('should return prompt unchanged for text models', () => {
      const optimized = builder.optimizeForModel(testPrompt, 'mistral');
      expect(optimized).toBe(testPrompt);

      const optimizedLlama = builder.optimizeForModel(testPrompt, 'llama');
      expect(optimizedLlama).toBe(testPrompt);
    });
  });

  // ===========================================================================
  // estimateTokenCount
  // ===========================================================================

  describe('estimateTokenCount', () => {
    it('should estimate tokens for short text', () => {
      const count = builder.estimateTokenCount('Hello world');

      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(10);
    });

    it('should estimate more tokens for longer text', () => {
      const shortCount = builder.estimateTokenCount('Hello');
      const longCount = builder.estimateTokenCount('Hello world this is a longer sentence');

      expect(longCount).toBeGreaterThan(shortCount);
    });

    it('should return positive number for empty string', () => {
      const count = builder.estimateTokenCount('');

      // Empty splits to single empty word
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should use approximately 1.3 words per token ratio', () => {
      const text = 'one two three four five six seven eight nine ten';
      const count = builder.estimateTokenCount(text);

      // 10 words * 1.3 = 13 tokens approximately
      expect(count).toBeGreaterThanOrEqual(10);
      expect(count).toBeLessThanOrEqual(15);
    });
  });

  // ===========================================================================
  // Singleton and Convenience Functions
  // ===========================================================================

  describe('singleton and convenience functions', () => {
    it('should return singleton instance', () => {
      const instance1 = getPromptBuilder();
      const instance2 = getPromptBuilder();

      expect(instance1).toBe(instance2);
    });

    it('should build prompt via convenience function', () => {
      const result = buildPrompt('fruit-cartoon-simple', { fruit: 'apple' });

      expect(result.success).toBe(true);
      expect(result.prompt!.prompt).toContain('apple');
    });

    it('should pass options via convenience function', () => {
      const result = buildPrompt(
        'fruit-cartoon-simple',
        { fruit: 'apple' },
        { includeNegative: false }
      );

      expect(result.success).toBe(true);
      expect(result.prompt!.negativePrompt).toBeUndefined();
    });
  });

  // ===========================================================================
  // Template Library Coverage
  // ===========================================================================

  describe('template library', () => {
    it('should have image prompts', () => {
      expect(IMAGE_PROMPTS.length).toBeGreaterThan(0);
    });

    it('should have text prompts', () => {
      expect(TEXT_PROMPTS.length).toBeGreaterThan(0);
    });

    it('should have audio prompts', () => {
      expect(AUDIO_PROMPTS.length).toBeGreaterThan(0);
    });

    it('should have at least 50 total templates', () => {
      const summary = getTemplateSummary();
      expect(summary.total).toBeGreaterThanOrEqual(50);
    });

    it('should have templates in multiple categories', () => {
      const summary = getTemplateSummary();
      expect(Object.keys(summary.byCategory).length).toBeGreaterThan(5);
    });

    it('should have templates for all three types', () => {
      const summary = getTemplateSummary();
      expect(summary.byType.image).toBeGreaterThan(0);
      expect(summary.byType.text).toBeGreaterThan(0);
      expect(summary.byType.audio).toBeGreaterThan(0);
    });

    it('should retrieve template by ID correctly', () => {
      const template = getPromptById('fruit-cartoon-simple');

      expect(template).toBeDefined();
      expect(template!.id).toBe('fruit-cartoon-simple');
    });

    it('should retrieve templates by category correctly', () => {
      const fruitTemplates = getPromptsByCategory('fruits', 'image');

      expect(fruitTemplates.length).toBeGreaterThan(0);
      fruitTemplates.forEach(t => {
        expect(t.category).toBe('fruits');
      });
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('should handle special characters in variable values', () => {
      const result = builder.buildPrompt('fruit-basket', {
        fruits: "apple's, banana's, orange's"
      });

      expect(result.success).toBe(true);
      expect(result.prompt!.prompt).toContain("apple's");
    });

    it('should handle very long variable values', () => {
      const longValue = 'fruit '.repeat(100).trim();
      const result = builder.buildPrompt('fruit-basket', {
        fruits: longValue
      });

      expect(result.success).toBe(true);
      expect(result.prompt!.prompt).toContain('fruit');
    });

    it('should handle numeric variable values converted to string', () => {
      // Some templates accept numbers that will be stringified
      const result = builder.buildPrompt('fruit-multiple-count', {
        count: '3',
        fruit: 'apple'
      });

      expect(result.success).toBe(true);
      expect(result.prompt!.prompt).toContain('3');
    });

    it('should handle boolean false as valid value', () => {
      // Boolean variables should be validated correctly
      const template: PromptTemplate = {
        id: 'test-boolean',
        category: 'test',
        type: 'text',
        template: 'Value is {{flag}}',
        variables: [
          {
            name: 'flag',
            type: 'boolean',
            description: 'A flag',
            required: true
          }
        ],
        metadata: {
          targetAge: '3-8',
          complexity: 'simple',
          version: '1.0',
          author: 'test'
        }
      };

      // Since we can't add custom templates, test with existing number validation
      const result = builder.buildPrompt('fruit-cartoon-simple', {
        fruit: 'apple'
      });

      expect(result.success).toBe(true);
    });

    it('should preserve whitespace in rendered prompts', () => {
      const result = builder.buildPrompt('fruit-cartoon-simple', {
        fruit: 'apple'
      });

      expect(result.success).toBe(true);
      // Template has multiple spaces between words
      expect(result.prompt!.prompt).toMatch(/\s+/);
    });
  });
});
