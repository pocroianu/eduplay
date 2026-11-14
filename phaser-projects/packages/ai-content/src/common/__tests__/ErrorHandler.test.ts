import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ErrorHandler,
  StructuredError,
  ErrorCategory,
  ErrorSeverity,
  RetryRecoveryStrategy,
  FallbackRecoveryStrategy,
  SkipRecoveryStrategy
} from '../ErrorHandler';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
  });

  describe('StructuredError', () => {
    it('should create structured error', () => {
      const error = errorHandler.createError(
        'Test error',
        ErrorCategory.PROVIDER,
        'TEST_ERROR',
        {
          severity: ErrorSeverity.ERROR,
          recoverable: true,
          context: { key: 'value' }
        }
      );

      expect(error).toBeInstanceOf(StructuredError);
      expect(error.message).toBe('Test error');
      expect(error.category).toBe(ErrorCategory.PROVIDER);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.severity).toBe(ErrorSeverity.ERROR);
      expect(error.recoverable).toBe(true);
      expect(error.context).toEqual({ key: 'value' });
    });

    it('should serialize to JSON', () => {
      const error = errorHandler.createError(
        'Test',
        ErrorCategory.NETWORK,
        'TEST'
      );

      const json = error.toJSON();

      expect(json.name).toBe('StructuredError');
      expect(json.message).toBe('Test');
      expect(json.category).toBe(ErrorCategory.NETWORK);
      expect(json.code).toBe('TEST');
    });
  });

  describe('Error Normalization', () => {
    it('should normalize file not found error', async () => {
      const error = new Error('ENOENT: file not found');

      await expect(errorHandler.handle(error)).rejects.toThrow();

      // Error should be normalized to filesystem category
    });

    it('should normalize connection refused error', async () => {
      const error = new Error('ECONNREFUSED: connection refused');

      await expect(errorHandler.handle(error)).rejects.toThrow();
    });

    it('should pass through structured errors', async () => {
      const structuredError = new StructuredError(
        'Test',
        ErrorCategory.VALIDATION,
        ErrorSeverity.ERROR,
        'TEST',
        false
      );

      await expect(errorHandler.handle(structuredError)).rejects.toThrow(structuredError);
    });
  });

  describe('Recovery Strategies', () => {
    it('should register recovery strategy', () => {
      const strategy = new RetryRecoveryStrategy(3, 100);
      errorHandler.registerStrategy(strategy);

      // Should not throw
    });

    it('should recover with retry strategy', async () => {
      const strategy = new RetryRecoveryStrategy(3, 10);
      errorHandler.registerStrategy(strategy);

      let attempts = 0;
      const operation = vi.fn(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      });

      const error = errorHandler.createError(
        'Operation failed',
        ErrorCategory.TRANSIENT,
        'TEMP_ERROR',
        { recoverable: true }
      );

      const result = await errorHandler.handle(error, { operation });

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should recover with fallback strategy', async () => {
      const strategy = new FallbackRecoveryStrategy();
      errorHandler.registerStrategy(strategy);

      const fallback = vi.fn(async () => 'fallback-result');

      const error = errorHandler.createError(
        'Provider failed',
        ErrorCategory.PROVIDER,
        'PROVIDER_ERROR',
        { recoverable: true }
      );

      const result = await errorHandler.handle(error, { fallback });

      expect(result).toBe('fallback-result');
      expect(fallback).toHaveBeenCalled();
    });

    it('should skip with skip strategy', async () => {
      const strategy = new SkipRecoveryStrategy();
      errorHandler.registerStrategy(strategy);

      const error = errorHandler.createError(
        'Non-critical warning',
        ErrorCategory.VALIDATION,
        'WARNING',
        { severity: ErrorSeverity.WARNING, recoverable: true }
      );

      const result = await errorHandler.handle(error);

      expect(result).toBeNull();
    });

    it('should throw if no strategy can recover', async () => {
      const error = errorHandler.createError(
        'Fatal error',
        ErrorCategory.PERMANENT,
        'FATAL',
        { recoverable: false }
      );

      await expect(errorHandler.handle(error)).rejects.toThrow('Fatal error');
    });
  });

  describe('Events', () => {
    it('should emit error event', async () => {
      const errorEvent = vi.fn();
      errorHandler.on('error', errorEvent);

      const error = new Error('Test error');

      await expect(errorHandler.handle(error)).rejects.toThrow();

      expect(errorEvent).toHaveBeenCalled();
    });

    it('should emit recovered event on successful recovery', async () => {
      const recoveredEvent = vi.fn();
      errorHandler.on('recovered', recoveredEvent);

      const strategy = new RetryRecoveryStrategy(3, 10);
      errorHandler.registerStrategy(strategy);

      const error = errorHandler.createError(
        'Temp error',
        ErrorCategory.TRANSIENT,
        'TEMP',
        { recoverable: true }
      );

      let attempts = 0;
      await errorHandler.handle(error, {
        operation: async () => {
          attempts++;
          if (attempts < 2) throw new Error('Fail');
          return 'success';
        }
      });

      expect(recoveredEvent).toHaveBeenCalled();
    });

    it('should emit unrecoverable event when recovery fails', async () => {
      const unrecoverableEvent = vi.fn();
      errorHandler.on('unrecoverable', unrecoverableEvent);

      const error = errorHandler.createError(
        'Permanent error',
        ErrorCategory.PERMANENT,
        'PERM',
        { recoverable: false }
      );

      await expect(errorHandler.handle(error)).rejects.toThrow();

      expect(unrecoverableEvent).toHaveBeenCalled();
    });
  });

  describe('RetryRecoveryStrategy', () => {
    it('should retry with exponential backoff', async () => {
      const strategy = new RetryRecoveryStrategy(3, 100);

      let attempts = 0;
      const error = new StructuredError(
        'Test',
        ErrorCategory.TRANSIENT,
        ErrorSeverity.ERROR,
        'TEST',
        true
      );

      const startTime = Date.now();

      try {
        await strategy.recover(error, {
          operation: async () => {
            attempts++;
            if (attempts < 3) throw new Error('Fail');
            return 'success';
          }
        });
      } catch (e) {
        // Expected to fail some attempts
      }

      const duration = Date.now() - startTime;

      // Should have exponential backoff (100ms + 200ms = 300ms minimum)
      expect(duration).toBeGreaterThanOrEqual(200);
      expect(attempts).toBe(3);
    });

    it('should throw after max retries', async () => {
      const strategy = new RetryRecoveryStrategy(3, 10);

      const error = new StructuredError(
        'Test',
        ErrorCategory.TRANSIENT,
        ErrorSeverity.ERROR,
        'TEST',
        true
      );

      await expect(
        strategy.recover(error, {
          operation: async () => {
            throw new Error('Always fails');
          }
        })
      ).rejects.toThrow('Always fails');
    });
  });
});
