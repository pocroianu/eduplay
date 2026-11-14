/**
 * Circuit breaker pattern for resilient external service calls.
 *
 * Features:
 * - State machine: CLOSED → OPEN → HALF_OPEN
 * - Configurable failure threshold
 * - Automatic recovery testing
 * - Metrics tracking
 *
 * States:
 * - CLOSED: Normal operation, all requests pass through
 * - OPEN: Too many failures, blocking all requests
 * - HALF_OPEN: Testing if service recovered
 */

import { EventEmitter } from 'events';
import { Logger } from './Logger';

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = 'closed',        // Normal operation
  OPEN = 'open',            // Failures detected, blocking requests
  HALF_OPEN = 'half_open'   // Testing if service recovered
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number;

  /** Number of successes in half-open before closing */
  successThreshold: number;

  /** Time (ms) before attempting half-open from open state */
  timeout: number;

  /** Time window (ms) for counting failures */
  windowDuration: number;

  /** Name for logging */
  name?: string;
}

/**
 * Circuit breaker metrics
 */
export interface CircuitMetrics {
  state: CircuitState;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  rejectedCalls: number;
  lastStateChange: Date;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
}

/**
 * Default circuit breaker configuration
 */
const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000,           // 30 seconds
  windowDuration: 60000,    // 60 seconds
  name: 'CircuitBreaker'
};

/**
 * Circuit breaker for external service calls.
 *
 * @example
 * ```typescript
 * const circuitBreaker = new CircuitBreaker('ComfyUI', {
 *   failureThreshold: 5,
 *   timeout: 30000
 * });
 *
 * try {
 *   const result = await circuitBreaker.execute(async () => {
 *     return await provider.generate(...);
 *   });
 * } catch (error) {
 *   // Handle error (including circuit breaker open)
 * }
 * ```
 */
export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private nextAttemptTime: number = 0;
  private lastStateChange: Date = new Date();
  private failureTimestamps: number[] = [];

  private metrics: CircuitMetrics = {
    state: CircuitState.CLOSED,
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    rejectedCalls: 0,
    lastStateChange: new Date(),
    consecutiveFailures: 0,
    consecutiveSuccesses: 0
  };

  private logger: Logger;
  private config: CircuitBreakerConfig;

  constructor(
    private name: string,
    config: Partial<CircuitBreakerConfig> = {}
  ) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config, name: this.name };
    this.logger = new Logger(`CircuitBreaker:${this.name}`);
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.metrics.totalCalls++;

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        this.metrics.rejectedCalls++;
        const error = new Error(`Circuit breaker ${this.name} is OPEN`);
        (error as any).circuitBreakerOpen = true;
        throw error;
      }

      // Time to try half-open
      this.transitionTo(CircuitState.HALF_OPEN);
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;

    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get metrics
   */
  getMetrics(): CircuitMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset(): void {
    this.transitionTo(CircuitState.CLOSED);
    this.failureCount = 0;
    this.successCount = 0;
    this.failureTimestamps = [];
    this.metrics.consecutiveFailures = 0;
    this.metrics.consecutiveSuccesses = 0;
    this.logger.info('Circuit breaker reset');
  }

  /**
   * Force circuit breaker to open (for testing)
   */
  forceOpen(): void {
    this.transitionTo(CircuitState.OPEN);
    this.nextAttemptTime = Date.now() + this.config.timeout;
  }

  /**
   * Force circuit breaker to close (for testing)
   */
  forceClose(): void {
    this.reset();
  }

  // Private methods

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.metrics.successfulCalls++;
    this.metrics.consecutiveSuccesses++;
    this.metrics.consecutiveFailures = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;

      if (this.successCount >= this.config.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
        this.failureCount = 0;
        this.successCount = 0;
        this.failureTimestamps = [];
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success
      this.failureCount = 0;
      this.failureTimestamps = [];
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(): void {
    this.metrics.failedCalls++;
    this.metrics.consecutiveFailures++;
    this.metrics.consecutiveSuccesses = 0;

    const now = Date.now();
    this.failureTimestamps.push(now);

    // Remove old timestamps outside the window
    this.failureTimestamps = this.failureTimestamps.filter(
      timestamp => now - timestamp < this.config.windowDuration
    );

    this.failureCount = this.failureTimestamps.length;
    this.successCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      // Failed while testing, go back to open
      this.transitionTo(CircuitState.OPEN);
      this.nextAttemptTime = Date.now() + this.config.timeout;
    } else if (this.state === CircuitState.CLOSED) {
      // Check if we should open
      if (this.failureCount >= this.config.failureThreshold) {
        this.transitionTo(CircuitState.OPEN);
        this.nextAttemptTime = Date.now() + this.config.timeout;
      }
    }
  }

  /**
   * Transition to new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;

    if (oldState === newState) {
      return;
    }

    this.state = newState;
    this.lastStateChange = new Date();
    this.metrics.state = newState;
    this.metrics.lastStateChange = this.lastStateChange;

    this.logger.info('State transition', {
      from: oldState,
      to: newState,
      failureCount: this.failureCount,
      consecutiveFailures: this.metrics.consecutiveFailures
    });

    this.emit('stateChange', {
      from: oldState,
      to: newState,
      timestamp: this.lastStateChange
    });
  }
}

/**
 * Circuit breaker manager for multiple services
 */
export class CircuitBreakerManager {
  private breakers: Map<string, CircuitBreaker> = new Map();
  private logger: Logger;

  constructor() {
    this.logger = new Logger('CircuitBreakerManager');
  }

  /**
   * Get or create circuit breaker for service
   */
  getBreaker(
    serviceName: string,
    config?: Partial<CircuitBreakerConfig>
  ): CircuitBreaker {
    if (!this.breakers.has(serviceName)) {
      const breaker = new CircuitBreaker(serviceName, config);
      this.breakers.set(serviceName, breaker);
      this.logger.info('Created circuit breaker', { service: serviceName });
    }

    return this.breakers.get(serviceName)!;
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Record<string, CircuitMetrics> {
    const metrics: Record<string, CircuitMetrics> = {};

    for (const [name, breaker] of this.breakers) {
      metrics[name] = breaker.getMetrics();
    }

    return metrics;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
    this.logger.info('Reset all circuit breakers');
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    healthy: boolean;
    openCircuits: string[];
    totalCircuits: number;
  } {
    const openCircuits: string[] = [];

    for (const [name, breaker] of this.breakers) {
      if (breaker.getState() === CircuitState.OPEN) {
        openCircuits.push(name);
      }
    }

    return {
      healthy: openCircuits.length === 0,
      openCircuits,
      totalCircuits: this.breakers.size
    };
  }
}
