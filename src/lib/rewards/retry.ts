/**
 * Exponential Backoff Retry Logic
 *
 * Implements exponential backoff with jitter for retrying failed transactions.
 * Configuration:
 * - Initial delay: 2 seconds
 * - Multiplier: 2x per attempt
 * - Max attempts: 3
 * - Jitter: ±10% randomization
 */

import { isRetryableError } from './error-classifier';

export interface RetryConfig {
  initialDelayMs: number; // Initial delay: 2000ms
  multiplier: number; // Exponential multiplier: 2x
  maxAttempts: number; // Maximum attempts: 3
  jitterPercentage: number; // Jitter: ±10%
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: unknown;
  attempts: number;
  lastError?: Error;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  initialDelayMs: 2000,
  multiplier: 2,
  maxAttempts: 3,
  jitterPercentage: 10,
};

/**
 * Calculate delay for a given attempt with exponential backoff and jitter
 *
 * @param attemptNumber Attempt number (0-indexed)
 * @param config Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
  attemptNumber: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  // Calculate exponential delay: initialDelay * (multiplier ^ attemptNumber)
  const exponentialDelay =
    config.initialDelayMs * Math.pow(config.multiplier, attemptNumber);

  // Add jitter: ±10%
  const jitterRange = (exponentialDelay * config.jitterPercentage) / 100;
  const jitter = (Math.random() - 0.5) * 2 * jitterRange;

  return Math.max(0, Math.floor(exponentialDelay + jitter));
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 *
 * @param fn Function to retry
 * @param config Retry configuration
 * @returns RetryResult with success status and result/error
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<RetryResult<T>> {
  let lastError: Error | undefined;
  let lastRawError: unknown;

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      const result = await fn();
      return {
        success: true,
        result,
        attempts: attempt + 1,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      lastRawError = error;

      // Check if error is retryable
      if (!isRetryableError(error)) {
        return {
          success: false,
          error,
          attempts: attempt + 1,
          lastError,
        };
      }

      // If this is the last attempt, don't sleep
      if (attempt === config.maxAttempts - 1) {
        return {
          success: false,
          error,
          attempts: attempt + 1,
          lastError,
        };
      }

      // Calculate backoff delay
      const delayMs = calculateBackoffDelay(attempt, config);
      console.log(
        `[Retry] Attempt ${attempt + 1} failed. Retrying in ${delayMs}ms...`,
        lastError.message
      );

      // Wait before retrying
      await sleep(delayMs);
    }
  }

  return {
    success: false,
    error: lastRawError,
    attempts: config.maxAttempts,
    lastError,
  };
}

/**
 * Determine if a transaction should be retried based on error and attempt count
 *
 * @param error The error that occurred
 * @param retryCount Number of retries already attempted
 * @param maxRetries Maximum retries allowed
 * @returns true if should retry, false otherwise
 */
export function shouldRetry(
  error: unknown,
  retryCount: number,
  maxRetries: number = DEFAULT_RETRY_CONFIG.maxAttempts
): boolean {
  if (retryCount >= maxRetries) {
    return false;
  }

  return isRetryableError(error);
}

/**
 * Format retry delay for logging
 */
export function formatRetryDelay(delayMs: number): string {
  if (delayMs < 1000) {
    return `${delayMs}ms`;
  }
  return `${(delayMs / 1000).toFixed(1)}s`;
}

/**
 * Get retry context for logging and debugging
 */
export interface RetryContext {
  attemptNumber: number;
  maxAttempts: number;
  delayMs: number;
  isRetryable: boolean;
  errorMessage: string;
}

export function getRetryContext(
  error: unknown,
  attemptNumber: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): RetryContext {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const isRetryable = isRetryableError(error);
  const delayMs =
    attemptNumber < config.maxAttempts
      ? calculateBackoffDelay(attemptNumber, config)
      : 0;

  return {
    attemptNumber,
    maxAttempts: config.maxAttempts,
    delayMs,
    isRetryable,
    errorMessage,
  };
}
