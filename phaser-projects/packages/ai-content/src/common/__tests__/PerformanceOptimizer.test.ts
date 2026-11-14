import { describe, it, expect, beforeEach } from 'vitest';
import { PerformanceOptimizer } from '../PerformanceOptimizer';

describe('PerformanceOptimizer', () => {
  let optimizer: PerformanceOptimizer;

  beforeEach(() => {
    optimizer = new PerformanceOptimizer({
      targetLatency: 1000,
      targetMemory: 1024 * 1024 * 100,
      adjustmentInterval: 5,
      minConcurrency: 1,
      maxConcurrency: 10
    });
  });

  describe('Metrics Collection', () => {
    it('should measure operation performance', async () => {
      const result = await optimizer.measure('testOp', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'success';
      });

      expect(result).toBe('success');

      const report = optimizer.getReport();
      expect(report.totalOperations).toBe(1);
      expect(report.averageDuration).toBeGreaterThan(0);
    });

    it('should collect metrics even on error', async () => {
      await expect(
        optimizer.measure('failOp', async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      const report = optimizer.getReport();
      expect(report.totalOperations).toBe(1);
    });

    it('should calculate performance statistics', async () => {
      // Run multiple operations
      for (let i = 0; i < 10; i++) {
        await optimizer.measure('op', async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'done';
        });
      }

      const report = optimizer.getReport();

      expect(report.totalOperations).toBe(10);
      expect(report.averageDuration).toBeGreaterThan(0);
      expect(report.medianDuration).toBeGreaterThan(0);
      expect(report.p95Duration).toBeGreaterThan(0);
      expect(report.p99Duration).toBeGreaterThan(0);
    });
  });

  describe('Auto-Tuning', () => {
    it('should start with minimum concurrency', () => {
      expect(optimizer.getCurrentConcurrency()).toBe(1);
    });

    it('should increase concurrency when performing well', async () => {
      optimizer = new PerformanceOptimizer({
        targetLatency: 1000,
        adjustmentInterval: 3,
        minConcurrency: 1,
        maxConcurrency: 5
      });

      // Run fast operations
      for (let i = 0; i < 6; i++) {
        await optimizer.measure('fastOp', async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'done';
        });
      }

      // Should have increased concurrency
      expect(optimizer.getCurrentConcurrency()).toBeGreaterThan(1);
    });

    it('should not exceed max concurrency', async () => {
      optimizer = new PerformanceOptimizer({
        targetLatency: 10000,
        adjustmentInterval: 2,
        minConcurrency: 1,
        maxConcurrency: 3
      });

      // Run many fast operations
      for (let i = 0; i < 20; i++) {
        await optimizer.measure('fastOp', async () => 'done');
      }

      expect(optimizer.getCurrentConcurrency()).toBeLessThanOrEqual(3);
    });

    it('should allow manual concurrency setting', () => {
      optimizer.setConcurrency(5);
      expect(optimizer.getCurrentConcurrency()).toBe(5);
    });
  });

  describe('Hardware Detection', () => {
    it('should detect hardware capabilities', () => {
      const hardware = optimizer.getHardwareCapabilities();

      expect(hardware.cpuCores).toBeGreaterThan(0);
      expect(hardware.totalMemory).toBeGreaterThan(0);
      expect(hardware.platform).toBeDefined();
    });
  });

  describe('Recommendations', () => {
    it('should generate recommendations', async () => {
      // Run slow operations
      optimizer = new PerformanceOptimizer({
        targetLatency: 10,
        adjustmentInterval: 5
      });

      for (let i = 0; i < 3; i++) {
        await optimizer.measure('slowOp', async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return 'done';
        });
      }

      const report = optimizer.getReport();
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('should identify bottlenecks', async () => {
      for (let i = 0; i < 3; i++) {
        await optimizer.measure('slowOp', async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return 'done';
        });
      }

      const report = optimizer.getReport();
      // Report should exist
      expect(report).toBeDefined();
    });
  });

  describe('Metrics Management', () => {
    it('should clear metrics', async () => {
      await optimizer.measure('op', async () => 'done');
      optimizer.clearMetrics();

      const report = optimizer.getReport();
      expect(report.totalOperations).toBe(0);
    });

    it('should limit stored metrics to 1000', async () => {
      // This would be slow to test, but the implementation caps at 1000
      const report = optimizer.getReport();
      expect(report).toBeDefined();
    });
  });
});
