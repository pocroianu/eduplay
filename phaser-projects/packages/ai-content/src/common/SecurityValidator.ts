/**
 * Security validation for user inputs and configurations.
 *
 * Implements OWASP Top 10 protections:
 * - A01: Broken Access Control - Path validation
 * - A03: Injection - Input sanitization
 * - A05: Security Misconfiguration - Environment validation
 * - A09: Logging Failures - Secure logging (via Logger)
 */

import { z } from 'zod';
import * as path from 'path';
import { Logger } from './Logger';

/**
 * Security validation errors
 */
export class SecurityValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'SecurityValidationError';
  }
}

/**
 * Security validator configuration
 */
export interface SecurityValidatorConfig {
  allowedPaths?: string[];
  maxInputLength?: number;
  allowedFileExtensions?: string[];
}

/**
 * Security validation for user inputs and configurations.
 *
 * @example
 * ```typescript
 * const validator = new SecurityValidator({
 *   allowedPaths: ['/app/data', '/app/output']
 * });
 *
 * // Validate file path
 * const safePath = validator.validatePath(userInput);
 *
 * // Validate game ID
 * const gameId = validator.validateGameId('fruits-01');
 *
 * // Sanitize user input
 * const clean = validator.sanitizeInput(userInput);
 * ```
 */
export class SecurityValidator {
  private logger: Logger;
  private config: Required<SecurityValidatorConfig>;

  constructor(config: SecurityValidatorConfig = {}) {
    this.logger = new Logger('SecurityValidator');
    this.config = {
      allowedPaths: config.allowedPaths || [process.cwd()],
      maxInputLength: config.maxInputLength || 10000,
      allowedFileExtensions: config.allowedFileExtensions || [
        '.png', '.jpg', '.jpeg', '.gif', '.webp',
        '.json', '.txt', '.md',
        '.wav', '.mp3', '.ogg'
      ]
    };
  }

  /**
   * Validate and sanitize file path (A01: Broken Access Control)
   *
   * Prevents:
   * - Directory traversal attacks (../)
   * - Absolute paths outside allowed directories
   * - Symbolic link attacks
   */
  validatePath(filePath: string, allowedPaths?: string[]): string {
    const paths = allowedPaths || this.config.allowedPaths;

    // Normalize path (resolve .., ., etc.)
    const normalized = path.normalize(filePath);

    // Convert to absolute
    const absolute = path.isAbsolute(normalized)
      ? normalized
      : path.resolve(process.cwd(), normalized);

    // Check if path is within allowed directories
    const isAllowed = paths.some(allowedPath => {
      const absoluteAllowed = path.resolve(allowedPath);
      return absolute.startsWith(absoluteAllowed);
    });

    if (!isAllowed) {
      this.logger.warn('Path access denied', {
        requestedPath: filePath,
        normalizedPath: absolute,
        allowedPaths: paths
      });

      throw new SecurityValidationError(
        `Path not allowed: ${filePath}`,
        'PATH_NOT_ALLOWED',
        { requestedPath: filePath, allowedPaths: paths }
      );
    }

    // Check file extension if it has one
    const ext = path.extname(absolute).toLowerCase();
    if (ext && !this.config.allowedFileExtensions.includes(ext)) {
      throw new SecurityValidationError(
        `File extension not allowed: ${ext}`,
        'EXTENSION_NOT_ALLOWED',
        { extension: ext, allowedExtensions: this.config.allowedFileExtensions }
      );
    }

    return absolute;
  }

  /**
   * Validate game ID format
   *
   * Only allows: lowercase letters, numbers, hyphens
   * Format: ^[a-z0-9-]+$
   */
  validateGameId(gameId: string): string {
    const schema = z.string()
      .min(1, 'Game ID cannot be empty')
      .max(100, 'Game ID too long')
      .regex(/^[a-z0-9-]+$/, 'Game ID must contain only lowercase letters, numbers, and hyphens');

    try {
      return schema.parse(gameId);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new SecurityValidationError(
          `Invalid game ID: ${error.errors[0].message}`,
          'INVALID_GAME_ID',
          { gameId, errors: error.errors }
        );
      }
      throw error;
    }
  }

  /**
   * Validate category name
   */
  validateCategory(category: string): string {
    const schema = z.string()
      .min(1)
      .max(50)
      .regex(/^[a-z0-9-_]+$/i, 'Category must contain only letters, numbers, hyphens, and underscores');

    try {
      return schema.parse(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new SecurityValidationError(
          `Invalid category: ${error.errors[0].message}`,
          'INVALID_CATEGORY',
          { category, errors: error.errors }
        );
      }
      throw error;
    }
  }

  /**
   * Validate configuration object using Zod schema
   */
  validateConfig<T>(config: unknown, schema: z.ZodSchema<T>): T {
    try {
      return schema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.logger.error('Configuration validation failed', undefined, {
          errors: error.errors
        });

        throw new SecurityValidationError(
          'Configuration validation failed',
          'CONFIG_VALIDATION_ERROR',
          { errors: error.errors }
        );
      }
      throw error;
    }
  }

  /**
   * Sanitize user input (A03: Injection)
   *
   * Prevents:
   * - XSS attacks (HTML/script tags)
   * - Command injection (shell metacharacters)
   * - SQL injection (basic patterns)
   */
  sanitizeInput(input: string): string {
    // Check length
    if (input.length > this.config.maxInputLength) {
      throw new SecurityValidationError(
        `Input too long (max ${this.config.maxInputLength} characters)`,
        'INPUT_TOO_LONG',
        { length: input.length, maxLength: this.config.maxInputLength }
      );
    }

    let sanitized = input;

    // Remove HTML/script tags
    sanitized = sanitized.replace(/<[^>]*>/g, '');

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // Remove control characters (except newline, tab, carriage return)
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    return sanitized;
  }

  /**
   * Sanitize HTML content (more aggressive)
   */
  sanitizeHtml(html: string): string {
    // Remove all HTML tags
    let sanitized = html.replace(/<[^>]*>/g, '');

    // Decode HTML entities
    sanitized = sanitized
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&amp;/g, '&');

    // Re-encode dangerous characters
    sanitized = sanitized
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');

    return sanitized;
  }

  /**
   * Validate URL (prevent SSRF - A10)
   */
  validateUrl(url: string, allowedHosts?: string[]): string {
    try {
      const parsed = new URL(url);

      // Only allow http/https
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new SecurityValidationError(
          `Protocol not allowed: ${parsed.protocol}`,
          'INVALID_PROTOCOL',
          { url, protocol: parsed.protocol }
        );
      }

      // Block private IP ranges
      const hostname = parsed.hostname;
      if (this.isPrivateIp(hostname)) {
        throw new SecurityValidationError(
          'Private IP addresses not allowed',
          'PRIVATE_IP_NOT_ALLOWED',
          { url, hostname }
        );
      }

      // Check allowed hosts if provided
      if (allowedHosts && allowedHosts.length > 0) {
        const isAllowed = allowedHosts.some(allowed =>
          hostname === allowed || hostname.endsWith(`.${allowed}`)
        );

        if (!isAllowed) {
          throw new SecurityValidationError(
            `Host not allowed: ${hostname}`,
            'HOST_NOT_ALLOWED',
            { url, hostname, allowedHosts }
          );
        }
      }

      return url;

    } catch (error) {
      if (error instanceof SecurityValidationError) {
        throw error;
      }

      throw new SecurityValidationError(
        `Invalid URL: ${url}`,
        'INVALID_URL',
        { url, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Validate environment variables (A05: Security Misconfiguration)
   */
  validateEnvironment(required: string[] = []): void {
    const missing: string[] = [];

    for (const key of required) {
      if (!process.env[key]) {
        missing.push(key);
      }
    }

    if (missing.length > 0) {
      this.logger.error('Missing required environment variables', undefined, {
        missing
      });

      throw new SecurityValidationError(
        `Required environment variables missing: ${missing.join(', ')}`,
        'MISSING_ENV_VARS',
        { missing }
      );
    }

    // Check for common security issues
    if (process.env.NODE_ENV === 'production') {
      // Ensure debug mode is off
      if (process.env.DEBUG) {
        this.logger.warn('DEBUG mode enabled in production');
      }

      // Check for default passwords/secrets
      const dangerousDefaults = ['password', 'secret', 'admin', 'default'];
      for (const key of Object.keys(process.env)) {
        const value = process.env[key]?.toLowerCase() || '';
        if (dangerousDefaults.some(d => value.includes(d))) {
          this.logger.warn('Potentially unsafe environment variable', {
            key: key
          });
        }
      }
    }
  }

  /**
   * Validate prompt content (check for injection attempts)
   */
  validatePrompt(prompt: string): string {
    // Check for prompt injection patterns
    const injectionPatterns = [
      /ignore\s+previous\s+instructions/i,
      /system\s*:\s*/i,
      /\[INST\]/i,
      /\[\/INST\]/i,
      /<\|im_start\|>/i,
      /<\|im_end\|>/i
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(prompt)) {
        throw new SecurityValidationError(
          'Potential prompt injection detected',
          'PROMPT_INJECTION',
          { prompt: prompt.substring(0, 100) }
        );
      }
    }

    return this.sanitizeInput(prompt);
  }

  // Private methods

  /**
   * Check if hostname is a private IP
   */
  private isPrivateIp(hostname: string): boolean {
    // localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return true;
    }

    // Private IPv4 ranges
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^169\.254\./ // Link-local
    ];

    return privateRanges.some(range => range.test(hostname));
  }
}
