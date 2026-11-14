/**
 * Unit tests for WorkflowEngine
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkflowEngine, WorkflowBuilder } from '../WorkflowEngine';
import { WorkflowDefinition } from '../types';

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine();
  });

  describe('execute', () => {
    it('should execute simple workflow successfully', async () => {
      const mockGenerator = {
        generate: vi.fn().mockResolvedValue({ gameId: 'test' })
      };

      engine.registerComponent('generator', mockGenerator);

      const workflow: WorkflowDefinition = {
        steps: [
          {
            id: 'generate',
            type: 'generate',
            config: { count: 1 }
          }
        ],
        continueOnError: false
      };

      const execution = await engine.execute(workflow);

      expect(execution.status).toBe('completed');
      expect(execution.steps.length).toBe(1);
      expect(execution.steps[0].status).toBe('completed');
      expect(mockGenerator.generate).toHaveBeenCalled();
    });

    it('should execute multi-step workflow', async () => {
      const mockExtractor = {
        extractAll: vi.fn().mockResolvedValue({ data: 'extracted' })
      };
      const mockGenerator = {
        generate: vi.fn().mockResolvedValue({ gameId: 'test' })
      };

      engine.registerComponent('extractor', mockExtractor);
      engine.registerComponent('generator', mockGenerator);

      const workflow: WorkflowDefinition = {
        steps: [
          {
            id: 'extract',
            type: 'extract',
            config: {}
          },
          {
            id: 'generate',
            type: 'generate',
            config: {}
          }
        ],
        continueOnError: false
      };

      const execution = await engine.execute(workflow);

      expect(execution.status).toBe('completed');
      expect(execution.steps.length).toBe(2);
      expect(execution.steps[0].status).toBe('completed');
      expect(execution.steps[1].status).toBe('completed');
      expect(mockExtractor.extractAll).toHaveBeenCalled();
      expect(mockGenerator.generate).toHaveBeenCalled();
    });

    it('should stop on error when continueOnError is false', async () => {
      const mockGenerator = {
        generate: vi.fn().mockRejectedValue(new Error('Generation failed'))
      };

      engine.registerComponent('generator', mockGenerator);

      const workflow: WorkflowDefinition = {
        steps: [
          {
            id: 'generate',
            type: 'generate',
            config: {}
          }
        ],
        continueOnError: false
      };

      const execution = await engine.execute(workflow);

      expect(execution.status).toBe('failed');
      expect(execution.steps[0].status).toBe('failed');
      expect(execution.error).toBeDefined();
    });

    it('should continue on error when continueOnError is true', async () => {
      const mockGenerator = {
        generate: vi.fn()
          .mockRejectedValueOnce(new Error('First failed'))
          .mockResolvedValue({ gameId: 'test' })
      };

      engine.registerComponent('generator', mockGenerator);

      const workflow: WorkflowDefinition = {
        steps: [
          {
            id: 'generate-1',
            type: 'generate',
            config: {}
          },
          {
            id: 'generate-2',
            type: 'generate',
            config: {}
          }
        ],
        continueOnError: true
      };

      const execution = await engine.execute(workflow);

      expect(execution.status).toBe('completed');
      expect(execution.steps[0].status).toBe('failed');
      expect(execution.steps[1].status).toBe('completed');
    });

    it('should skip steps with unmet conditions', async () => {
      const mockGenerator = {
        generate: vi.fn().mockResolvedValue({ gameId: 'test' })
      };

      engine.registerComponent('generator', mockGenerator);

      const workflow: WorkflowDefinition = {
        steps: [
          {
            id: 'generate-1',
            type: 'generate',
            config: {}
          },
          {
            id: 'generate-2',
            type: 'generate',
            config: {},
            condition: {
              field: 'status',
              operator: 'eq',
              value: 'completed'
            }
          }
        ],
        continueOnError: false
      };

      const execution = await engine.execute(workflow);

      expect(execution.status).toBe('completed');
      expect(execution.steps[0].status).toBe('completed');
      expect(execution.steps[1].status).toBe('skipped');
    });
  });

  describe('validateWorkflow', () => {
    it('should validate correct workflow', () => {
      const workflow: WorkflowDefinition = {
        steps: [
          {
            id: 'step-1',
            type: 'generate',
            config: {}
          }
        ],
        continueOnError: false
      };

      const validation = engine.validateWorkflow(workflow);

      expect(validation.valid).toBe(false); // No generator registered
      expect(validation.errors).toContain('Step step-1 requires generator component');
    });

    it('should detect empty workflow', () => {
      const workflow: WorkflowDefinition = {
        steps: [],
        continueOnError: false
      };

      const validation = engine.validateWorkflow(workflow);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Workflow must have at least one step');
    });

    it('should detect duplicate step IDs', () => {
      const workflow: WorkflowDefinition = {
        steps: [
          {
            id: 'step-1',
            type: 'generate',
            config: {}
          },
          {
            id: 'step-1',
            type: 'generate',
            config: {}
          }
        ],
        continueOnError: false
      };

      const validation = engine.validateWorkflow(workflow);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Duplicate step ID: step-1');
    });

    it('should detect invalid step types', () => {
      const workflow: WorkflowDefinition = {
        steps: [
          {
            id: 'step-1',
            type: 'invalid' as any,
            config: {}
          }
        ],
        continueOnError: false
      };

      const validation = engine.validateWorkflow(workflow);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Invalid step type: invalid');
    });
  });

  describe('getSummary', () => {
    it('should generate correct summary', async () => {
      const mockGenerator = {
        generate: vi.fn()
          .mockResolvedValueOnce({ gameId: 'test-1' })
          .mockRejectedValueOnce(new Error('Failed'))
      };

      engine.registerComponent('generator', mockGenerator);

      const workflow: WorkflowDefinition = {
        steps: [
          {
            id: 'generate-1',
            type: 'generate',
            config: {}
          },
          {
            id: 'generate-2',
            type: 'generate',
            config: {}
          },
          {
            id: 'generate-3',
            type: 'generate',
            config: {},
            condition: { field: 'status', operator: 'eq', value: 'never' }
          }
        ],
        continueOnError: true
      };

      const execution = await engine.execute(workflow);
      const summary = engine.getSummary(execution);

      expect(summary.totalSteps).toBe(3);
      expect(summary.completedSteps).toBe(1);
      expect(summary.failedSteps).toBe(1);
      expect(summary.skippedSteps).toBe(1);
    });
  });
});

describe('WorkflowBuilder', () => {
  it('should build workflow with fluent API', () => {
    const workflow = new WorkflowBuilder()
      .extract('extract-step', { outputDir: './data' })
      .train('train-step', { dataset: './data.jsonl' })
      .generate('generate-step', { count: 10 })
      .validate('validate-step', { minQuality: 0.8 })
      .setContinueOnError(true)
      .build();

    expect(workflow.steps.length).toBe(4);
    expect(workflow.steps[0].type).toBe('extract');
    expect(workflow.steps[1].type).toBe('train');
    expect(workflow.steps[2].type).toBe('generate');
    expect(workflow.steps[3].type).toBe('validate');
    expect(workflow.continueOnError).toBe(true);
  });

  it('should include step configurations', () => {
    const workflow = new WorkflowBuilder()
      .generate('generate-step', { count: 5, category: 'fruits' })
      .build();

    expect(workflow.steps[0].config).toEqual({ count: 5, category: 'fruits' });
  });
});
