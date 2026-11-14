/**
 * Type definitions for batch processing and workflow execution.
 *
 * @module batch/types
 */

import { GameGenerationRequest, GeneratedGamePackage } from '../generators/types';

/**
 * Batch generation request
 */
export interface BatchGenerationRequest {
  /** Unique batch identifier */
  batchId: string;
  /** Human-readable batch name */
  name: string;
  /** Game template type */
  template: string;
  /** Content category */
  category: string;
  /** Number of games to generate */
  count: number;
  /** Starting index for game IDs (default: 0) */
  startIndex?: number;
  /** Generation options */
  options: GenerationOptions;
  /** Optional workflow definition */
  workflow?: WorkflowDefinition;
}

/**
 * Generation options for batch processing
 */
export interface GenerationOptions {
  /** Visual theme */
  theme: string;
  /** Difficulty level */
  difficulty: 'easy' | 'medium' | 'hard';
  /** Supported languages */
  languages: string[];
  /** Number of questions per game */
  questionCount: number;
  /** Optional LoRA model */
  loraModel?: string;
  /** Enable validation */
  validate: boolean;
  /** Enable auto-remediation */
  remediate: boolean;
  /** Output directory */
  outputDir: string;
}

/**
 * Batch job status enum
 */
export enum BatchJobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
  CANCELLED = 'cancelled'
}

/**
 * Individual batch job
 */
export interface BatchJob {
  /** Unique job identifier */
  id: string;
  /** Parent batch ID */
  batchId: string;
  /** Game identifier */
  gameId: string;
  /** Generation request */
  request: GameGenerationRequest;
  /** Current status */
  status: BatchJobStatus;
  /** Current attempt number */
  attempt: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Generation result (if completed) */
  result?: GeneratedGamePackage;
  /** Error information (if failed) */
  error?: Error;
  /** Creation timestamp */
  createdAt: Date;
  /** Start timestamp */
  startedAt?: Date;
  /** Completion timestamp */
  completedAt?: Date;
}

/**
 * Batch status enum
 */
export enum BatchStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * Batch progress information
 */
export interface BatchProgress {
  /** Total number of jobs */
  total: number;
  /** Completed jobs */
  completed: number;
  /** Failed jobs */
  failed: number;
  /** Pending jobs */
  pending: number;
  /** Running jobs */
  running: number;
  /** Completion percentage (0-100) */
  percentage: number;
  /** Estimated time remaining (ms) */
  estimatedTimeRemaining: number;
  /** Average job duration (ms) */
  averageJobDuration: number;
}

/**
 * Batch metrics
 */
export interface BatchMetrics {
  /** Total jobs in batch */
  totalJobs: number;
  /** Successfully completed jobs */
  successfulJobs: number;
  /** Failed jobs */
  failedJobs: number;
  /** Number of retried jobs */
  retriedJobs: number;
  /** Total batch duration (ms) */
  totalDuration: number;
  /** Average job duration (ms) */
  averageDuration: number;
  /** Minimum job duration (ms) */
  minDuration: number;
  /** Maximum job duration (ms) */
  maxDuration: number;
  /** Throughput (jobs/hour) */
  throughput: number;
  /** Error rate (0-1) */
  errorRate: number;
  /** Success rate (0-1) */
  successRate: number;
}

/**
 * Complete batch state
 */
export interface BatchState {
  /** Batch identifier */
  batchId: string;
  /** Batch name */
  name: string;
  /** Current status */
  status: BatchStatus;
  /** All jobs in batch */
  jobs: BatchJob[];
  /** Progress information */
  progress: BatchProgress;
  /** Batch metrics */
  metrics: BatchMetrics;
  /** Creation timestamp */
  createdAt: Date;
  /** Start timestamp */
  startedAt?: Date;
  /** Completion timestamp */
  completedAt?: Date;
}

/**
 * Workflow condition operator
 */
export type WorkflowConditionOperator = 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';

/**
 * Workflow condition for conditional execution
 */
export interface WorkflowCondition {
  /** Field to evaluate */
  field: string;
  /** Comparison operator */
  operator: WorkflowConditionOperator;
  /** Expected value */
  value: any;
}

/**
 * Workflow step type
 */
export type WorkflowStepType = 'extract' | 'train' | 'generate' | 'validate';

/**
 * Workflow step definition
 */
export interface WorkflowStep {
  /** Step identifier */
  id: string;
  /** Step type */
  type: WorkflowStepType;
  /** Step configuration */
  config: Record<string, any>;
  /** Optional execution condition */
  condition?: WorkflowCondition;
}

/**
 * Workflow definition
 */
export interface WorkflowDefinition {
  /** Workflow steps */
  steps: WorkflowStep[];
  /** Continue on step error */
  continueOnError: boolean;
}

/**
 * Workflow execution status
 */
export type WorkflowExecutionStatus = 'running' | 'completed' | 'failed';

/**
 * Workflow step execution status
 */
export type WorkflowStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/**
 * Workflow step execution state
 */
export interface WorkflowStepExecution {
  /** Step definition */
  step: WorkflowStep;
  /** Current status */
  status: WorkflowStepStatus;
  /** Start timestamp */
  startedAt?: Date;
  /** Completion timestamp */
  completedAt?: Date;
  /** Step result (if completed) */
  result?: any;
  /** Error information (if failed) */
  error?: Error;
}

/**
 * Complete workflow execution state
 */
export interface WorkflowExecution {
  /** Workflow identifier */
  workflowId: string;
  /** Step executions */
  steps: WorkflowStepExecution[];
  /** Overall status */
  status: WorkflowExecutionStatus;
  /** Current step index */
  currentStep: number;
  /** Final result (if completed) */
  result?: any;
  /** Error information (if failed) */
  error?: Error;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum retry attempts */
  maxAttempts: number;
  /** Base delay (ms) */
  baseDelay: number;
  /** Maximum delay (ms) */
  maxDelay: number;
  /** Backoff strategy */
  strategy: 'exponential' | 'linear' | 'constant';
  /** Jitter enabled */
  jitter: boolean;
}

/**
 * WebSocket message types
 */
export type WebSocketMessageType =
  | 'connected'
  | 'progress'
  | 'state'
  | 'batch-started'
  | 'batch-completed'
  | 'job-completed'
  | 'job-failed'
  | 'error'
  | 'ping'
  | 'pong';

/**
 * WebSocket message
 */
export interface WebSocketMessage {
  /** Message type */
  type: WebSocketMessageType;
  /** Message payload */
  payload?: any;
  /** Timestamp */
  timestamp: Date;
}
