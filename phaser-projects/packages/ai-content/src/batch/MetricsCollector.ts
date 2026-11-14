/**
 * Performance metrics collection and reporting.
 *
 * Tracks batch processing performance, success rates, and resource usage.
 *
 * @module batch/MetricsCollector
 */

import { writeFile } from 'fs/promises';
import { BatchState, BatchJob, BatchMetrics } from './types';

/**
 * Time-series metric data point
 */
export interface MetricDataPoint {
  /** Timestamp */
  timestamp: Date;
  /** Metric value */
  value: number;
  /** Associated batch ID */
  batchId?: string;
  /** Associated job ID */
  jobId?: string;
}

/**
 * Aggregated metrics report
 */
export interface MetricsReport {
  /** Report period */
  period: {
    start: Date;
    end: Date;
  };
  /** Total batches processed */
  totalBatches: number;
  /** Total jobs processed */
  totalJobs: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Average throughput (jobs/hour) */
  averageThroughput: number;
  /** Average job duration (ms) */
  averageJobDuration: number;
  /** Median job duration (ms) */
  medianJobDuration: number;
  /** P95 job duration (ms) */
  p95JobDuration: number;
  /** P99 job duration (ms) */
  p99JobDuration: number;
  /** Error breakdown */
  errorBreakdown: Record<string, number>;
  /** Performance trends */
  trends: {
    throughput: MetricDataPoint[];
    successRate: MetricDataPoint[];
    duration: MetricDataPoint[];
  };
}

/**
 * Resource usage metrics
 */
export interface ResourceMetrics {
  /** Memory usage (MB) */
  memoryMB: number;
  /** CPU usage (%) */
  cpuPercent: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Collects and aggregates performance metrics for batch processing.
 *
 * Features:
 * - Time-series metric tracking
 * - Performance trend analysis
 * - Resource utilization monitoring
 * - Export to JSON/CSV
 */
export class MetricsCollector {
  private jobDurations: Map<string, number> = new Map();
  private batchMetrics: Map<string, BatchMetrics> = new Map();
  private throughputHistory: MetricDataPoint[] = [];
  private successRateHistory: MetricDataPoint[] = [];
  private durationHistory: MetricDataPoint[] = [];
  private resourceHistory: ResourceMetrics[] = [];
  private errorCounts: Map<string, number> = new Map();

  /**
   * Record batch metrics
   */
  recordBatch(batch: BatchState): void {
    this.batchMetrics.set(batch.batchId, batch.metrics);

    // Record throughput
    this.throughputHistory.push({
      timestamp: batch.completedAt || new Date(),
      value: batch.metrics.throughput,
      batchId: batch.batchId
    });

    // Record success rate
    this.successRateHistory.push({
      timestamp: batch.completedAt || new Date(),
      value: batch.metrics.successRate,
      batchId: batch.batchId
    });

    // Record average duration
    this.durationHistory.push({
      timestamp: batch.completedAt || new Date(),
      value: batch.metrics.averageDuration,
      batchId: batch.batchId
    });

    // Record job durations
    for (const job of batch.jobs) {
      if (job.status === 'completed' && job.startedAt && job.completedAt) {
        const duration = job.completedAt.getTime() - job.startedAt.getTime();
        this.jobDurations.set(job.id, duration);
      }

      // Track error types
      if (job.status === 'failed' && job.error) {
        const errorType = job.error.message.split(':')[0] || 'Unknown';
        this.errorCounts.set(errorType, (this.errorCounts.get(errorType) || 0) + 1);
      }
    }
  }

  /**
   * Record job completion
   */
  recordJob(job: BatchJob): void {
    if (job.status === 'completed' && job.startedAt && job.completedAt) {
      const duration = job.completedAt.getTime() - job.startedAt.getTime();
      this.jobDurations.set(job.id, duration);

      this.durationHistory.push({
        timestamp: job.completedAt,
        value: duration,
        batchId: job.batchId,
        jobId: job.id
      });
    }

    if (job.status === 'failed' && job.error) {
      const errorType = job.error.message.split(':')[0] || 'Unknown';
      this.errorCounts.set(errorType, (this.errorCounts.get(errorType) || 0) + 1);
    }
  }

  /**
   * Record resource usage
   */
  recordResourceUsage(): void {
    const usage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    this.resourceHistory.push({
      memoryMB: usage.heapUsed / 1024 / 1024,
      cpuPercent: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
      timestamp: new Date()
    });

    // Keep only last 1000 samples
    if (this.resourceHistory.length > 1000) {
      this.resourceHistory.shift();
    }
  }

  /**
   * Generate comprehensive metrics report
   */
  generateReport(startDate?: Date, endDate?: Date): MetricsReport {
    const start = startDate || this.getOldestTimestamp();
    const end = endDate || new Date();

    // Filter metrics by date range
    const relevantBatches = Array.from(this.batchMetrics.values());
    const relevantDurations = Array.from(this.jobDurations.values());

    const totalJobs = relevantDurations.length;
    const totalBatches = relevantBatches.length;

    // Calculate success rate
    const totalSuccessful = relevantBatches.reduce(
      (sum, m) => sum + m.successfulJobs,
      0
    );
    const totalFailed = relevantBatches.reduce(
      (sum, m) => sum + m.failedJobs,
      0
    );
    const successRate = totalJobs > 0 ? totalSuccessful / (totalSuccessful + totalFailed) : 0;

    // Calculate throughput
    const averageThroughput = relevantBatches.length > 0
      ? relevantBatches.reduce((sum, m) => sum + m.throughput, 0) / relevantBatches.length
      : 0;

    // Calculate duration statistics
    const sortedDurations = relevantDurations.sort((a, b) => a - b);
    const averageJobDuration = relevantDurations.length > 0
      ? relevantDurations.reduce((a, b) => a + b, 0) / relevantDurations.length
      : 0;
    const medianJobDuration = this.calculatePercentile(sortedDurations, 50);
    const p95JobDuration = this.calculatePercentile(sortedDurations, 95);
    const p99JobDuration = this.calculatePercentile(sortedDurations, 99);

    // Filter trends by date range
    const trends = {
      throughput: this.filterByDateRange(this.throughputHistory, start, end),
      successRate: this.filterByDateRange(this.successRateHistory, start, end),
      duration: this.filterByDateRange(this.durationHistory, start, end)
    };

    return {
      period: { start, end },
      totalBatches,
      totalJobs,
      successRate,
      averageThroughput,
      averageJobDuration,
      medianJobDuration,
      p95JobDuration,
      p99JobDuration,
      errorBreakdown: Object.fromEntries(this.errorCounts),
      trends
    };
  }

  /**
   * Export metrics to JSON file
   */
  async exportToJSON(filepath: string): Promise<void> {
    const report = this.generateReport();
    await writeFile(filepath, JSON.stringify(report, null, 2), 'utf-8');
  }

  /**
   * Export metrics to CSV file
   */
  async exportToCSV(filepath: string): Promise<void> {
    const report = this.generateReport();

    // Create CSV rows
    const headers = [
      'Metric',
      'Value'
    ];

    const rows = [
      headers.join(','),
      `Total Batches,${report.totalBatches}`,
      `Total Jobs,${report.totalJobs}`,
      `Success Rate,${(report.successRate * 100).toFixed(2)}%`,
      `Average Throughput,${report.averageThroughput.toFixed(2)} jobs/hour`,
      `Average Duration,${Math.round(report.averageJobDuration / 1000)}s`,
      `Median Duration,${Math.round(report.medianJobDuration / 1000)}s`,
      `P95 Duration,${Math.round(report.p95JobDuration / 1000)}s`,
      `P99 Duration,${Math.round(report.p99JobDuration / 1000)}s`,
      '',
      'Error Type,Count'
    ];

    // Add error breakdown
    for (const [errorType, count] of Object.entries(report.errorBreakdown)) {
      rows.push(`${errorType},${count}`);
    }

    await writeFile(filepath, rows.join('\n'), 'utf-8');
  }

  /**
   * Get current resource usage
   */
  getResourceUsage(): ResourceMetrics {
    const usage = process.memoryUsage();
    return {
      memoryMB: usage.heapUsed / 1024 / 1024,
      cpuPercent: 0, // Placeholder
      timestamp: new Date()
    };
  }

  /**
   * Get performance summary
   */
  getSummary(): {
    totalJobs: number;
    averageDuration: number;
    successRate: number;
    throughput: number;
  } {
    const report = this.generateReport();
    return {
      totalJobs: report.totalJobs,
      averageDuration: report.averageJobDuration,
      successRate: report.successRate,
      throughput: report.averageThroughput
    };
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.jobDurations.clear();
    this.batchMetrics.clear();
    this.throughputHistory = [];
    this.successRateHistory = [];
    this.durationHistory = [];
    this.resourceHistory = [];
    this.errorCounts.clear();
  }

  // Private methods

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }

  private filterByDateRange(
    data: MetricDataPoint[],
    start: Date,
    end: Date
  ): MetricDataPoint[] {
    return data.filter(
      point =>
        point.timestamp >= start &&
        point.timestamp <= end
    );
  }

  private getOldestTimestamp(): Date {
    const timestamps = [
      ...this.throughputHistory.map(p => p.timestamp),
      ...this.successRateHistory.map(p => p.timestamp),
      ...this.durationHistory.map(p => p.timestamp)
    ];

    if (timestamps.length === 0) {
      return new Date();
    }

    return new Date(Math.min(...timestamps.map(t => t.getTime())));
  }
}
