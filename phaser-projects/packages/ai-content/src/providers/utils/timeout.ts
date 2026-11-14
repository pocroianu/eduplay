/**
 * Timeout utilities for provider requests
 */

import { ProviderTimeoutError } from '../base/errors';

/**
 * Wrap a promise with a timeout.
 *
 * If the promise doesn't resolve within the specified time,
 * it will be rejected with a ProviderTimeoutError.
 *
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param providerName - Name of the provider for error reporting
 * @returns The result of the promise
 * @throws ProviderTimeoutError if timeout is exceeded
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  providerName: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new ProviderTimeoutError(providerName, timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

/**
 * Create an AbortController with automatic timeout.
 *
 * Useful for fetch requests and other operations that support AbortSignal.
 *
 * @param timeoutMs - Timeout in milliseconds
 * @returns AbortController that will abort after timeout
 */
export function createTimeoutController(timeoutMs: number): AbortController {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller;
}
