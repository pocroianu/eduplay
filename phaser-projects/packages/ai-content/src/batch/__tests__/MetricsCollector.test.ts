/**
 * Unit tests for MetricsCollector
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MetricsCollector } from '../MetricsCollector';
import { BatchState, BatchStatus, BatchJobStatus } from '../types';
import { rm } from 'fs/promises';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  describe('recordBatch', () => {
    it('should record batch metrics', () => {
      const batch: BatchState = {
        batchId: 'test-batch',
        name: 'Test Batch',
        status: BatchStatus.COMPLETED,
        jobs: [
          {
            id: 'job-1',
            status: BatchJobStatus.COMPLETED,
            startedAt: new Date(Date.now() - 2000),
            completedAt: new Date(Date.now() - 1000)
          } as any
        ],
        progress: {} as any,
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
        createdAt: new Date(Date.now() - 2000),
        startedAt: new Date(Date.now() - 2000),
        completedAt: new Date()
      };

      collector.recordBatch(batch);

      const summary = collector.getSummary();
      expect(summary.totalJobs).toBe(1);
      expect(summary.successRate).toBe(1);
    });

    it('should track error types', () => {
      const batch: BatchState = {
        batchId: 'test-batch-errors',
        name: 'Test Errors',
        status: BatchStatus.COMPLETED,
        jobs: [
          {
            id: 'job-1',
            status: BatchJobStatus.FAILED,
            error: new Error('Network error: Connection failed')
          } as any,
          {
            id: 'job-2',
            status: BatchJobStatus.FAILED,
            error: new Error('Validation error: Quality too low')
          } as any,
          {
            id: 'job-3',
            status: BatchJobStatus.FAILED,
            error: new Error('Network error: Timeout')
          } as any
        ],
        progress: {} as any,
        metrics: {
          totalJobs: 3,
          successfulJobs: 0,
          failedJobs: 3,
          retriedJobs: 0,
          totalDuration: 3000,
          averageDuration: 1000,
          minDuration: 1000,
          maxDuration: 1000,
          throughput: 3600,
          errorRate: 1,
          successRate: 0
        },
        createdAt: new Date(),
        completedAt: new Date()
      };

      collector.recordBatch(batch);

      const report = collector.generateReport();
      expect(report.errorBreakdown['Network error']).toBe(2);
      expect(report.errorBreakdown['Validation error']).toBe(1);
    });
  });

  describe('recordJob', () => {
    it('should record individual job metrics', () => {
      const job = {
        id: 'job-1',
        batchId: 'batch-1',
        gameId: 'game-1',
        status: BatchJobStatus.COMPLETED,
        startedAt: new Date(Date.now() - 1500),
        completedAt: new Date()
      } as any;

      collector.recordJob(job);

      const summary = collector.getSummary();
      expect(summary.totalJobs).toBe(1);
      expect(summary.averageDuration).toBeGreaterThan(1000);
    });
  });

  describe('generateReport', () => {
    it('should generate comprehensive report', () => {
      const now = Date.now();

      // Record multiple jobs
      for (let i = 0; i < 5; i++) {
        const duration = 1000 + i * 100;
        collector.recordJob({
          id: `job-${i}`,
          status: BatchJobStatus.COMPLETED,
          startedAt: new Date(now - duration),
          completedAt: new Date(now)
        } as any);
      }

      // Record one failed job
      collector.recordJob({
        id: 'job-failed',
        status: BatchJobStatus.FAILED,
        error: new Error('Test error')
      } as any);

      const report = collector.generateReport();

      expect(report.totalJobs).toBe(6);
      expect(report.successRate).toBeCloseTo(5 / 6);
      expect(report.averageJobDuration).toBeGreaterThan(1000);
      expect(report.medianJobDuration).toBeGreaterThan(0);
      expect(report.p95JobDuration).toBeGreaterThan(0);
      expect(report.p99JobDuration).toBeGreaterThan(0);
    });

    it('should calculate percentiles correctly', () => {
      const durations = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

      for (const duration of durations) {
        collector.recordJob({
          id: `job-${duration}`,
          status: BatchJobStatus.COMPLETED,
          startedAt: new Date(Date.now() - duration),
          completedAt: new Date()
        } as any);
      }

      const report = collector.generateReport();

      expect(report.medianJobDuration).toBeGreaterThan(400);
      expect(report.medianJobDuration).toBeLessThan(600);
      expect(report.p95JobDuration).toBeGreaterThan(900);
      expect(report.p99JobDuration).toBeGreaterThan(900);
    });

    it('should filter by date range', () => {
      const now = Date.now();
      const yesterday = now - 86400000;

      // Record old job
      collector.recordJob({
        id: 'old-job',
        status: BatchJobStatus.COMPLETED,
        startedAt: new Date(yesterday - 1000),
        completedAt: new Date(yesterday)
      } as any);

      // Record recent job
      collector.recordJob({
        id: 'recent-job',
        status: BatchJobStatus.COMPLETED,
        startedAt: new Date(now - 1000),
        completedAt: new Date(now)
      } as any);

      const report = collector.generateReport(new Date(now - 3600000), new Date());

      expect(report.totalJobs).toBe(1);
    });
  });

  describe('exportToJSON', () => {
    it('should export report to JSON file', async () => {
      collector.recordJob({
        id: 'job-1',
        status: BatchJobStatus.COMPLETED,
        startedAt: new Date(Date.now() - 1000),
        completedAt: new Date()
      } as any);

      const filepath = './.test-metrics-report.json';

      await collector.exportToJSON(filepath);

      // Verify file exists
      const fs = await import('fs/promises');
      const content = await fs.readFile(filepath, 'utf-8');
      const report = JSON.parse(content);

      expect(report.totalJobs).toBe(1);

      // Cleanup
      await rm(filepath);
    });
  });

  describe('exportToCSV', () => {
    it('should export report to CSV file', async () => {
      collector.recordJob({
        id: 'job-1',
        status: BatchJobStatus.COMPLETED,
        startedAt: new Date(Date.now() - 1000),
        completedAt: new Date()
      } as any);

      const filepath = './.test-metrics-report.csv';

      await collector.exportToCSV(filepath);

      // Verify file exists
      const fs = await import('fs/promises');
      const content = await fs.readFile(filepath, 'utf-8');

      expect(content).toContain('Metric,Value');
      expect(content).toContain('Total Jobs,1');

      // Cleanup
      await rm(filepath);
    });
  });

  describe('getSummary', () => {
    it('should return quick summary', () => {
      collector.recordJob({
        id: 'job-1',
        status: BatchJobStatus.COMPLETED,
        startedAt: new Date(Date.now() - 1000),
        completedAt: new Date()
      } as any);

      const summary = collector.getSummary();

      expect(summary.totalJobs).toBe(1);
      expect(summary.averageDuration).toBeGreaterThan(0);
      expect(summary.successRate).toBe(1);
      expect(summary.throughput).toBeGreaterThan(0);
    });
  });

  describe('clear', () => {
    it('should clear all metrics', () => {
      collector.recordJob({
        id: 'job-1',
        status: BatchJobStatus.COMPLETED,
        startedAt: new Date(Date.now() - 1000),
        completedAt: new Date()
      } as any);

      let summary = collector.getSummary();
      expect(summary.totalJobs).toBe(1);

      collector.clear();

      summary = collector.getSummary();
      expect(summary.totalJobs).toBe(0);
    });
  });
});
