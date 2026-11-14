/**
 * Unit tests for BatchProcessor
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BatchProcessor, BatchEvents } from '../BatchProcessor';
import { BatchJobStatus, BatchStatus } from '../types';
import { EventEmitter } from 'events';

// Mock GameContentGenerator
class MockGameContentGenerator extends EventEmitter {
  async generate(request: any) {
    // Simulate generation time
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      gameId: request.gameId,
      metadata: { generatedAt: new Date() },
      config: {},
      i18n: {},
      assets: { images: [], audio: [], totalSize: 0 },
      validation: { passed: true, overallScore: 0.9, imageScores: [], textScores: [], audioScores: [], issues: [] },
      generationTime: 100
    };
  }
}

describe('BatchProcessor', () => {
  let processor: BatchProcessor;
  let mockGenerator: MockGameContentGenerator;

  beforeEach(() => {
    mockGenerator = new MockGameContentGenerator();
    processor = new BatchProcessor(mockGenerator as any, {
      concurrency: 2,
      stateDir: './.test-batch-state',
      autoSaveInterval: 500
    });
  });

  afterEach(() => {
    processor.shutdown();
  });

  describe('processBatch', () => {
    it('should process a simple batch successfully', async () => {
      const request = {
        batchId: 'test-batch-1',
        name: 'Test Batch',
        template: 'multiple-choice',
        category: 'fruits',
        count: 3,
        options: {
          theme: 'nature',
          difficulty: 'easy' as const,
          languages: ['en'],
          questionCount: 5,
          validate: false,
          remediate: false,
          outputDir: './test-output'
        }
      };

      const result = await processor.processBatch(request);

      expect(result.status).toBe(BatchStatus.COMPLETED);
      expect(result.jobs.length).toBe(3);
      expect(result.progress.completed).toBe(3);
      expect(result.progress.failed).toBe(0);
      expect(result.metrics.successRate).toBe(1);
    });

    it('should emit batch events', async () => {
      const events: string[] = [];

      processor.on(BatchEvents.BATCH_STARTED, () => events.push('started'));
      processor.on(BatchEvents.JOB_COMPLETED, () => events.push('job-completed'));
      processor.on(BatchEvents.BATCH_COMPLETED, () => events.push('batch-completed'));

      const request = {
        batchId: 'test-batch-2',
        name: 'Test Batch',
        template: 'multiple-choice',
        category: 'fruits',
        count: 2,
        options: {
          theme: 'nature',
          difficulty: 'easy' as const,
          languages: ['en'],
          questionCount: 5,
          validate: false,
          remediate: false,
          outputDir: './test-output'
        }
      };

      await processor.processBatch(request);

      expect(events).toContain('started');
      expect(events).toContain('job-completed');
      expect(events).toContain('batch-completed');
    });

    it('should update progress correctly', async () => {
      let progressUpdates = 0;

      processor.on(BatchEvents.PROGRESS_UPDATE, (progress) => {
        progressUpdates++;
        expect(progress.total).toBe(3);
        expect(progress.percentage).toBeGreaterThanOrEqual(0);
        expect(progress.percentage).toBeLessThanOrEqual(100);
      });

      const request = {
        batchId: 'test-batch-3',
        name: 'Test Batch',
        template: 'multiple-choice',
        category: 'fruits',
        count: 3,
        options: {
          theme: 'nature',
          difficulty: 'easy' as const,
          languages: ['en'],
          questionCount: 5,
          validate: false,
          remediate: false,
          outputDir: './test-output'
        }
      };

      await processor.processBatch(request);

      expect(progressUpdates).toBeGreaterThan(0);
    });

    it('should calculate metrics correctly', async () => {
      const request = {
        batchId: 'test-batch-4',
        name: 'Test Batch',
        template: 'multiple-choice',
        category: 'fruits',
        count: 3,
        options: {
          theme: 'nature',
          difficulty: 'easy' as const,
          languages: ['en'],
          questionCount: 5,
          validate: false,
          remediate: false,
          outputDir: './test-output'
        }
      };

      const result = await processor.processBatch(request);

      expect(result.metrics.totalJobs).toBe(3);
      expect(result.metrics.successfulJobs).toBe(3);
      expect(result.metrics.failedJobs).toBe(0);
      expect(result.metrics.successRate).toBe(1);
      expect(result.metrics.averageDuration).toBeGreaterThan(0);
      expect(result.metrics.throughput).toBeGreaterThan(0);
    });
  });

  describe('resumeBatch', () => {
    it('should resume incomplete batch', async () => {
      // First, create a batch with some failed jobs
      const mockFailingGenerator = {
        generate: vi.fn()
          .mockRejectedValueOnce(new Error('Generation failed'))
          .mockResolvedValue({
            gameId: 'test',
            metadata: {},
            config: {},
            i18n: {},
            assets: { images: [], audio: [], totalSize: 0 },
            validation: { passed: true, overallScore: 0.9, imageScores: [], textScores: [], audioScores: [], issues: [] },
            generationTime: 100
          })
      };

      const failingProcessor = new BatchProcessor(mockFailingGenerator as any, {
        concurrency: 1,
        stateDir: './.test-batch-state'
      });

      const request = {
        batchId: 'test-resume-batch',
        name: 'Test Resume',
        template: 'multiple-choice',
        category: 'fruits',
        count: 2,
        options: {
          theme: 'nature',
          difficulty: 'easy' as const,
          languages: ['en'],
          questionCount: 5,
          validate: false,
          remediate: false,
          outputDir: './test-output'
        }
      };

      try {
        await failingProcessor.processBatch(request);
      } catch (error) {
        // Expected to fail
      }

      failingProcessor.shutdown();

      // Now resume with working generator
      const result = await processor.resumeBatch('test-resume-batch');

      expect(result.status).toBe(BatchStatus.COMPLETED);
    });
  });

  describe('getBatchState', () => {
    it('should retrieve batch state', async () => {
      const request = {
        batchId: 'test-state-batch',
        name: 'Test State',
        template: 'multiple-choice',
        category: 'fruits',
        count: 2,
        options: {
          theme: 'nature',
          difficulty: 'easy' as const,
          languages: ['en'],
          questionCount: 5,
          validate: false,
          remediate: false,
          outputDir: './test-output'
        }
      };

      await processor.processBatch(request);

      const state = await processor.getBatchState('test-state-batch');

      expect(state).toBeDefined();
      expect(state?.batchId).toBe('test-state-batch');
      expect(state?.status).toBe(BatchStatus.COMPLETED);
    });

    it('should return null for non-existent batch', async () => {
      const state = await processor.getBatchState('non-existent-batch');

      expect(state).toBeNull();
    });
  });

  describe('cancelBatch', () => {
    it('should cancel running batch', async () => {
      const request = {
        batchId: 'test-cancel-batch',
        name: 'Test Cancel',
        template: 'multiple-choice',
        category: 'fruits',
        count: 10,
        options: {
          theme: 'nature',
          difficulty: 'easy' as const,
          languages: ['en'],
          questionCount: 5,
          validate: false,
          remediate: false,
          outputDir: './test-output'
        }
      };

      // Start batch (don't await)
      const batchPromise = processor.processBatch(request);

      // Wait a bit for batch to start
      await new Promise(resolve => setTimeout(resolve, 100));

      // Cancel batch
      await processor.cancelBatch('test-cancel-batch');

      // Check state
      const state = await processor.getBatchState('test-cancel-batch');
      expect(state?.status).toBe(BatchStatus.CANCELLED);

      // Wait for promise to settle
      try {
        await batchPromise;
      } catch (error) {
        // Expected
      }
    });
  });
});
