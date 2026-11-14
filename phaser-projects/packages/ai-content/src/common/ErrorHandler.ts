/**
 * Centralized error handling with automatic recovery strategies.
 *
 * Features:
 * - Structured error types
 * - Error categorization (transient vs permanent)
 * - Severity levels
 * - Recovery strategy registry
 * - Automatic recovery based on error type
 * - Correlation ID tracking
 */

import { EventEmitter } from 'events';
import { Logger } from './Logger';

/**
 * Error categories
 */
export enum ErrorCategory {
  TRANSIENT = 'transient',           // Temporary failures (retry)
  PERMANENT = 'permanent',           // Permanent failures (no retry)
  CONFIGURATION = 'configuration',   // Config errors
  VALIDATION = 'validation',         // Input validation errors
  PROVIDER = 'provider',             // Provider-specific errors
  FILESYSTEM = 'filesystem',         // File system errors
  NETWORK = 'network',               // Network errors
  RESOURCE = 'resource'              // Resource exhaustion
}

/**
 * Error severity
 */
export enum ErrorSeverity {
  FATAL = 'fatal',      // Unrecoverable, stop execution
  ERROR = 'error',      // Recoverable with retry
  WARNING = 'warning',  // Non-blocking issue
  INFO = 'info'         // Informational
}

/**
 * Structured error with rich context
 */
export class StructuredError extends Error {
  constructor(
    message: string,
    public readonly category: ErrorCategory,
    public readonly severity: ErrorSeverity,
    public readonly code: string,
    public readonly recoverable: boolean,
    public readonly context?: Record<string, any>,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'StructuredError';

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, StructuredError);
    }
  }

  /**
   * Convert to JSON for logging
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      category: this.category,
      severity: this.severity,
      code: this.code,
      recoverable: this.recoverable,
      context: this.context,
      stack: this.stack,
      cause: this.cause ? {
        name: this.cause.name,
        message: this.cause.message,
        stack: this.cause.stack
      } : undefined
    };
  }
}

/**
 * Recovery strategy interface
 */
export interface RecoveryStrategy {
  name: string;
  priority: number;
  canRecover: (error: StructuredError) => boolean;
  recover: (error: StructuredError, context: any) => Promise<any>;
}

/**
 * Recovery context for passing operation details
 */
export interface RecoveryContext {
  operation?: () => Promise<any>;
  fallback?: () => Promise<any>;
  maxRetries?: number;
  retryDelay?: number;
  [key: string]: any;
}

/**
 * Global error handler with automatic recovery.
 *
 * @example
 * ```typescript
 * const errorHandler = new ErrorHandler();
 *
 * // Register strategies
 * errorHandler.registerStrategy(new RetryRecoveryStrategy());
 * errorHandler.registerStrategy(new FallbackRecoveryStrategy());
 *
 * // Handle error
 * try {
 *   await provider.generate(...);
 * } catch (error) {
 *   const result = await errorHandler.handle(error, {
 *     operation: () => provider.generate(...)
 *   });
 * }
 * ```
 */
export class ErrorHandler extends EventEmitter {
  private strategies: Map<string, RecoveryStrategy> = new Map();
  private logger: Logger;

  constructor(logger?: Logger) {
    super();
    this.logger = logger || new Logger('ErrorHandler');
  }

  /**
   * Register recovery strategy
   */
  registerStrategy(strategy: RecoveryStrategy): void {
    this.strategies.set(strategy.name, strategy);
    this.logger.debug('Registered recovery strategy', { strategy: strategy.name });
  }

  /**
   * Handle error with automatic recovery
   */
  async handle(error: Error, context?: RecoveryContext): Promise<any> {
    // Convert to structured error
    const structuredError = this.normalizeError(error);

    // Log error
    this.logger.error('Error occurred', structuredError, {
      category: structuredError.category,
      severity: structuredError.severity,
      code: structuredError.code,
      recoverable: structuredError.recoverable
    });

    // Emit error event
    this.emit('error', structuredError);

    // Try recovery if recoverable
    if (structuredError.recoverable) {
      const sortedStrategies = this.getSortedStrategies();

      for (const strategy of sortedStrategies) {
        if (strategy.canRecover(structuredError)) {
          this.logger.info('Attempting recovery', {
            strategy: strategy.name,
            error: structuredError.code
          });

          try {
            const result = await strategy.recover(structuredError, context);

            this.logger.info('Recovery successful', {
              strategy: strategy.name,
              error: structuredError.code
            });

            this.emit('recovered', {
              error: structuredError,
              strategy: strategy.name
            });

            return result;

          } catch (recoveryError) {
            this.logger.warn('Recovery failed', {
              strategy: strategy.name,
              error: structuredError.code,
              recoveryError: recoveryError instanceof Error ? recoveryError.message : String(recoveryError)
            });

            this.emit('recovery-failed', {
              error: structuredError,
              strategy: strategy.name,
              recoveryError
            });
          }
        }
      }
    }

    // Recovery failed or not recoverable
    this.emit('unrecoverable', structuredError);
    throw structuredError;
  }

  /**
   * Create structured error
   */
  createError(
    message: string,
    category: ErrorCategory,
    code: string,
    options?: {
      severity?: ErrorSeverity;
      recoverable?: boolean;
      context?: Record<string, any>;
      cause?: Error;
    }
  ): StructuredError {
    return new StructuredError(
      message,
      category,
      options?.severity || ErrorSeverity.ERROR,
      code,
      options?.recoverable ?? this.isRecoverableByDefault(category),
      options?.context,
      options?.cause
    );
  }

  /**
   * Get error statistics
   */
  getStats(): {
    totalErrors: number;
    recoveredErrors: number;
    failedRecoveries: number;
    unrecoverableErrors: number;
  } {
    // This would be tracked over time in production
    return {
      totalErrors: 0,
      recoveredErrors: 0,
      failedRecoveries: 0,
      unrecoverableErrors: 0
    };
  }

  // Private methods

  /**
   * Get strategies sorted by priority
   */
  private getSortedStrategies(): RecoveryStrategy[] {
    return Array.from(this.strategies.values())
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Convert generic error to structured error
   */
  private normalizeError(error: Error): StructuredError {
    if (error instanceof StructuredError) {
      return error;
    }

    // Try to categorize generic errors
    let category = ErrorCategory.TRANSIENT;
    let code = 'UNKNOWN_ERROR';
    let severity = ErrorSeverity.ERROR;
    let recoverable = true;

    const message = error.message.toLowerCase();

    // File system errors
    if (message.includes('enoent') || message.includes('file not found')) {
      category = ErrorCategory.FILESYSTEM;
      code = 'FILE_NOT_FOUND';
      recoverable = false;
    } else if (message.includes('eacces') || message.includes('permission denied')) {
      category = ErrorCategory.FILESYSTEM;
      code = 'PERMISSION_DENIED';
      recoverable = false;
    }
    // Network errors
    else if (message.includes('econnrefused') || message.includes('connection refused')) {
      category = ErrorCategory.NETWORK;
      code = 'CONNECTION_REFUSED';
      recoverable = true;
    } else if (message.includes('etimedout') || message.includes('timeout')) {
      category = ErrorCategory.NETWORK;
      code = 'TIMEOUT';
      recoverable = true;
    } else if (message.includes('enotfound') || message.includes('dns')) {
      category = ErrorCategory.NETWORK;
      code = 'DNS_ERROR';
      recoverable = true;
    }
    // Resource errors
    else if (message.includes('enomem') || message.includes('out of memory')) {
      category = ErrorCategory.RESOURCE;
      code = 'OUT_OF_MEMORY';
      severity = ErrorSeverity.FATAL;
      recoverable = false;
    }
    // Validation errors
    else if (message.includes('validation') || message.includes('invalid')) {
      category = ErrorCategory.VALIDATION;
      code = 'VALIDATION_ERROR';
      recoverable = false;
    }

    return new StructuredError(
      error.message,
      category,
      severity,
      code,
      recoverable,
      {},
      error
    );
  }

  /**
   * Determine if category is recoverable by default
   */
  private isRecoverableByDefault(category: ErrorCategory): boolean {
    return [
      ErrorCategory.TRANSIENT,
      ErrorCategory.NETWORK,
      ErrorCategory.PROVIDER
    ].includes(category);
  }
}

/**
 * Retry recovery strategy with exponential backoff
 */
export class RetryRecoveryStrategy implements RecoveryStrategy {
  name = 'retry';
  priority = 10;

  constructor(
    private defaultMaxRetries: number = 3,
    private defaultInitialDelay: number = 1000
  ) {}

  canRecover(error: StructuredError): boolean {
    return error.recoverable && [
      ErrorCategory.TRANSIENT,
      ErrorCategory.NETWORK,
      ErrorCategory.PROVIDER
    ].includes(error.category);
  }

  async recover(error: StructuredError, context: RecoveryContext): Promise<any> {
    if (!context?.operation) {
      throw new Error('No operation to retry');
    }

    const maxRetries = context.maxRetries || this.defaultMaxRetries;
    const initialDelay = context.retryDelay || this.defaultInitialDelay;

    for (let i = 0; i < maxRetries; i++) {
      try {
        // Exponential backoff
        const delay = initialDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));

        return await context.operation();

      } catch (err) {
        if (i === maxRetries - 1) {
          throw err;
        }
      }
    }
  }
}

/**
 * Fallback recovery strategy
 */
export class FallbackRecoveryStrategy implements RecoveryStrategy {
  name = 'fallback';
  priority = 5;

  canRecover(error: StructuredError): boolean {
    return error.recoverable && error.category === ErrorCategory.PROVIDER;
  }

  async recover(error: StructuredError, context: RecoveryContext): Promise<any> {
    if (!context?.fallback) {
      throw new Error('No fallback provided');
    }

    return await context.fallback();
  }
}

/**
 * Skip recovery strategy (continue with null/undefined)
 */
export class SkipRecoveryStrategy implements RecoveryStrategy {
  name = 'skip';
  priority = 1;

  canRecover(error: StructuredError): boolean {
    return error.severity === ErrorSeverity.WARNING;
  }

  async recover(_error: StructuredError, _context: RecoveryContext): Promise<any> {
    // Return null to indicate skipped
    return null;
  }
}
