/**
 * Unit tests for ProgressTracker
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProgressTracker } from '../ProgressTracker';
import { BatchState, BatchStatus, BatchJobStatus } from '../types';
import { rm } from 'fs/promises';

const TEST_STATE_DIR = './.test-progress-tracker';

describe('ProgressTracker', () => {
  let tracker: ProgressTracker;

  beforeEach(async () => {
    tracker = new ProgressTracker({
      stateDir: TEST_STATE_DIR,
      snapshotInterval: 100,
      autoSave: false
    });

    await tracker.initialize();
  });

  afterEach(async () => {
    tracker.shutdown();

    // Cleanup test directory
    try {
      await rm(TEST_STATE_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore
    }
  });

  describe('saveBatch and loadBatch', () => {
    it('should save and load batch state', async () => {
      const batch: BatchState = {
        batchId: 'test-batch-1',
        name: 'Test Batch',
        status: BatchStatus.RUNNING,
        jobs: [],
        progress: {
          total: 10,
          completed: 5,
          failed: 1,
          pending: 4,
          running: 0,
          percentage: 50,
          estimatedTimeRemaining: 5000,
          averageJobDuration: 1000
        },
        metrics: {
          totalJobs: 10,
          successfulJobs: 5,
          failedJobs: 1,
          retriedJobs: 0,
          totalDuration: 5000,
          averageDuration: 1000,
          minDuration: 800,
          maxDuration: 1200,
          throughput: 7200,
          errorRate: 0.1,
          successRate: 0.9
        },
        createdAt: new Date(),
        startedAt: new Date()
      };

      await tracker.saveBatch(batch);

      const loaded = await tracker.loadBatch('test-batch-1');

      expect(loaded).toBeDefined();
      expect(loaded?.batchId).toBe('test-batch-1');
      expect(loaded?.status).toBe(BatchStatus.RUNNING);
      expect(loaded?.progress.completed).toBe(5);
      expect(loaded?.metrics.successRate).toBe(0.9);
    });

    it('should return null for non-existent batch', async () => {
      const loaded = await tracker.loadBatch('non-existent');

      expect(loaded).toBeNull();
    });

    it('should preserve dates correctly', async () => {
      const now = new Date();
      const batch: BatchState = {
        batchId: 'test-batch-dates',
        name: 'Test Dates',
        status: BatchStatus.COMPLETED,
        jobs: [],
        progress: {
          total: 1,
          completed: 1,
          failed: 0,
          pending: 0,
          running: 0,
          percentage: 100,
          estimatedTimeRemaining: 0,
          averageJobDuration: 1000
        },
        metrics: {
          totalJobs: 1,
          successfulJobs: 1,
          failedJobs: 0,
          retriedJobs: 0,
          totalDuration: 1000,
          averageDuration: 1000,
          minDuration: 1000,
          maxDuration: 1000,
          throughput: 3600,
          errorRate: 0,
          successRate: 1
        },
        createdAt: now,
        startedAt: now,
        completedAt: now
      };

      await tracker.saveBatch(batch);
      const loaded = await tracker.loadBatch('test-batch-dates');

      expect(loaded?.createdAt).toBeInstanceOf(Date);
      expect(loaded?.startedAt).toBeInstanceOf(Date);
      expect(loaded?.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('listBatches', () => {
    it('should list all saved batches', async () => {
      // Save multiple batches
      for (let i = 0; i < 3; i++) {
        const batch: BatchState = {
          batchId: `test-batch-${i}`,
          name: `Test Batch ${i}`,
          status: BatchStatus.COMPLETED,
          jobs: [],
          progress: {
            total: 1,
            completed: 1,
            failed: 0,
            pending: 0,
            running: 0,
            percentage: 100,
            estimatedTimeRemaining: 0,
            averageJobDuration: 1000
          },
          metrics: {
            totalJobs: 1,
            successfulJobs: 1,
            failedJobs: 0,
            retriedJobs: 0,
            totalDuration: 1000,
            averageDuration: 1000,
            minDuration: 1000,
            maxDuration: 1000,
            throughput: 3600,
            errorRate: 0,
            successRate: 1
          },
          createdAt: new Date()
        };

        await tracker.saveBatch(batch);
      }

      const batches = await tracker.listBatches();

      expect(batches.length).toBe(3);
      expect(batches).toContain('test-batch-0');
      expect(batches).toContain('test-batch-1');
      expect(batches).toContain('test-batch-2');
    });

    it('should return empty array when no batches exist', async () => {
      const batches = await tracker.listBatches();

      expect(batches).toEqual([]);
    });
  });

  describe('deleteBatch', () => {
    it('should delete batch state', async () => {
      const batch: BatchState = {
        batchId: 'test-batch-delete',
        name: 'Test Delete',
        status: BatchStatus.COMPLETED,
        jobs: [],
        progress: {
          total: 1,
          completed: 1,
          failed: 0,
          pending: 0,
          running: 0,
          percentage: 100,
          estimatedTimeRemaining: 0,
          averageJobDuration: 1000
        },
        metrics: {
          totalJobs: 1,
          successfulJobs: 1,
          failedJobs: 0,
          retriedJobs: 0,
          totalDuration: 1000,
          averageDuration: 1000,
          minDuration: 1000,
          maxDuration: 1000,
          throughput: 3600,
          errorRate: 0,
          successRate: 1
        },
        createdAt: new Date()
      };

      await tracker.saveBatch(batch);

      // Verify it exists
      let loaded = await tracker.loadBatch('test-batch-delete');
      expect(loaded).toBeDefined();

      // Delete it
      await tracker.deleteBatch('test-batch-delete');

      // Verify it's gone
      loaded = await tracker.loadBatch('test-batch-delete');
      expect(loaded).toBeNull();
    });
  });

  describe('calculateProgress', () => {
    it('should calculate progress from jobs', () => {
      const jobs = [
        { status: BatchJobStatus.COMPLETED } as any,
        { status: BatchJobStatus.COMPLETED } as any,
        { status: BatchJobStatus.FAILED } as any,
        { status: BatchJobStatus.PENDING } as any,
        { status: BatchJobStatus.RUNNING } as any
      ];

      const progress = tracker.calculateProgress(jobs);

      expect(progress.total).toBe(5);
      expect(progress.completed).toBe(2);
      expect(progress.failed).toBe(1);
      expect(progress.pending).toBe(1);
      expect(progress.running).toBe(1);
      expect(progress.percentage).toBe(40);
    });

    it('should calculate ETA correctly', () => {
      const now = Date.now();
      const jobs = [
        {
          status: BatchJobStatus.COMPLETED,
          startedAt: new Date(now - 2000),
          completedAt: new Date(now - 1000)
        } as any,
        {
          status: BatchJobStatus.COMPLETED,
          startedAt: new Date(now - 1000),
          completedAt: new Date(now)
        } as any,
        { status: BatchJobStatus.PENDING } as any,
        { status: BatchJobStatus.PENDING } as any
      ];

      const progress = tracker.calculateProgress(jobs);

      expect(progress.averageJobDuration).toBe(1000);
      expect(progress.estimatedTimeRemaining).toBe(2000);
    });
  });

  describe('calculateMetrics', () => {
    it('should calculate batch metrics', () => {
      const batch: BatchState = {
        batchId: 'test-metrics',
        name: 'Test Metrics',
        status: BatchStatus.COMPLETED,
        jobs: [
          {
            status: BatchJobStatus.COMPLETED,
            attempt: 1,
            startedAt: new Date(Date.now() - 2000),
            completedAt: new Date(Date.now() - 1000)
          } as any,
          {
            status: BatchJobStatus.COMPLETED,
            attempt: 1,
            startedAt: new Date(Date.now() - 1000),
            completedAt: new Date(Date.now())
          } as any,
          {
            status: BatchJobStatus.FAILED,
            attempt: 3
          } as any
        ],
        progress: {} as any,
        metrics: { retriedJobs: 2 } as any,
        createdAt: new Date(Date.now() - 5000),
        startedAt: new Date(Date.now() - 5000),
        completedAt: new Date()
      };

      const metrics = tracker.calculateMetrics(batch);

      expect(metrics.totalJobs).toBe(3);
      expect(metrics.successfulJobs).toBe(2);
      expect(metrics.failedJobs).toBe(1);
      expect(metrics.retriedJobs).toBe(2);
      expect(metrics.successRate).toBeCloseTo(2 / 3);
      expect(metrics.errorRate).toBeCloseTo(1 / 3);
      expect(metrics.averageDuration).toBe(1000);
    });
  });
});
