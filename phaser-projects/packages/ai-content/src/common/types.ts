/**
 * Type definitions for common production modules.
 */

export {
  LogLevel,
  LogEntry,
  LoggerConfig,
  Logger
} from './Logger';

export {
  ErrorCategory,
  ErrorSeverity,
  StructuredError,
  RecoveryStrategy,
  RecoveryContext,
  ErrorHandler,
  RetryRecoveryStrategy,
  FallbackRecoveryStrategy,
  SkipRecoveryStrategy
} from './ErrorHandler';

export {
  CircuitState,
  CircuitBreakerConfig,
  CircuitMetrics,
  CircuitBreaker,
  CircuitBreakerManager
} from './CircuitBreaker';

export {
  SecurityValidationError,
  SecurityValidatorConfig,
  SecurityValidator
} from './SecurityValidator';

export {
  PerformanceMetrics,
  AutoTuneConfig,
  HardwareCapabilities,
  PerformanceReport,
  PerformanceOptimizer
} from './PerformanceOptimizer';

export {
  HealthStatus,
  ServiceCheck,
  HealthCheckResult,
  HealthCheckConfig,
  ServiceConfig,
  HealthCheck,
  createHealthCheckMiddleware
} from './HealthCheck';
