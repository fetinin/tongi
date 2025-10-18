/**
 * Error Classification Module
 *
 * Classifies blockchain and network errors to determine if they should be retried.
 * Distinguishes between:
 * - Retryable errors: Network timeouts, rate limits, temporary blockchain issues
 * - Non-retryable errors: Invalid arguments, insufficient balance, invalid addresses
 */

import { ClassifiedError, ErrorClassification } from '@/types/blockchain';

/**
 * Network error codes and patterns that indicate retryable errors
 */
const RETRYABLE_ERROR_PATTERNS = [
  // Network errors
  /timeout/i,
  /ECONNREFUSED/,
  /ECONNRESET/,
  /ETIMEDOUT/,
  /network/i,
  /connection/i,

  // Rate limiting
  /rate.?limit/i,
  /too.?many.?request/i,
  /429/,

  // Temporary blockchain issues
  /temporarily unavailable/i,
  /service.?unavailable/i,
  /overloaded/i,

  // TON-specific transient errors
  /exitcode.*-1/i, // TON exit code -1 (generic error, might be temporary)
  /exitcode.*209/i, // TON cell underflow (temporary)
];

/**
 * Error codes and patterns that indicate non-retryable errors
 */
const NON_RETRYABLE_ERROR_PATTERNS = [
  // Invalid arguments
  /invalid.?address/i,
  /invalid.?amount/i,
  /invalid.?parameter/i,
  /invalid.?argument/i,

  // Insufficient balance
  /insufficient.?balance/i,
  /insufficient.?fund/i,
  /not.?enough.?ton/i,

  // Contract errors
  /contract.?error/i,
  /contract.?not.?found/i,

  // TON-specific permanent failures
  /exitcode.*0/i, // Successful completion (not an error)
  /exitcode.*100/i, // TON exit code 100+ (generic contract error)

  // Already processed
  /already.?processed/i,
  /duplicate.?transaction/i,
];

/**
 * Classify an error to determine if it should be retried
 *
 * @param error The error to classify
 * @returns Classification and details
 */
export function classifyError(error: unknown): ClassifiedError {
  const errorMessage = getErrorMessage(error);
  const errorCode = getErrorCode(error);

  // Check non-retryable patterns first
  for (const pattern of NON_RETRYABLE_ERROR_PATTERNS) {
    if (pattern.test(errorMessage) || (errorCode && pattern.test(errorCode))) {
      return {
        classification: 'non_retryable',
        message: errorMessage,
        code: errorCode || undefined,
        originalError:
          error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  // Check retryable patterns
  for (const pattern of RETRYABLE_ERROR_PATTERNS) {
    if (pattern.test(errorMessage) || (errorCode && pattern.test(errorCode))) {
      return {
        classification: 'retryable',
        message: errorMessage,
        code: errorCode || undefined,
        originalError:
          error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  // Default to non-retryable for unknown errors
  return {
    classification: 'non_retryable',
    message: errorMessage,
    code: errorCode || undefined,
    originalError: error instanceof Error ? error : new Error(String(error)),
  };
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  return classifyError(error).classification === 'retryable';
}

/**
 * Extract error message from various error types
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    if ('message' in error && typeof (error as any).message === 'string') {
      return (error as any).message;
    }
    if ('error' in error && typeof (error as any).error === 'string') {
      return (error as any).error;
    }
  }
  return String(error);
}

/**
 * Extract error code from various error types
 */
function getErrorCode(error: unknown): string | null {
  if (error && typeof error === 'object') {
    if ('code' in error && typeof (error as any).code === 'string') {
      return (error as any).code;
    }
    if ('status' in error && typeof (error as any).status === 'string') {
      return (error as any).status;
    }
    if (
      'statusCode' in error &&
      typeof (error as any).statusCode === 'number'
    ) {
      return String((error as any).statusCode);
    }
  }
  return null;
}

/**
 * Get user-friendly error message for a classified error
 */
export function getUserFriendlyErrorMessage(
  error: unknown,
  retryCount?: number
): string {
  const classified = classifyError(error);

  if (classified.classification === 'non_retryable') {
    return 'An error occurred and the transaction cannot be retried. Please check your wallet and try again.';
  }

  if (classified.classification === 'retryable') {
    if (retryCount && retryCount > 0) {
      return `Network error occurred. Retrying... (attempt ${retryCount})`;
    }
    return 'Network error occurred. The system will automatically retry.';
  }

  return 'An unexpected error occurred. Please try again.';
}
