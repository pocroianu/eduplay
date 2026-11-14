/**
 * Structured logging with correlation IDs for distributed tracing.
 *
 * Features:
 * - JSON logging for machine parsing
 * - Correlation ID support
 * - Log levels (DEBUG, INFO, WARN, ERROR, FATAL)
 * - Component-based logging (namespace per module)
 * - Child logger support
 */

import { v4 as uuid } from 'uuid';

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  correlationId: string;
  message: string;
  context?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  minLevel?: LogLevel;
  pretty?: boolean;
  component?: string;
}

/**
 * Structured logger with correlation IDs.
 *
 * @example
 * ```typescript
 * const logger = new Logger('GameGenerator');
 * logger.info('Starting generation', { gameId: 'fruits-01' });
 *
 * // Create child logger with same correlation ID
 * const childLogger = logger.child('ImageGenerator');
 * childLogger.debug('Generated image', { path: '/images/apple.png' });
 * ```
 */
export class Logger {
  private correlationId: string;
  private minLevel: LogLevel;
  private pretty: boolean;

  private static instance?: Logger;

  constructor(
    private component: string,
    config: LoggerConfig = {}
  ) {
    this.correlationId = uuid();
    this.minLevel = config.minLevel || LogLevel.INFO;
    this.pretty = config.pretty ?? process.env.NODE_ENV !== 'production';
  }

  /**
   * Get singleton logger instance
   */
  static getInstance(component: string = 'App', config?: LoggerConfig): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(component, config);
    }
    return Logger.instance;
  }

  /**
   * Set correlation ID (for tracing requests)
   */
  setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId;
  }

  /**
   * Get current correlation ID
   */
  getCorrelationId(): string {
    return this.correlationId;
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log warning
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log error
   */
  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, {
      ...context,
      error: error ? {
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      } : undefined
    });
  }

  /**
   * Log fatal error
   */
  fatal(message: string, error?: Error, context?: Record<string, any>): void {
    this.log(LogLevel.FATAL, message, {
      ...context,
      error: error ? {
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      } : undefined
    });
  }

  /**
   * Create child logger with same correlation ID
   */
  child(component: string): Logger {
    const child = new Logger(component, {
      minLevel: this.minLevel,
      pretty: this.pretty
    });
    child.correlationId = this.correlationId;
    return child;
  }

  /**
   * Check if level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL];
    const currentIndex = levels.indexOf(level);
    const minIndex = levels.indexOf(this.minLevel);
    return currentIndex >= minIndex;
  }

  /**
   * Log message with level
   */
  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component: this.component,
      correlationId: this.correlationId,
      message,
      ...context
    };

    // Output as JSON or pretty-printed
    if (this.pretty) {
      this.prettyPrint(logEntry);
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }

  /**
   * Pretty-print log entry for development
   */
  private prettyPrint(entry: LogEntry): void {
    const levelColors: Record<LogLevel, string> = {
      [LogLevel.DEBUG]: '\x1b[36m', // Cyan
      [LogLevel.INFO]: '\x1b[32m',  // Green
      [LogLevel.WARN]: '\x1b[33m',  // Yellow
      [LogLevel.ERROR]: '\x1b[31m', // Red
      [LogLevel.FATAL]: '\x1b[35m'  // Magenta
    };

    const reset = '\x1b[0m';
    const color = levelColors[entry.level];

    let output = `${color}[${entry.level.toUpperCase()}]${reset} `;
    output += `${entry.timestamp} `;
    output += `[${entry.component}] `;
    output += `${entry.message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      output += ` ${JSON.stringify(entry.context, null, 2)}`;
    }

    if (entry.error) {
      output += `\n${reset}${entry.error.stack || entry.error.message}`;
    }

    console.log(output);
  }
}
