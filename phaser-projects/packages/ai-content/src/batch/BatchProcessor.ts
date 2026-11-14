/**
 * Batch processing orchestrator for game generation.
 *
 * Manages queue-based batch generation with retry logic, progress tracking,
 * and persistent state management.
 *
 * @module batch/BatchProcessor
 */

import { EventEmitter } from 'events';
import PQueue from 'p-queue';
import { v4 as uuid } from 'uuid';
import {
  BatchGenerationRequest,
  BatchJob,
  BatchJobStatus,
  BatchState,
  BatchStatus,
  BatchProgress,
  BatchMetrics,
  RetryConfig
} from './types';
import { GameContentGenerator } from '../generators/GameContentGenerator';
import { ProgressTracker } from './ProgressTracker';
import { MetricsCollector } from './MetricsCollector';

/**
 * Batch processing events
 */
export const BatchEvents = {
  BATCH_STARTED: 'batch:started',
  BATCH_COMPLETED: 'batch:completed',
  BATCH_FAILED: 'batch:failed',
  BATCH_CANCELLED: 'batch:cancelled',
  JOB_STARTED: 'job:started',
  JOB_COMPLETED: 'job:completed',
  JOB_FAILED: 'job:failed',
  JOB_RETRYING: 'job:retrying',
  PROGRESS_UPDATE: 'progress:update'
} as const;

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  strategy: 'exponential',
  jitter: true
};

/**
 * Batch processor options
 */
export interface BatchProcessorOptions {
  /** Queue concurrency */
  concurrency: number;
  /** State directory */
  stateDir: string;
  /** Retry configuration */
  retryConfig: RetryConfig;
  /** Auto-save interval (ms) */
  autoSaveInterval: number;
}

/**
 * Default options
 */
const DEFAULT_OPTIONS: BatchProcessorOptions = {
  concurrency: 3,
  stateDir: './batch-state',
  retryConfig: DEFAULT_RETRY_CONFIG,
  autoSaveInterval: 10000
};

/**
 * Handles batch generation of multiple games with queue-based processing,
 * automatic retries, and persistent state management.
 *
 * Features:
 * - Queue-based processing (p-queue)
 * - Exponential backoff retry
 * - Persistent state
 * - Resume capability
 * - Real-time progress tracking
 * - Comprehensive metrics
 */
export class BatchProcessor extends EventEmitter {
  private queue: PQueue;
  private activeBatches: Map<string, BatchState> = new Map();
  private progressTracker: ProgressTracker;
  private metricsCollector: MetricsCollector;
  private options: BatchProcessorOptions;
  private autoSaveTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private generator: GameContentGenerator,
    options: Partial<BatchProcessorOptions> = {}
  ) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.queue = new PQueue({ concurrency: this.options.concurrency });
    this.progressTracker = new ProgressTracker({ stateDir: this.options.stateDir });
    this.metricsCollector = new MetricsCollector();
  }

  /**
   * Process a batch generation request
   */
  async processBatch(request: BatchGenerationRequest): Promise<BatchState> {
    // Initialize progress tracker
    await this.progressTracker.initialize();

    // Create batch state
    const batchState: BatchState = {
      batchId: request.batchId,
      name: request.name,
      status: BatchStatus.PENDING,
      jobs: [],
      progress: this.createInitialProgress(request.count),
      metrics: this.createInitialMetrics(),
      createdAt: new Date()
    };

    // Create jobs
    for (let i = 0; i < request.count; i++) {
      const index = (request.startIndex || 0) + i;
      const gameId = `${request.category}-${index.toString().padStart(3, '0')}`;

      const job: BatchJob = {
        id: uuid(),
        batchId: request.batchId,
        gameId,
        request: {
          gameId,
          category: request.category,
          theme: request.options.theme,
          difficulty: request.options.difficulty,
          languages: request.options.languages,
          questionCount: request.options.questionCount,
          choicesPerQuestion: 3,
          loraModel: request.options.loraModel,
          validateBeforeCommit: request.options.validate,
          retryOnFailure: true,
          maxRetries: 0, // Handled by batch processor
          outputDir: request.options.outputDir
        },
        status: BatchJobStatus.PENDING,
        attempt: 0,
        maxRetries: this.options.retryConfig.maxAttempts,
        createdAt: new Date()
      };

      batchState.jobs.push(job);
    }

    // Save initial state
    this.activeBatches.set(request.batchId, batchState);
    await this.progressTracker.saveBatch(batchState);

    // Start processing
    batchState.status = BatchStatus.RUNNING;
    batchState.startedAt = new Date();

    this.emit(BatchEvents.BATCH_STARTED, batchState);

    // Start auto-save
    this.startAutoSave(batchState);

    try {
      // Queue all jobs
      const promises = batchState.jobs.map(job =>
        this.queue.add(() => this.processJob(job, batchState))
      );

      await Promise.all(promises);

      // Calculate final metrics
      batchState.metrics = this.progressTracker.calculateMetrics(batchState);
      batchState.status = BatchStatus.COMPLETED;
      batchState.completedAt = new Date();

      // Record metrics
      this.metricsCollector.recordBatch(batchState);

      this.emit(BatchEvents.BATCH_COMPLETED, batchState);

    } catch (error) {
      batchState.status = BatchStatus.FAILED;
      this.emit(BatchEvents.BATCH_FAILED, { batchState, error });
      throw error;

    } finally {
      // Stop auto-save
      this.stopAutoSave(batchState.batchId);

      // Final save
      await this.progressTracker.saveBatch(batchState);

      // Cleanup
      this.activeBatches.delete(request.batchId);
    }

    return batchState;
  }

  /**
   * Resume a paused or failed batch
   */
  async resumeBatch(batchId: string): Promise<BatchState> {
    const batchState = await this.progressTracker.loadBatch(batchId);

    if (!batchState) {
      throw new Error(`Batch not found: ${batchId}`);
    }

    if (batchState.status === BatchStatus.COMPLETED) {
      console.log('Batch already completed');
      return batchState;
    }

    // Find incomplete jobs
    const incompleteJobs = batchState.jobs.filter(j =>
      j.status === BatchJobStatus.PENDING ||
      j.status === BatchJobStatus.FAILED
    );

    if (incompleteJobs.length === 0) {
      console.log('No incomplete jobs to resume');
      batchState.status = BatchStatus.COMPLETED;
      batchState.completedAt = new Date();
      await this.progressTracker.saveBatch(batchState);
      return batchState;
    }

    console.log(`Resuming batch with ${incompleteJobs.length} incomplete jobs`);

    batchState.status = BatchStatus.RUNNING;
    this.activeBatches.set(batchId, batchState);

    // Start auto-save
    this.startAutoSave(batchState);

    try {
      // Process incomplete jobs
      const promises = incompleteJobs.map(job =>
        this.queue.add(() => this.processJob(job, batchState))
      );

      await Promise.all(promises);

      batchState.status = BatchStatus.COMPLETED;
      batchState.completedAt = new Date();
      batchState.metrics = this.progressTracker.calculateMetrics(batchState);

      this.metricsCollector.recordBatch(batchState);
      this.emit(BatchEvents.BATCH_COMPLETED, batchState);

    } catch (error) {
      batchState.status = BatchStatus.FAILED;
      this.emit(BatchEvents.BATCH_FAILED, { batchState, error });
      throw error;

    } finally {
      this.stopAutoSave(batchId);
      await this.progressTracker.saveBatch(batchState);
      this.activeBatches.delete(batchId);
    }

    return batchState;
  }

  /**
   * Cancel a running batch
   */
  async cancelBatch(batchId: string): Promise<void> {
    const batchState = this.activeBatches.get(batchId);

    if (!batchState) {
      throw new Error(`Batch not active: ${batchId}`);
    }

    batchState.status = BatchStatus.CANCELLED;
    batchState.completedAt = new Date();

    // Clear queue
    this.queue.clear();

    // Mark pending jobs as cancelled
    for (const job of batchState.jobs) {
      if (job.status === BatchJobStatus.PENDING || job.status === BatchJobStatus.RUNNING) {
        job.status = BatchJobStatus.CANCELLED;
      }
    }

    this.stopAutoSave(batchId);
    await this.progressTracker.saveBatch(batchState);

    this.emit(BatchEvents.BATCH_CANCELLED, batchState);
  }

  /**
   * Get batch state
   */
  async getBatchState(batchId: string): Promise<BatchState | null> {
    return this.activeBatches.get(batchId) || await this.progressTracker.loadBatch(batchId);
  }

  /**
   * List all batches
   */
  async listBatches(): Promise<string[]> {
    return this.progressTracker.listBatches();
  }

  /**
   * Get metrics collector
   */
  getMetrics(): MetricsCollector {
    return this.metricsCollector;
  }

  /**
   * Shutdown batch processor
   */
  shutdown(): void {
    this.queue.clear();
    this.progressTracker.shutdown();

    for (const [batchId, timer] of this.autoSaveTimers.entries()) {
      clearInterval(timer);
    }
    this.autoSaveTimers.clear();
  }

  // Private methods

  private async processJob(job: BatchJob, batchState: BatchState): Promise<void> {
    job.status = BatchJobStatus.RUNNING;
    job.startedAt = new Date();
    job.attempt++;

    this.emit(BatchEvents.JOB_STARTED, job);
    this.updateProgress(batchState);

    try {
      // Generate game content
      const result = await this.generator.generate(job.request);

      job.result = result;
      job.status = BatchJobStatus.COMPLETED;
      job.completedAt = new Date();

      batchState.progress.completed++;
      this.metricsCollector.recordJob(job);

      this.emit(BatchEvents.JOB_COMPLETED, job);

    } catch (error) {
      job.error = error as Error;

      // Retry logic
      if (job.attempt < job.maxRetries) {
        job.status = BatchJobStatus.RETRYING;
        batchState.metrics.retriedJobs++;

        this.emit(BatchEvents.JOB_RETRYING, { job, attempt: job.attempt });

        // Calculate retry delay
        const delay = this.calculateRetryDelay(job.attempt);
        await this.sleep(delay);

        // Retry
        return this.processJob(job, batchState);

      } else {
        job.status = BatchJobStatus.FAILED;
        job.completedAt = new Date();

        batchState.progress.failed++;
        this.metricsCollector.recordJob(job);

        this.emit(BatchEvents.JOB_FAILED, { job, error });
      }

    } finally {
      this.updateProgress(batchState);
      this.emit(BatchEvents.PROGRESS_UPDATE, batchState.progress);
    }
  }

  private updateProgress(batchState: BatchState): void {
    batchState.progress = this.progressTracker.calculateProgress(batchState.jobs);
  }

  private calculateRetryDelay(attempt: number): number {
    const { baseDelay, maxDelay, strategy, jitter } = this.options.retryConfig;

    let delay: number;

    switch (strategy) {
      case 'exponential':
        delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
        break;
      case 'linear':
        delay = Math.min(baseDelay * attempt, maxDelay);
        break;
      case 'constant':
      default:
        delay = baseDelay;
    }

    // Add jitter
    if (jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return delay;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private createInitialProgress(total: number): BatchProgress {
    return {
      total,
      completed: 0,
      failed: 0,
      pending: total,
      running: 0,
      percentage: 0,
      estimatedTimeRemaining: 0,
      averageJobDuration: 0
    };
  }

  private createInitialMetrics(): BatchMetrics {
    return {
      totalJobs: 0,
      successfulJobs: 0,
      failedJobs: 0,
      retriedJobs: 0,
      totalDuration: 0,
      averageDuration: 0,
      minDuration: 0,
      maxDuration: 0,
      throughput: 0,
      errorRate: 0,
      successRate: 0
    };
  }

  private startAutoSave(batchState: BatchState): void {
    const timer = setInterval(async () => {
      await this.progressTracker.saveBatch(batchState);
    }, this.options.autoSaveInterval);

    this.autoSaveTimers.set(batchState.batchId, timer);
  }

  private stopAutoSave(batchId: string): void {
    const timer = this.autoSaveTimers.get(batchId);
    if (timer) {
      clearInterval(timer);
      this.autoSaveTimers.delete(batchId);
    }
  }
}
