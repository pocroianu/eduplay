/**
 * Retry utility with exponential backoff
 */

import { ProviderError, ProviderRateLimitError } from '../base/errors';

export interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitterFactor: number;
  onRetry?: (error: Error, attempt: number, delay: number) => void;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
  onRetry: undefined
};

/**
 * Execute a function with exponential backoff retry.
 *
 * Features:
 * - Exponential backoff with configurable multiplier
 * - Jitter to prevent thundering herd problem
 * - Respects rate limit retry-after headers
 * - Only retries on retryable errors
 *
 * @param fn - The function to execute
 * @param options - Retry configuration options
 * @returns The result of the function
 * @throws The last error if all retries exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      if (error instanceof ProviderError && !error.retryable) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt >= opts.maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff and jitter
      let delay = opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt);
      delay = Math.min(delay, opts.maxDelay);

      // Add jitter to prevent thundering herd
      const jitter = delay * opts.jitterFactor * (Math.random() * 2 - 1);
      delay = Math.round(delay + jitter);

      // Honor rate limit retry-after if present
      if (error instanceof ProviderRateLimitError && error.retryAfter) {
        delay = Math.max(delay, error.retryAfter * 1000);
      }

      // Notify callback
      if (opts.onRetry) {
        opts.onRetry(lastError, attempt + 1, delay);
      }

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Sleep for a specified number of milliseconds.
 *
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
