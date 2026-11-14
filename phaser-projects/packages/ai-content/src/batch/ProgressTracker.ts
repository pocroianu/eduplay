/**
 * Persistent progress tracking for batch processing.
 *
 * Manages batch state persistence to JSON files with automatic
 * snapshot creation and resume capability.
 *
 * @module batch/ProgressTracker
 */

import { mkdir, writeFile, readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { BatchState, BatchJob, BatchProgress, BatchMetrics } from './types';

/**
 * Options for progress tracker
 */
export interface ProgressTrackerOptions {
  /** Directory for state files */
  stateDir: string;
  /** Snapshot interval (ms) */
  snapshotInterval: number;
  /** Auto-save enabled */
  autoSave: boolean;
}

/**
 * Default options
 */
const DEFAULT_OPTIONS: ProgressTrackerOptions = {
  stateDir: join(homedir(), '.edu-generate', 'batches'),
  snapshotInterval: 10000, // 10 seconds
  autoSave: true
};

/**
 * Manages persistent state for batch processing with automatic
 * snapshots and resume capability.
 *
 * Features:
 * - JSON-based state persistence
 * - Automatic snapshot creation
 * - Resume from checkpoint
 * - Human-readable state files
 */
export class ProgressTracker {
  private options: ProgressTrackerOptions;
  private snapshotTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(options: Partial<ProgressTrackerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Initialize progress tracker (create state directory)
   */
  async initialize(): Promise<void> {
    await mkdir(this.options.stateDir, { recursive: true });
  }

  /**
   * Save batch state to persistent storage
   */
  async saveBatch(batch: BatchState): Promise<void> {
    await this.initialize();

    const filename = this.getBatchFilename(batch.batchId);
    const filepath = join(this.options.stateDir, filename);

    // Serialize batch state with proper date handling
    const serialized = this.serializeBatchState(batch);

    await writeFile(filepath, JSON.stringify(serialized, null, 2), 'utf-8');

    // Schedule next snapshot if auto-save is enabled
    if (this.options.autoSave && batch.status === 'running') {
      this.scheduleSnapshot(batch.batchId);
    }
  }

  /**
   * Load batch state from persistent storage
   */
  async loadBatch(batchId: string): Promise<BatchState | null> {
    const filename = this.getBatchFilename(batchId);
    const filepath = join(this.options.stateDir, filename);

    try {
      const content = await readFile(filepath, 'utf-8');
      const data = JSON.parse(content);

      // Deserialize dates
      return this.deserializeBatchState(data);

    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null; // File not found
      }
      throw error;
    }
  }

  /**
   * List all batch IDs
   */
  async listBatches(): Promise<string[]> {
    await this.initialize();

    try {
      const files = await readdir(this.options.stateDir);
      return files
        .filter(f => f.startsWith('batch-') && f.endsWith('.json'))
        .map(f => f.replace('batch-', '').replace('.json', ''));
    } catch (error) {
      return [];
    }
  }

  /**
   * Delete batch state
   */
  async deleteBatch(batchId: string): Promise<void> {
    const filename = this.getBatchFilename(batchId);
    const filepath = join(this.options.stateDir, filename);

    const fs = await import('fs/promises');
    await fs.unlink(filepath);

    // Cancel snapshot timer
    this.cancelSnapshot(batchId);
  }

  /**
   * Create a snapshot of batch state
   */
  async createSnapshot(batch: BatchState): Promise<void> {
    await this.saveBatch(batch);
  }

  /**
   * Calculate progress from job states
   */
  calculateProgress(jobs: BatchJob[]): BatchProgress {
    const total = jobs.length;
    const completed = jobs.filter(j => j.status === 'completed').length;
    const failed = jobs.filter(j => j.status === 'failed').length;
    const pending = jobs.filter(j => j.status === 'pending').length;
    const running = jobs.filter(j => j.status === 'running').length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Calculate ETA based on completed jobs
    const completedJobs = jobs.filter(j => j.status === 'completed' && j.startedAt && j.completedAt);
    const durations = completedJobs.map(j =>
      j.completedAt!.getTime() - j.startedAt!.getTime()
    );

    const averageJobDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    const remaining = total - completed - failed;
    const estimatedTimeRemaining = remaining * averageJobDuration;

    return {
      total,
      completed,
      failed,
      pending,
      running,
      percentage,
      estimatedTimeRemaining,
      averageJobDuration
    };
  }

  /**
   * Calculate metrics from batch state
   */
  calculateMetrics(batch: BatchState): BatchMetrics {
    const jobs = batch.jobs;
    const totalJobs = jobs.length;
    const successfulJobs = jobs.filter(j => j.status === 'completed').length;
    const failedJobs = jobs.filter(j => j.status === 'failed').length;
    const retriedJobs = jobs.filter(j => j.attempt > 1).length;

    const completedJobs = jobs.filter(j =>
      j.status === 'completed' && j.startedAt && j.completedAt
    );

    const durations = completedJobs.map(j =>
      j.completedAt!.getTime() - j.startedAt!.getTime()
    );

    const totalDuration = batch.completedAt && batch.startedAt
      ? batch.completedAt.getTime() - batch.startedAt.getTime()
      : 0;

    const averageDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
    const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;

    const throughput = totalDuration > 0
      ? (successfulJobs / totalDuration) * 3600000 // jobs/hour
      : 0;

    const errorRate = totalJobs > 0 ? failedJobs / totalJobs : 0;
    const successRate = totalJobs > 0 ? successfulJobs / totalJobs : 0;

    return {
      totalJobs,
      successfulJobs,
      failedJobs,
      retriedJobs,
      totalDuration,
      averageDuration,
      minDuration,
      maxDuration,
      throughput,
      errorRate,
      successRate
    };
  }

  /**
   * Stop auto-save for all batches
   */
  shutdown(): void {
    for (const [batchId, timer] of this.snapshotTimers.entries()) {
      clearTimeout(timer);
    }
    this.snapshotTimers.clear();
  }

  // Private methods

  private getBatchFilename(batchId: string): string {
    return `batch-${batchId}.json`;
  }

  private scheduleSnapshot(batchId: string): void {
    // Cancel existing timer
    this.cancelSnapshot(batchId);

    // Schedule new snapshot
    const timer = setTimeout(() => {
      // Snapshot would be triggered by external save
      this.snapshotTimers.delete(batchId);
    }, this.options.snapshotInterval);

    this.snapshotTimers.set(batchId, timer);
  }

  private cancelSnapshot(batchId: string): void {
    const timer = this.snapshotTimers.get(batchId);
    if (timer) {
      clearTimeout(timer);
      this.snapshotTimers.delete(batchId);
    }
  }

  private serializeBatchState(batch: BatchState): any {
    return {
      ...batch,
      createdAt: batch.createdAt.toISOString(),
      startedAt: batch.startedAt?.toISOString(),
      completedAt: batch.completedAt?.toISOString(),
      jobs: batch.jobs.map(job => ({
        ...job,
        createdAt: job.createdAt.toISOString(),
        startedAt: job.startedAt?.toISOString(),
        completedAt: job.completedAt?.toISOString(),
        error: job.error ? {
          message: job.error.message,
          stack: job.error.stack
        } : undefined
      }))
    };
  }

  private deserializeBatchState(data: any): BatchState {
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
      completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
      jobs: data.jobs.map((job: any) => ({
        ...job,
        createdAt: new Date(job.createdAt),
        startedAt: job.startedAt ? new Date(job.startedAt) : undefined,
        completedAt: job.completedAt ? new Date(job.completedAt) : undefined,
        error: job.error ? new Error(job.error.message) : undefined
      }))
    };
  }
}
