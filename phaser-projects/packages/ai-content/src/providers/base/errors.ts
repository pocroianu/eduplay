/**
 * Error hierarchy for provider errors
 */

/**
 * Base error for all provider errors.
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly providerName: string,
    public readonly code: string,
    public readonly retryable: boolean = false,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

/**
 * Provider is not available (not running, unreachable).
 */
export class ProviderUnavailableError extends ProviderError {
  constructor(providerName: string, cause?: Error) {
    super(
      `Provider ${providerName} is unavailable`,
      providerName,
      'PROVIDER_UNAVAILABLE',
      true,
      cause
    );
    this.name = 'ProviderUnavailableError';
  }
}

/**
 * Request timed out.
 */
export class ProviderTimeoutError extends ProviderError {
  constructor(
    providerName: string,
    public readonly timeoutMs: number,
    cause?: Error
  ) {
    super(
      `Provider ${providerName} request timed out after ${timeoutMs}ms`,
      providerName,
      'PROVIDER_TIMEOUT',
      true,
      cause
    );
    this.name = 'ProviderTimeoutError';
  }
}

/**
 * Rate limit exceeded.
 */
export class ProviderRateLimitError extends ProviderError {
  constructor(
    providerName: string,
    public readonly retryAfter?: number
  ) {
    super(
      `Provider ${providerName} rate limit exceeded`,
      providerName,
      'PROVIDER_RATE_LIMIT',
      true
    );
    this.name = 'ProviderRateLimitError';
  }
}

/**
 * Invalid request (bad parameters).
 */
export class ProviderValidationError extends ProviderError {
  constructor(
    providerName: string,
    public readonly validationErrors: string[]
  ) {
    super(
      `Provider ${providerName} validation failed: ${validationErrors.join(', ')}`,
      providerName,
      'PROVIDER_VALIDATION',
      false
    );
    this.name = 'ProviderValidationError';
  }
}

/**
 * Content was rejected (e.g., content filter).
 */
export class ContentRejectedError extends ProviderError {
  constructor(
    providerName: string,
    public readonly reason: string
  ) {
    super(
      `Provider ${providerName} rejected content: ${reason}`,
      providerName,
      'CONTENT_REJECTED',
      false
    );
    this.name = 'ContentRejectedError';
  }
}

/**
 * Model not found or not loaded.
 */
export class ModelNotFoundError extends ProviderError {
  constructor(
    providerName: string,
    public readonly modelName: string
  ) {
    super(
      `Provider ${providerName} model not found: ${modelName}`,
      providerName,
      'MODEL_NOT_FOUND',
      false
    );
    this.name = 'ModelNotFoundError';
  }
}
