import { EventEmitter } from 'events';
import { z } from 'zod';

/**
 * Provider lifecycle states
 */
export enum ProviderState {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  READY = 'ready',
  ERROR = 'error',
  SHUTTING_DOWN = 'shutting_down',
  SHUTDOWN = 'shutdown'
}

/**
 * Provider events emitted for monitoring
 */
export const ProviderEvents = {
  STATE_CHANGED: 'state:changed',
  HEALTH_CHECK: 'health:check',
  REQUEST_START: 'request:start',
  REQUEST_SUCCESS: 'request:success',
  REQUEST_ERROR: 'request:error',
  REQUEST_RETRY: 'request:retry'
} as const;

/**
 * Base configuration shared by all providers
 */
export const BaseProviderConfigSchema = z.object({
  name: z.string(),
  baseUrl: z.string().url(),
  timeout: z.number().positive().default(30000),
  retries: z.number().int().min(0).default(3),
  healthCheckInterval: z.number().positive().default(30000)
});

export type BaseProviderConfig = z.infer<typeof BaseProviderConfigSchema>;

/**
 * Health check result
 */
export interface HealthCheckResult {
  healthy: boolean;
  latency: number;
  message?: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Provider metrics for monitoring
 */
export interface ProviderMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalRetries: number;
  averageLatency: number;
  cacheHits: number;
  cacheMisses: number;
}

/**
 * Abstract base class for all AI providers.
 *
 * Responsibilities:
 * - Lifecycle management (init, shutdown)
 * - Health check coordination
 * - Metrics collection
 * - Event emission for monitoring
 *
 * Subclasses must implement:
 * - _doInit(): Provider-specific initialization
 * - _doHealthCheck(): Provider-specific health check
 * - _doShutdown(): Provider-specific cleanup
 */
export abstract class BaseProvider extends EventEmitter {
  protected config: BaseProviderConfig;
  protected state: ProviderState = ProviderState.UNINITIALIZED;
  protected metrics: ProviderMetrics;

  private healthCache: HealthCheckResult | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;

  constructor(config: BaseProviderConfig) {
    super();
    this.config = BaseProviderConfigSchema.parse(config);
    this.metrics = this.createInitialMetrics();
  }

  /**
   * Initialize the provider. Must be called before use.
   */
  async init(): Promise<void> {
    if (this.state !== ProviderState.UNINITIALIZED) {
      throw new Error(`Cannot init provider in state: ${this.state}`);
    }

    this.setState(ProviderState.INITIALIZING);

    try {
      await this._doInit();
      this.setState(ProviderState.READY);
      this.startHealthCheckTimer();
    } catch (error) {
      this.setState(ProviderState.ERROR);
      throw error;
    }
  }

  /**
   * Shutdown the provider gracefully.
   */
  async shutdown(): Promise<void> {
    if (this.state === ProviderState.SHUTDOWN) {
      return;
    }

    this.setState(ProviderState.SHUTTING_DOWN);
    this.stopHealthCheckTimer();

    try {
      await this._doShutdown();
    } finally {
      this.setState(ProviderState.SHUTDOWN);
    }
  }

  /**
   * Check if provider is healthy. Uses cached result if fresh.
   */
  async isHealthy(): Promise<HealthCheckResult> {
    // Return cached result if still fresh
    if (this.healthCache && this.isHealthCacheFresh()) {
      return this.healthCache;
    }

    const startTime = Date.now();

    try {
      const result = await this._doHealthCheck();
      this.healthCache = {
        ...result,
        latency: Date.now() - startTime,
        timestamp: new Date()
      };
    } catch (error) {
      this.healthCache = {
        healthy: false,
        latency: Date.now() - startTime,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }

    this.emit(ProviderEvents.HEALTH_CHECK, this.healthCache);
    return this.healthCache;
  }

  /**
   * Get current provider metrics.
   */
  getMetrics(): ProviderMetrics {
    return { ...this.metrics };
  }

  /**
   * Get provider name.
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * Get current state.
   */
  getState(): ProviderState {
    return this.state;
  }

  // Protected methods for subclasses

  protected setState(newState: ProviderState): void {
    const oldState = this.state;
    this.state = newState;
    this.emit(ProviderEvents.STATE_CHANGED, { oldState, newState });
  }

  protected recordRequest(success: boolean, latency: number): void {
    this.metrics.totalRequests++;
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }
    // Running average
    this.metrics.averageLatency =
      (this.metrics.averageLatency * (this.metrics.totalRequests - 1) + latency)
      / this.metrics.totalRequests;
  }

  protected recordRetry(): void {
    this.metrics.totalRetries++;
  }

  protected recordCacheHit(): void {
    this.metrics.cacheHits++;
  }

  protected recordCacheMiss(): void {
    this.metrics.cacheMisses++;
  }

  // Abstract methods for subclasses to implement

  protected abstract _doInit(): Promise<void>;
  protected abstract _doHealthCheck(): Promise<Omit<HealthCheckResult, 'latency' | 'timestamp'>>;
  protected abstract _doShutdown(): Promise<void>;

  // Private methods

  private createInitialMetrics(): ProviderMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalRetries: 0,
      averageLatency: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  private isHealthCacheFresh(): boolean {
    if (!this.healthCache) return false;
    const age = Date.now() - this.healthCache.timestamp.getTime();
    return age < this.config.healthCheckInterval;
  }

  private startHealthCheckTimer(): void {
    this.healthCheckTimer = setInterval(
      () => this.isHealthy(),
      this.config.healthCheckInterval
    );
  }

  private stopHealthCheckTimer(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }
}
