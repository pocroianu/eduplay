/**
 * Training Progress Tracker
 *
 * Manages persistent state for training jobs with resume capability.
 * Emits real-time progress events and generates progress reports.
 */

import { EventEmitter } from 'events';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import type { TrainingJob, TrainingProgress, TrainingResult, TrainingError, TrainingStatus } from './types';

/**
 * Progress tracker events
 */
export const PROGRESS_EVENTS = {
  JOB_STARTED: 'job:started',
  JOB_PROGRESS: 'job:progress',
  JOB_COMPLETED: 'job:completed',
  JOB_FAILED: 'job:failed',
  JOB_CANCELLED: 'job:cancelled',
  STATE_SAVED: 'state:saved',
  STATE_LOADED: 'state:loaded',
} as const;

/**
 * Progress tracker configuration
 */
export interface ProgressTrackerConfig {
  stateDir: string; // Directory for persistent state
  autoSave: boolean; // Auto-save on every update
  saveInterval?: number; // Save interval in ms (if not auto-save)
}

/**
 * Training progress tracker
 *
 * Provides persistent state management for training jobs.
 * Allows resuming interrupted training and real-time progress tracking.
 */
export class TrainingProgressTracker extends EventEmitter {
  private jobs: Map<string, TrainingJob> = new Map();
  private config: ProgressTrackerConfig;
  private stateFile: string;
  private saveTimer?: NodeJS.Timeout;
  private isDirty: boolean = false;

  constructor(config?: Partial<ProgressTrackerConfig>) {
    super();

    this.config = {
      stateDir: config?.stateDir || join(process.cwd(), 'training-state'),
      autoSave: config?.autoSave ?? true,
      saveInterval: config?.saveInterval || 5000, // 5 seconds
    };

    this.stateFile = join(this.config.stateDir, 'training-progress.json');

    // Start periodic save if not auto-save
    if (!this.config.autoSave && this.config.saveInterval) {
      this.startPeriodicSave();
    }
  }

  /**
   * Initialize tracker (load existing state)
   */
  async init(): Promise<void> {
    await this.ensureStateDir();
    await this.loadState();
  }

  /**
   * Start tracking a new job
   */
  async startTracking(job: TrainingJob): Promise<void> {
    this.jobs.set(job.id, job);
    this.isDirty = true;

    this.emit(PROGRESS_EVENTS.JOB_STARTED, job);

    if (this.config.autoSave) {
      await this.saveState();
    }
  }

  /**
   * Update job progress
   */
  async updateProgress(jobId: string, progress: Partial<TrainingProgress>): Promise<void> {
    const job = this.jobs.get(jobId);

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    // Merge progress
    job.progress = {
      ...job.progress,
      ...progress,
    };

    // Update timestamps
    job.updatedAt = new Date();

    // Calculate ETA if we have enough data
    if (progress.stepsPerSecond && progress.stepsPerSecond > 0) {
      const remainingSteps = job.progress.totalSteps - job.progress.currentStep;
      const remainingSeconds = remainingSteps / progress.stepsPerSecond;
      job.estimatedEndTime = new Date(Date.now() + remainingSeconds * 1000);
    }

    this.isDirty = true;
    this.emit(PROGRESS_EVENTS.JOB_PROGRESS, job, progress);

    if (this.config.autoSave) {
      await this.saveState();
    }
  }

  /**
   * Update job status
   */
  async updateStatus(jobId: string, status: TrainingStatus): Promise<void> {
    const job = this.jobs.get(jobId);

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    job.status = status;
    job.updatedAt = new Date();

    if (status === 'training' && !job.startedAt) {
      job.startedAt = new Date();
    }

    this.isDirty = true;

    if (this.config.autoSave) {
      await this.saveState();
    }
  }

  /**
   * Mark job as completed
   */
  async completeJob(jobId: string, result: TrainingResult): Promise<void> {
    const job = this.jobs.get(jobId);

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    job.status = 'completed';
    job.result = result;
    job.completedAt = new Date();
    job.updatedAt = new Date();

    this.isDirty = true;
    this.emit(PROGRESS_EVENTS.JOB_COMPLETED, job);

    if (this.config.autoSave) {
      await this.saveState();
    }
  }

  /**
   * Mark job as failed
   */
  async failJob(jobId: string, error: TrainingError): Promise<void> {
    const job = this.jobs.get(jobId);

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    job.status = 'failed';
    job.error = error;
    job.completedAt = new Date();
    job.updatedAt = new Date();

    this.isDirty = true;
    this.emit(PROGRESS_EVENTS.JOB_FAILED, job, error);

    if (this.config.autoSave) {
      await this.saveState();
    }
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    job.status = 'cancelled';
    job.completedAt = new Date();
    job.updatedAt = new Date();

    this.isDirty = true;
    this.emit(PROGRESS_EVENTS.JOB_CANCELLED, job);

    if (this.config.autoSave) {
      await this.saveState();
    }
  }

  /**
   * Get job state by ID
   */
  getJobState(jobId: string): TrainingJob | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Get all jobs
   */
  getAllJobs(): TrainingJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get jobs by status
   */
  getJobsByStatus(status: TrainingStatus): TrainingJob[] {
    return this.getAllJobs().filter((job) => job.status === status);
  }

  /**
   * Get active (in-progress) jobs
   */
  getActiveJobs(): TrainingJob[] {
    return this.getAllJobs().filter(
      (job) => job.status === 'pending' || job.status === 'preparing' || job.status === 'training',
    );
  }

  /**
   * Check if job can be resumed
   */
  canResumeJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);

    if (!job) {
      return false;
    }

    // Can resume if job was in progress and has checkpoints
    return (
      (job.status === 'training' || job.status === 'failed') &&
      job.progress.currentEpoch > 0 &&
      (!job.error || job.error.canResume)
    );
  }

  /**
   * Generate progress report for a job
   */
  generateReport(jobId: string): string {
    const job = this.jobs.get(jobId);

    if (!job) {
      return `Job not found: ${jobId}`;
    }

    const lines: string[] = [];

    lines.push(`Training Job: ${job.name}`);
    lines.push(`ID: ${job.id}`);
    lines.push(`Status: ${job.status.toUpperCase()}`);
    lines.push('');

    if (job.status === 'completed' && job.result) {
      lines.push('Results:');
      lines.push(`  Model: ${job.result.loraPath}`);
      lines.push(`  Size: ${(job.result.modelSize / 1024 / 1024).toFixed(2)} MB`);
      lines.push(`  Final Loss: ${job.result.finalLoss.toFixed(4)}`);
      lines.push(`  Duration: ${(job.result.trainingDuration / 60).toFixed(1)} minutes`);
      lines.push(`  Avg Speed: ${job.result.avgStepsPerSecond.toFixed(2)} steps/sec`);
    } else if (job.status === 'failed' && job.error) {
      lines.push('Error:');
      lines.push(`  Code: ${job.error.code}`);
      lines.push(`  Message: ${job.error.message}`);
      if (job.error.suggestedAction) {
        lines.push(`  Suggested Action: ${job.error.suggestedAction}`);
      }
    } else {
      lines.push('Progress:');
      lines.push(`  Epoch: ${job.progress.currentEpoch} / ${job.progress.totalEpochs}`);
      lines.push(`  Step: ${job.progress.currentStep} / ${job.progress.totalSteps}`);
      lines.push(`  Loss: ${job.progress.currentLoss.toFixed(4)}`);
      lines.push(`  Learning Rate: ${job.progress.learningRate.toExponential(2)}`);
      lines.push(`  Speed: ${job.progress.stepsPerSecond.toFixed(2)} steps/sec`);
      lines.push(`  Progress: ${job.progress.percentage.toFixed(1)}%`);

      if (job.estimatedEndTime) {
        const eta = Math.max(0, job.estimatedEndTime.getTime() - Date.now());
        const etaMinutes = Math.ceil(eta / 1000 / 60);
        lines.push(`  ETA: ${etaMinutes} minutes`);
      }
    }

    lines.push('');
    lines.push('Timing:');
    lines.push(`  Created: ${job.createdAt.toISOString()}`);
    if (job.startedAt) {
      lines.push(`  Started: ${job.startedAt.toISOString()}`);
    }
    if (job.completedAt) {
      lines.push(`  Completed: ${job.completedAt.toISOString()}`);
    }

    return lines.join('\n');
  }

  /**
   * Clear completed jobs older than specified days
   */
  async clearOldJobs(days: number): Promise<number> {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    let cleared = 0;

    for (const [id, job] of this.jobs.entries()) {
      if (
        (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') &&
        job.completedAt &&
        job.completedAt < cutoffDate
      ) {
        this.jobs.delete(id);
        cleared++;
      }
    }

    if (cleared > 0) {
      this.isDirty = true;
      await this.saveState();
    }

    return cleared;
  }

  /**
   * Save state to disk
   */
  async saveState(): Promise<void> {
    await this.ensureStateDir();

    const state = {
      version: '1.0.0',
      savedAt: new Date().toISOString(),
      jobs: Array.from(this.jobs.values()),
    };

    await writeFile(this.stateFile, JSON.stringify(state, null, 2), 'utf-8');

    this.isDirty = false;
    this.emit(PROGRESS_EVENTS.STATE_SAVED, state);
  }

  /**
   * Load state from disk
   */
  async loadState(): Promise<void> {
    if (!existsSync(this.stateFile)) {
      return; // No state to load
    }

    try {
      const content = await readFile(this.stateFile, 'utf-8');
      const state = JSON.parse(content);

      if (!state.jobs || !Array.isArray(state.jobs)) {
        throw new Error('Invalid state file format');
      }

      // Restore jobs
      this.jobs.clear();
      for (const job of state.jobs) {
        // Convert date strings back to Date objects
        job.createdAt = new Date(job.createdAt);
        job.updatedAt = new Date(job.updatedAt);
        if (job.startedAt) job.startedAt = new Date(job.startedAt);
        if (job.completedAt) job.completedAt = new Date(job.completedAt);
        if (job.estimatedEndTime) job.estimatedEndTime = new Date(job.estimatedEndTime);
        if (job.error?.timestamp) job.error.timestamp = new Date(job.error.timestamp);
        if (job.result?.completedAt) job.result.completedAt = new Date(job.result.completedAt);

        this.jobs.set(job.id, job);
      }

      this.isDirty = false;
      this.emit(PROGRESS_EVENTS.STATE_LOADED, state);
    } catch (error) {
      // Don't throw - just log and continue with empty state
      console.error('Failed to load training state:', error);
    }
  }

  /**
   * Ensure state directory exists
   */
  private async ensureStateDir(): Promise<void> {
    if (!existsSync(this.config.stateDir)) {
      await mkdir(this.config.stateDir, { recursive: true });
    }
  }

  /**
   * Start periodic state saving
   */
  private startPeriodicSave(): void {
    this.saveTimer = setInterval(async () => {
      if (this.isDirty) {
        await this.saveState();
      }
    }, this.config.saveInterval);
  }

  /**
   * Stop periodic state saving
   */
  private stopPeriodicSave(): void {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = undefined;
    }
  }

  /**
   * Cleanup (save state and stop timers)
   */
  async cleanup(): Promise<void> {
    this.stopPeriodicSave();

    if (this.isDirty) {
      await this.saveState();
    }

    this.removeAllListeners();
  }
}
