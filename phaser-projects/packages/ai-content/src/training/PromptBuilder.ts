/**
 * Prompt Builder
 *
 * Renders prompt templates with variable substitution and validation.
 */

import {
  PromptTemplate,
  PromptVariable,
  BuiltPrompt,
  PromptBuildResult
} from './types';
import {
  getPromptById,
  getPromptsByCategory,
  getNegativePrompt
} from './PromptTemplates';

/**
 * Builds prompts from templates with variable substitution and validation.
 *
 * Responsibilities:
 * - Template rendering with variables
 * - Variable validation
 * - Negative prompt generation
 * - Prompt optimization
 */
export class PromptBuilder {
  /**
   * Build a prompt from template ID and variables
   */
  buildPrompt(
    templateId: string,
    variables: Record<string, any>,
    options?: {
      includeNegative?: boolean;
      negativeType?: 'default' | 'childSafe' | 'simple' | 'clean';
    }
  ): PromptBuildResult {
    // Get template
    const template = getPromptById(templateId);

    if (!template) {
      return {
        success: false,
        error: `Template not found: ${templateId}`
      };
    }

    // Validate variables
    const validation = this.validateVariables(template, variables);

    if (!validation.valid) {
      return {
        success: false,
        error: 'Variable validation failed',
        validationErrors: validation.errors
      };
    }

    // Render template
    const prompt = this.renderTemplate(template.template, variables);

    // Build negative prompt
    let negativePrompt: string | undefined;

    if (options?.includeNegative !== false) {
      negativePrompt = this.buildNegativePrompt(
        template,
        options?.negativeType || 'default'
      );
    }

    // Create result
    const result: BuiltPrompt = {
      templateId: template.id,
      prompt,
      negativePrompt,
      variables,
      metadata: {
        category: template.category,
        style: template.style,
        generatedAt: new Date()
      }
    };

    return {
      success: true,
      prompt: result
    };
  }

  /**
   * Build multiple prompts from a category
   */
  buildPromptsForCategory(
    category: string,
    type: 'image' | 'text' | 'audio',
    variablesList: Record<string, any>[]
  ): PromptBuildResult[] {
    const templates = getPromptsByCategory(category, type);
    const results: PromptBuildResult[] = [];

    for (const template of templates) {
      for (const variables of variablesList) {
        const result = this.buildPrompt(template.id, variables);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): PromptTemplate | undefined {
    return getPromptById(templateId);
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(
    category: string,
    type: 'image' | 'text' | 'audio'
  ): PromptTemplate[] {
    return getPromptsByCategory(category, type);
  }

  /**
   * Validate variable values against template requirements
   */
  private validateVariables(
    template: PromptTemplate,
    variables: Record<string, any>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const varDef of template.variables) {
      const value = variables[varDef.name];

      // Check required
      if (varDef.required && (value === undefined || value === null || value === '')) {
        errors.push(`Required variable missing: ${varDef.name}`);
        continue;
      }

      // Skip validation if not provided and not required
      if (value === undefined || value === null) {
        continue;
      }

      // Validate type
      const typeError = this.validateType(varDef, value);
      if (typeError) {
        errors.push(typeError);
        continue;
      }

      // Validate enum options
      if (varDef.type === 'enum' && varDef.options) {
        if (!varDef.options.includes(value)) {
          errors.push(
            `Invalid value for ${varDef.name}: ${value}. Must be one of: ${varDef.options.join(', ')}`
          );
        }
      }

      // Validate constraints
      if (varDef.validation) {
        const constraintError = this.validateConstraints(varDef, value);
        if (constraintError) {
          errors.push(constraintError);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate variable type
   */
  private validateType(varDef: PromptVariable, value: any): string | null {
    const actualType = typeof value;

    switch (varDef.type) {
      case 'string':
      case 'enum':
        if (actualType !== 'string') {
          return `Variable ${varDef.name} must be a string, got ${actualType}`;
        }
        break;

      case 'number':
        if (actualType !== 'number' || isNaN(value)) {
          return `Variable ${varDef.name} must be a number, got ${actualType}`;
        }
        break;

      case 'boolean':
        if (actualType !== 'boolean') {
          return `Variable ${varDef.name} must be a boolean, got ${actualType}`;
        }
        break;
    }

    return null;
  }

  /**
   * Validate variable constraints
   */
  private validateConstraints(varDef: PromptVariable, value: any): string | null {
    const validation = varDef.validation;
    if (!validation) return null;

    // Min/max for numbers
    if (typeof value === 'number') {
      if (validation.min !== undefined && value < validation.min) {
        return `Variable ${varDef.name} must be >= ${validation.min}, got ${value}`;
      }
      if (validation.max !== undefined && value > validation.max) {
        return `Variable ${varDef.name} must be <= ${validation.max}, got ${value}`;
      }
    }

    // Pattern for strings
    if (typeof value === 'string' && validation.pattern) {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value)) {
        return `Variable ${varDef.name} does not match pattern: ${validation.pattern}`;
      }
    }

    return null;
  }

  /**
   * Render template string with variable substitution
   */
  private renderTemplate(
    template: string,
    variables: Record<string, any>
  ): string {
    let rendered = template;

    // Replace all {{variable}} placeholders
    const placeholderRegex = /\{\{(\w+)\}\}/g;

    rendered = rendered.replace(placeholderRegex, (match, varName) => {
      const value = variables[varName];

      if (value === undefined || value === null) {
        // Use default if available
        const varDef = Object.values(variables).find(v => v === varName);
        return varDef?.default !== undefined ? String(varDef.default) : match;
      }

      return String(value);
    });

    return rendered;
  }

  /**
   * Build negative prompt from template and type
   */
  private buildNegativePrompt(
    template: PromptTemplate,
    type: 'default' | 'childSafe' | 'simple' | 'clean'
  ): string {
    const prompts: string[] = [];

    // Add template-specific negative prompt
    if (template.negativePrompt) {
      prompts.push(template.negativePrompt);
    }

    // Add general negative prompt
    prompts.push(getNegativePrompt(type));

    // Remove duplicates
    const uniqueTerms = new Set<string>();
    for (const prompt of prompts) {
      const terms = prompt.split(',').map(t => t.trim());
      for (const term of terms) {
        if (term) {
          uniqueTerms.add(term);
        }
      }
    }

    return Array.from(uniqueTerms).join(', ');
  }

  /**
   * Generate variable combinations for batch generation
   */
  generateVariableCombinations(
    template: PromptTemplate,
    options?: {
      maxCombinations?: number;
      randomSeed?: number;
    }
  ): Record<string, any>[] {
    const combinations: Record<string, any>[] = [];

    // Get enum variables
    const enumVars = template.variables.filter(v => v.type === 'enum' && v.options);

    if (enumVars.length === 0) {
      return [];
    }

    // Generate cartesian product of all enum options
    const generateCombos = (
      vars: PromptVariable[],
      current: Record<string, any> = {},
      index: number = 0
    ): void => {
      if (index >= vars.length) {
        combinations.push({ ...current });
        return;
      }

      const varDef = vars[index];
      const options = varDef.options || [];

      for (const option of options) {
        current[varDef.name] = option;
        generateCombos(vars, current, index + 1);
      }
    };

    generateCombos(enumVars);

    // Limit combinations if specified
    if (options?.maxCombinations && combinations.length > options.maxCombinations) {
      // Shuffle and take first N
      if (options.randomSeed !== undefined) {
        this.shuffleWithSeed(combinations, options.randomSeed);
      } else {
        this.shuffle(combinations);
      }

      return combinations.slice(0, options.maxCombinations);
    }

    return combinations;
  }

  /**
   * Shuffle array in place
   */
  private shuffle<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  /**
   * Shuffle array with seeded random
   */
  private shuffleWithSeed<T>(array: T[], seed: number): void {
    let state = seed;
    const random = () => {
      state = (state * 9301 + 49297) % 233280;
      return state / 233280;
    };

    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  /**
   * Optimize prompt for specific model
   */
  optimizeForModel(
    prompt: string,
    model: 'sdxl' | 'sd15' | 'mistral' | 'llama'
  ): string {
    // SDXL optimizations
    if (model === 'sdxl') {
      // SDXL prefers natural language, detailed descriptions
      return prompt;
    }

    // SD 1.5 optimizations
    if (model === 'sd15') {
      // SD 1.5 works better with comma-separated tags
      // Convert natural language to tags
      return this.convertToTags(prompt);
    }

    // Text model optimizations
    if (model === 'mistral' || model === 'llama') {
      // Add system-style formatting if needed
      return prompt;
    }

    return prompt;
  }

  /**
   * Convert natural language prompt to comma-separated tags
   */
  private convertToTags(prompt: string): string {
    // Simple conversion: extract key descriptive phrases
    const words = prompt.split(/\s+/);
    const tags: string[] = [];

    for (const word of words) {
      const cleaned = word.replace(/[,.]/g, '').trim();
      if (cleaned.length > 0) {
        tags.push(cleaned);
      }
    }

    return tags.join(', ');
  }

  /**
   * Calculate prompt token count estimate
   */
  estimateTokenCount(prompt: string): number {
    // Simple estimation: ~1.3 words per token on average
    const words = prompt.split(/\s+/).length;
    return Math.ceil(words * 1.3);
  }
}

/**
 * Singleton instance
 */
let promptBuilderInstance: PromptBuilder | null = null;

/**
 * Get PromptBuilder singleton
 */
export function getPromptBuilder(): PromptBuilder {
  if (!promptBuilderInstance) {
    promptBuilderInstance = new PromptBuilder();
  }
  return promptBuilderInstance;
}

/**
 * Convenience function to build a prompt
 */
export function buildPrompt(
  templateId: string,
  variables: Record<string, any>,
  options?: {
    includeNegative?: boolean;
    negativeType?: 'default' | 'childSafe' | 'simple' | 'clean';
  }
): PromptBuildResult {
  return getPromptBuilder().buildPrompt(templateId, variables, options);
}
