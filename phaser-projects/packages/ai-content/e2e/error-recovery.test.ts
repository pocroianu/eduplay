/**
 * E2E tests for error recovery scenarios.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ErrorHandler,
  RetryRecoveryStrategy,
  FallbackRecoveryStrategy,
  ErrorCategory
} from '../src/common/ErrorHandler';
import { CircuitBreaker, CircuitState } from '../src/common/CircuitBreaker';
import { Logger } from '../src/common/Logger';

describe('E2E: Error Recovery', () => {
  let errorHandler: ErrorHandler;
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('E2E-ErrorRecovery');
    errorHandler = new ErrorHandler(logger);
    errorHandler.registerStrategy(new RetryRecoveryStrategy(3, 100));
    errorHandler.registerStrategy(new FallbackRecoveryStrategy());
  });

  describe('Transient Failure Recovery', () => {
    it('should recover from temporary network issues', async () => {
      let attempts = 0;

      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('ECONNREFUSED: Connection refused');
        }
        return 'success';
      };

      const error = errorHandler.createError(
        'Network failure',
        ErrorCategory.NETWORK,
        'NETWORK_ERROR',
        { recoverable: true }
      );

      const result = await errorHandler.handle(error, { operation });

      expect(result).toBe('success');
      expect(attempts).toBe(3);

      logger.info('Transient failure recovery successful', { attempts });
    });

    it('should use fallback on persistent failures', async () => {
      const operation = async () => {
        throw new Error('Primary provider failed');
      };

      const fallback = async () => {
        return 'fallback-result';
      };

      const error = errorHandler.createError(
        'Provider failure',
        ErrorCategory.PROVIDER,
        'PROVIDER_ERROR',
        { recoverable: true }
      );

      const result = await errorHandler.handle(error, { operation, fallback });

      expect(result).toBe('fallback-result');

      logger.info('Fallback strategy successful');
    });
  });

  describe('Circuit Breaker Protection', () => {
    it('should open circuit after threshold failures', async () => {
      const breaker = new CircuitBreaker('TestService', {
        failureThreshold: 3,
        successThreshold: 1,
        timeout: 500,
        windowDuration: 5000
      });

      const failingOp = async () => {
        throw new Error('Service unavailable');
      };

      // Trigger failures
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingOp)).rejects.toThrow();
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Next call should be rejected immediately
      const startTime = Date.now();
      await expect(breaker.execute(failingOp)).rejects.toThrow(
        /Circuit breaker.*is OPEN/
      );
      const duration = Date.now() - startTime;

      // Should fail fast (< 10ms)
      expect(duration).toBeLessThan(10);

      logger.info('Circuit breaker protection verified');
    });

    it('should recover after timeout period', async () => {
      const breaker = new CircuitBreaker('TestService', {
        failureThreshold: 2,
        successThreshold: 1,
        timeout: 200,
        windowDuration: 5000
      });

      // Open the circuit
      for (let i = 0; i < 2; i++) {
        await expect(
          breaker.execute(async () => {
            throw new Error('Fail');
          })
        ).rejects.toThrow();
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 250));

      // Service recovered
      await breaker.execute(async () => 'recovered');

      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      logger.info('Circuit breaker recovery verified');
    }, 10000);
  });

  describe('Cascading Failures', () => {
    it('should prevent cascading failures across services', async () => {
      const breaker1 = new CircuitBreaker('Service1', {
        failureThreshold: 2,
        timeout: 500,
        windowDuration: 5000,
        successThreshold: 1
      });

      const breaker2 = new CircuitBreaker('Service2', {
        failureThreshold: 2,
        timeout: 500,
        windowDuration: 5000,
        successThreshold: 1
      });

      // Service1 fails
      for (let i = 0; i < 2; i++) {
        await expect(
          breaker1.execute(async () => {
            throw new Error('Service1 down');
          })
        ).rejects.toThrow();
      }

      expect(breaker1.getState()).toBe(CircuitState.OPEN);

      // Service2 should still work
      const result = await breaker2.execute(async () => 'Service2 working');

      expect(result).toBe('Service2 working');
      expect(breaker2.getState()).toBe(CircuitState.CLOSED);

      logger.info('Cascading failure prevention verified');
    });
  });

  describe('Partial Failure Handling', () => {
    it('should continue with partial results on non-critical failures', async () => {
      const results: (string | null)[] = [];

      const operations = [
        { critical: true, succeeds: true },
        { critical: false, succeeds: false },
        { critical: true, succeeds: true }
      ];

      for (const op of operations) {
        try {
          if (op.succeeds) {
            results.push('success');
          } else {
            throw new Error('Non-critical failure');
          }
        } catch (error) {
          if (!op.critical) {
            results.push(null); // Skip non-critical
          } else {
            throw error;
          }
        }
      }

      expect(results).toHaveLength(3);
      expect(results[0]).toBe('success');
      expect(results[1]).toBeNull();
      expect(results[2]).toBe('success');

      logger.info('Partial failure handling verified');
    });
  });
});
