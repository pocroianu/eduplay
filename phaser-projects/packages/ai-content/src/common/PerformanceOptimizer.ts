/**
 * Performance monitoring and optimization.
 *
 * Features:
 * - Metrics collection (latency, memory, CPU)
 * - Auto-tuning concurrency based on performance
 * - Hardware capability detection
 * - Performance reporting and recommendations
 * - Bottleneck identification
 */

import { Logger } from './Logger';
import * as os from 'os';

/**
 * Performance metrics for a single operation
 */
export interface PerformanceMetrics {
  operationName: string;
  duration: number;
  timestamp: Date;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
}

/**
 * Auto-tuning configuration
 */
export interface AutoTuneConfig {
  /** Target operation time (ms) */
  targetLatency: number;

  /** Target memory usage (bytes) */
  targetMemory: number;

  /** How often to adjust (number of operations) */
  adjustmentInterval: number;

  /** Minimum concurrency */
  minConcurrency: number;

  /** Maximum concurrency */
  maxConcurrency: number;
}

/**
 * Hardware capabilities
 */
export interface HardwareCapabilities {
  cpuCores: number;
  totalMemory: number;
  freeMemory: number;
  platform: string;
  gpuAvailable: boolean;
  estimatedGpuMemory?: number;
}

/**
 * Performance report
 */
export interface PerformanceReport {
  totalOperations: number;
  averageDuration: number;
  medianDuration: number;
  p95Duration: number;
  p99Duration: number;
  averageMemory: number;
  peakMemory: number;
  currentConcurrency: number;
  recommendations: string[];
  bottlenecks: string[];
}

/**
 * Default auto-tune configuration
 */
const DEFAULT_AUTO_TUNE_CONFIG: AutoTuneConfig = {
  targetLatency: 10000,           // 10 seconds
  targetMemory: 1024 * 1024 * 512, // 512 MB
  adjustmentInterval: 10,          // Adjust every 10 operations
  minConcurrency: 1,
  maxConcurrency: 10
};

/**
 * Performance optimization and auto-tuning.
 *
 * @example
 * ```typescript
 * const optimizer = new PerformanceOptimizer({
 *   targetLatency: 5000,
 *   maxConcurrency: 8
 * });
 *
 * // Measure operation
 * const result = await optimizer.measure('imageGeneration', async () => {
 *   return await provider.generate(...);
 * });
 *
 * // Auto-tune concurrency
 * const newConcurrency = optimizer.autoTune();
 *
 * // Get performance report
 * const report = optimizer.getReport();
 * ```
 */
export class PerformanceOptimizer {
  private metrics: PerformanceMetrics[] = [];
  private currentConcurrency: number;
  private operationCount: number = 0;
  private logger: Logger;
  private config: AutoTuneConfig;
  private hardwareCapabilities: HardwareCapabilities;

  constructor(config: Partial<AutoTuneConfig> = {}) {
    this.config = { ...DEFAULT_AUTO_TUNE_CONFIG, ...config };
    this.currentConcurrency = this.config.minConcurrency;
    this.logger = new Logger('PerformanceOptimizer');
    this.hardwareCapabilities = this.detectHardware();

    this.logger.info('Performance optimizer initialized', {
      config: this.config,
      hardware: this.hardwareCapabilities
    });
  }

  /**
   * Detect hardware capabilities
   */
  detectHardware(): HardwareCapabilities {
    const capabilities: HardwareCapabilities = {
      cpuCores: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      platform: os.platform(),
      gpuAvailable: false
    };

    // Try to detect GPU (basic check)
    // In production, this would use nvidia-smi or similar
    if (process.env.NVIDIA_VISIBLE_DEVICES !== undefined) {
      capabilities.gpuAvailable = true;
      // Estimate GPU memory (would need actual query in production)
      capabilities.estimatedGpuMemory = 8 * 1024 * 1024 * 1024; // 8GB estimate
    }

    return capabilities;
  }

  /**
   * Measure operation performance
   */
  async measure<T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    const startCpu = process.cpuUsage();

    try {
      const result = await operation();

      this.recordMetrics(operationName, startTime, startMemory, startCpu);
      this.operationCount++;

      // Auto-tune if needed
      if (this.operationCount % this.config.adjustmentInterval === 0) {
        this.autoTune();
      }

      return result;

    } catch (error) {
      // Still record metrics on error
      this.recordMetrics(operationName, startTime, startMemory, startCpu);
      this.operationCount++;
      throw error;
    }
  }

  /**
   * Record metrics for completed operation
   */
  private recordMetrics(
    operationName: string,
    startTime: number,
    startMemory: NodeJS.MemoryUsage,
    startCpu: NodeJS.CpuUsage
  ): void {
    const duration = Date.now() - startTime;
    const endMemory = process.memoryUsage();
    const endCpu = process.cpuUsage(startCpu);

    const metrics: PerformanceMetrics = {
      operationName,
      duration,
      timestamp: new Date(),
      memoryUsage: {
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        external: endMemory.external - startMemory.external,
        rss: endMemory.rss - startMemory.rss
      },
      cpuUsage: {
        user: endCpu.user,
        system: endCpu.system
      }
    };

    this.metrics.push(metrics);

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    // Log slow operations
    if (duration > this.config.targetLatency * 1.5) {
      this.logger.warn('Slow operation detected', {
        operation: operationName,
        duration,
        targetLatency: this.config.targetLatency
      });
    }
  }

  /**
   * Auto-tune concurrency based on performance
   */
  autoTune(): number {
    const recentMetrics = this.getRecentMetrics(this.config.adjustmentInterval);

    if (recentMetrics.length === 0) {
      return this.currentConcurrency;
    }

    const avgLatency = this.calculateAverage(recentMetrics, 'duration');
    const avgMemory = this.calculateAverage(recentMetrics, 'memoryUsage.heapUsed');
    const memoryUsagePercent = (avgMemory / this.hardwareCapabilities.totalMemory) * 100;

    const oldConcurrency = this.currentConcurrency;

    // Adjust concurrency based on performance
    if (avgLatency > this.config.targetLatency * 1.5) {
      // Too slow, reduce concurrency
      this.currentConcurrency = Math.max(
        this.config.minConcurrency,
        this.currentConcurrency - 1
      );
      this.logger.info('Reduced concurrency (high latency)', {
        from: oldConcurrency,
        to: this.currentConcurrency,
        avgLatency,
        targetLatency: this.config.targetLatency
      });

    } else if (memoryUsagePercent > 80) {
      // High memory usage, reduce concurrency
      this.currentConcurrency = Math.max(
        this.config.minConcurrency,
        this.currentConcurrency - 1
      );
      this.logger.info('Reduced concurrency (high memory)', {
        from: oldConcurrency,
        to: this.currentConcurrency,
        memoryUsagePercent: memoryUsagePercent.toFixed(2)
      });

    } else if (
      avgLatency < this.config.targetLatency * 0.7 &&
      memoryUsagePercent < 60
    ) {
      // Performing well, increase concurrency
      this.currentConcurrency = Math.min(
        this.config.maxConcurrency,
        this.currentConcurrency + 1
      );
      this.logger.info('Increased concurrency (good performance)', {
        from: oldConcurrency,
        to: this.currentConcurrency,
        avgLatency,
        memoryUsagePercent: memoryUsagePercent.toFixed(2)
      });
    }

    return this.currentConcurrency;
  }

  /**
   * Get current concurrency setting
   */
  getCurrentConcurrency(): number {
    return this.currentConcurrency;
  }

  /**
   * Set concurrency manually
   */
  setConcurrency(concurrency: number): void {
    this.currentConcurrency = Math.max(
      this.config.minConcurrency,
      Math.min(this.config.maxConcurrency, concurrency)
    );

    this.logger.info('Concurrency set manually', {
      concurrency: this.currentConcurrency
    });
  }

  /**
   * Get performance report
   */
  getReport(): PerformanceReport {
    if (this.metrics.length === 0) {
      return {
        totalOperations: 0,
        averageDuration: 0,
        medianDuration: 0,
        p95Duration: 0,
        p99Duration: 0,
        averageMemory: 0,
        peakMemory: 0,
        currentConcurrency: this.currentConcurrency,
        recommendations: ['No operations performed yet'],
        bottlenecks: []
      };
    }

    const durations = this.metrics.map(m => m.duration).sort((a, b) => a - b);
    const memoryUsages = this.metrics.map(m => m.memoryUsage.heapUsed);

    const report: PerformanceReport = {
      totalOperations: this.metrics.length,
      averageDuration: this.calculateAverage(this.metrics, 'duration'),
      medianDuration: this.calculatePercentile(durations, 50),
      p95Duration: this.calculatePercentile(durations, 95),
      p99Duration: this.calculatePercentile(durations, 99),
      averageMemory: this.calculateAverage(this.metrics, 'memoryUsage.heapUsed'),
      peakMemory: Math.max(...memoryUsages),
      currentConcurrency: this.currentConcurrency,
      recommendations: this.generateRecommendations(),
      bottlenecks: this.identifyBottlenecks()
    };

    return report;
  }

  /**
   * Get hardware capabilities
   */
  getHardwareCapabilities(): HardwareCapabilities {
    return { ...this.hardwareCapabilities };
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    this.operationCount = 0;
    this.logger.info('Metrics cleared');
  }

  // Private methods

  /**
   * Get recent metrics
   */
  private getRecentMetrics(count: number): PerformanceMetrics[] {
    return this.metrics.slice(-count);
  }

  /**
   * Calculate average of metric property
   */
  private calculateAverage(metrics: PerformanceMetrics[], property: string): number {
    if (metrics.length === 0) return 0;

    const sum = metrics.reduce((acc, m) => {
      const value = this.getNestedProperty(m, property);
      return acc + (typeof value === 'number' ? value : 0);
    }, 0);

    return sum / metrics.length;
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }

  /**
   * Get nested property from object
   */
  private getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, prop) => current?.[prop], obj);
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const avgDuration = this.calculateAverage(this.metrics, 'duration');
    const avgMemory = this.calculateAverage(this.metrics, 'memoryUsage.heapUsed');
    const memoryPercent = (avgMemory / this.hardwareCapabilities.totalMemory) * 100;

    // Duration recommendations
    if (avgDuration > this.config.targetLatency * 1.5) {
      recommendations.push(
        `Average latency (${avgDuration.toFixed(0)}ms) exceeds target by 50%+. ` +
        `Consider: reducing batch size, increasing hardware resources, or optimizing operations.`
      );
    }

    // Memory recommendations
    if (memoryPercent > 80) {
      recommendations.push(
        `Memory usage high (${memoryPercent.toFixed(1)}%). ` +
        `Consider: reducing concurrency, clearing caches, or adding more RAM.`
      );
    }

    // Concurrency recommendations
    if (this.currentConcurrency === this.config.minConcurrency && avgDuration < this.config.targetLatency * 0.5) {
      recommendations.push(
        `Performance headroom available. Consider increasing max concurrency.`
      );
    }

    // GPU recommendations
    if (!this.hardwareCapabilities.gpuAvailable) {
      recommendations.push(
        `No GPU detected. Image generation will be significantly faster with GPU support.`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is optimal. No recommendations at this time.');
    }

    return recommendations;
  }

  /**
   * Identify performance bottlenecks
   */
  private identifyBottlenecks(): string[] {
    const bottlenecks: string[] = [];

    // Group metrics by operation
    const byOperation = new Map<string, PerformanceMetrics[]>();
    for (const metric of this.metrics) {
      if (!byOperation.has(metric.operationName)) {
        byOperation.set(metric.operationName, []);
      }
      byOperation.get(metric.operationName)!.push(metric);
    }

    // Find slowest operations
    for (const [operation, metrics] of byOperation) {
      const avgDuration = this.calculateAverage(metrics, 'duration');
      if (avgDuration > this.config.targetLatency) {
        bottlenecks.push(
          `${operation}: ${avgDuration.toFixed(0)}ms average (target: ${this.config.targetLatency}ms)`
        );
      }
    }

    return bottlenecks;
  }
}
