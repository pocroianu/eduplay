/**
 * Multi-step workflow execution engine.
 *
 * Supports complex workflows with conditional execution, dependency
 * resolution, and error handling strategies.
 *
 * @module batch/WorkflowEngine
 */

import { v4 as uuid } from 'uuid';
import {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowStep,
  WorkflowStepExecution,
  WorkflowCondition,
  WorkflowExecutionStatus,
  WorkflowStepStatus
} from './types';

/**
 * Workflow component interfaces
 */
interface WorkflowComponents {
  extractor?: any;
  trainer?: any;
  generator?: any;
  validator?: any;
}

/**
 * Multi-step workflow execution engine.
 *
 * Features:
 * - Sequential step execution
 * - Conditional execution
 * - Error handling strategies
 * - Step dependency resolution
 * - Workflow composition
 *
 * Supported workflows:
 * - Extract → Train → Generate → Validate
 * - Generate → Validate → Publish
 * - Custom multi-step pipelines
 */
export class WorkflowEngine {
  private components: WorkflowComponents;

  constructor(components: WorkflowComponents = {}) {
    this.components = components;
  }

  /**
   * Execute a workflow
   */
  async execute(workflow: WorkflowDefinition): Promise<WorkflowExecution> {
    const execution: WorkflowExecution = {
      workflowId: uuid(),
      steps: [],
      status: 'running',
      currentStep: 0
    };

    try {
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];

        const stepExec: WorkflowStepExecution = {
          step,
          status: 'pending'
        };

        execution.steps.push(stepExec);
        execution.currentStep = i;

        // Check condition
        if (step.condition && !this.evaluateCondition(step.condition, execution)) {
          stepExec.status = 'skipped';
          console.log(`Step ${step.id} skipped (condition not met)`);
          continue;
        }

        // Execute step
        stepExec.status = 'running';
        stepExec.startedAt = new Date();

        console.log(`Executing step ${step.id} (${step.type})...`);

        try {
          stepExec.result = await this.executeStep(step, execution);
          stepExec.status = 'completed';
          stepExec.completedAt = new Date();

          console.log(`Step ${step.id} completed successfully`);

        } catch (error) {
          stepExec.status = 'failed';
          stepExec.error = error as Error;
          stepExec.completedAt = new Date();

          console.error(`Step ${step.id} failed:`, (error as Error).message);

          if (!workflow.continueOnError) {
            execution.status = 'failed';
            execution.error = error as Error;
            return execution;
          }
        }
      }

      execution.status = 'completed';
      execution.result = this.collectResults(execution);

    } catch (error) {
      execution.status = 'failed';
      execution.error = error as Error;
    }

    return execution;
  }

  /**
   * Validate workflow definition
   */
  validateWorkflow(workflow: WorkflowDefinition): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!workflow.steps || workflow.steps.length === 0) {
      errors.push('Workflow must have at least one step');
    }

    // Check for duplicate step IDs
    const stepIds = new Set<string>();
    for (const step of workflow.steps) {
      if (stepIds.has(step.id)) {
        errors.push(`Duplicate step ID: ${step.id}`);
      }
      stepIds.add(step.id);

      // Validate step type
      if (!['extract', 'train', 'generate', 'validate'].includes(step.type)) {
        errors.push(`Invalid step type: ${step.type}`);
      }

      // Validate required components
      if (step.type === 'extract' && !this.components.extractor) {
        errors.push(`Step ${step.id} requires extractor component`);
      }
      if (step.type === 'train' && !this.components.trainer) {
        errors.push(`Step ${step.id} requires trainer component`);
      }
      if (step.type === 'generate' && !this.components.generator) {
        errors.push(`Step ${step.id} requires generator component`);
      }
      if (step.type === 'validate' && !this.components.validator) {
        errors.push(`Step ${step.id} requires validator component`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Register workflow component
   */
  registerComponent(type: 'extractor' | 'trainer' | 'generator' | 'validator', component: any): void {
    this.components[type] = component;
  }

  /**
   * Get workflow execution summary
   */
  getSummary(execution: WorkflowExecution): {
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
    skippedSteps: number;
    duration: number;
  } {
    const steps = execution.steps;
    const completed = steps.filter(s => s.status === 'completed').length;
    const failed = steps.filter(s => s.status === 'failed').length;
    const skipped = steps.filter(s => s.status === 'skipped').length;

    const durations = steps
      .filter(s => s.startedAt && s.completedAt)
      .map(s => s.completedAt!.getTime() - s.startedAt!.getTime());

    const totalDuration = durations.reduce((a, b) => a + b, 0);

    return {
      totalSteps: steps.length,
      completedSteps: completed,
      failedSteps: failed,
      skippedSteps: skipped,
      duration: totalDuration
    };
  }

  // Private methods

  private async executeStep(step: WorkflowStep, execution: WorkflowExecution): Promise<any> {
    switch (step.type) {
      case 'extract':
        return this.executeExtract(step.config, execution);

      case 'train':
        return this.executeTrain(step.config, execution);

      case 'generate':
        return this.executeGenerate(step.config, execution);

      case 'validate':
        return this.executeValidate(step.config, execution);

      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  private async executeExtract(config: any, execution: WorkflowExecution): Promise<any> {
    if (!this.components.extractor) {
      throw new Error('DataExtractor not configured');
    }

    // Execute extraction
    const extractor = this.components.extractor;

    if (typeof extractor.extractAll === 'function') {
      return extractor.extractAll(config);
    } else if (typeof extractor.extract === 'function') {
      return extractor.extract(config);
    } else {
      throw new Error('Extractor does not implement extract methods');
    }
  }

  private async executeTrain(config: any, execution: WorkflowExecution): Promise<any> {
    if (!this.components.trainer) {
      throw new Error('LoRATrainer not configured');
    }

    const trainer = this.components.trainer;

    if (typeof trainer.train === 'function') {
      return trainer.train(config);
    } else {
      throw new Error('Trainer does not implement train method');
    }
  }

  private async executeGenerate(config: any, execution: WorkflowExecution): Promise<any> {
    if (!this.components.generator) {
      throw new Error('GameContentGenerator not configured');
    }

    const generator = this.components.generator;

    if (typeof generator.generate === 'function') {
      return generator.generate(config);
    } else {
      throw new Error('Generator does not implement generate method');
    }
  }

  private async executeValidate(config: any, execution: WorkflowExecution): Promise<any> {
    if (!this.components.validator) {
      throw new Error('ValidationPipeline not configured');
    }

    const validator = this.components.validator;

    if (typeof validator.validate === 'function') {
      return validator.validate(config);
    } else {
      throw new Error('Validator does not implement validate method');
    }
  }

  private evaluateCondition(condition: WorkflowCondition, execution: WorkflowExecution): boolean {
    // Get value from execution context
    const value = this.getFieldValue(condition.field, execution);

    // Evaluate condition
    switch (condition.operator) {
      case 'eq':
        return value === condition.value;

      case 'ne':
        return value !== condition.value;

      case 'gt':
        return value > condition.value;

      case 'lt':
        return value < condition.value;

      case 'gte':
        return value >= condition.value;

      case 'lte':
        return value <= condition.value;

      case 'contains':
        if (typeof value === 'string') {
          return value.includes(condition.value);
        } else if (Array.isArray(value)) {
          return value.includes(condition.value);
        }
        return false;

      default:
        return true;
    }
  }

  private getFieldValue(field: string, execution: WorkflowExecution): any {
    // Support dot notation for nested fields
    const parts = field.split('.');

    let value: any = execution;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  private collectResults(execution: WorkflowExecution): any {
    // Collect results from all completed steps
    const results: Record<string, any> = {};

    for (const stepExec of execution.steps) {
      if (stepExec.status === 'completed' && stepExec.result) {
        results[stepExec.step.id] = stepExec.result;
      }
    }

    return results;
  }
}

/**
 * Workflow builder for fluent API
 */
export class WorkflowBuilder {
  private steps: WorkflowStep[] = [];
  private continueOnError: boolean = false;

  /**
   * Add extract step
   */
  extract(id: string, config: Record<string, any> = {}): this {
    this.steps.push({
      id,
      type: 'extract',
      config
    });
    return this;
  }

  /**
   * Add train step
   */
  train(id: string, config: Record<string, any> = {}): this {
    this.steps.push({
      id,
      type: 'train',
      config
    });
    return this;
  }

  /**
   * Add generate step
   */
  generate(id: string, config: Record<string, any> = {}): this {
    this.steps.push({
      id,
      type: 'generate',
      config
    });
    return this;
  }

  /**
   * Add validate step
   */
  validate(id: string, config: Record<string, any> = {}): this {
    this.steps.push({
      id,
      type: 'validate',
      config
    });
    return this;
  }

  /**
   * Set continue on error
   */
  setContinueOnError(value: boolean): this {
    this.continueOnError = value;
    return this;
  }

  /**
   * Build workflow definition
   */
  build(): WorkflowDefinition {
    return {
      steps: this.steps,
      continueOnError: this.continueOnError
    };
  }
}
