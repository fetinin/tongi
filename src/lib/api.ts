/**
 * Authenticated API client utilities
 *
 * Provides automatic token refresh and retry logic for API requests
 * that receive 401 Unauthorized responses.
 */

export interface AuthenticatedFetchOptions extends RequestInit {
  /** Skip automatic retry on 401 (useful for auth endpoints) */
  skipRetry?: boolean;
}

export interface ReAuthCallback {
  /** Callback to trigger re-authentication and get new token */
  (): Promise<string | null>;
}

/**
 * Creates an authenticated fetch wrapper that automatically handles 401 errors
 *
 * When a request receives a 401 response:
 * 1. Calls the reAuthCallback to get a fresh token
 * 2. Retries the original request with the new token
 * 3. Returns the retry response to the caller
 *
 * This ensures seamless token refresh without requiring manual re-login.
 *
 * @param getToken - Function to retrieve current auth token
 * @param reAuthCallback - Function to trigger re-authentication and get new token
 * @returns Wrapped fetch function with automatic retry logic
 */
export function createAuthenticatedFetch(
  getToken: () => string | null,
  reAuthCallback: ReAuthCallback
) {
  return async function authenticatedFetch(
    input: RequestInfo | URL,
    init?: AuthenticatedFetchOptions
  ): Promise<Response> {
    const { skipRetry = false, ...fetchOptions } = init || {};

    // Add authorization header if token exists
    const token = getToken();
    const headers = new Headers(fetchOptions.headers);

    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    // Make the initial request
    const requestOptions: RequestInit = {
      ...fetchOptions,
      headers,
    };

    let response = await fetch(input, requestOptions);

    // If we get a 401 and retry is not disabled, attempt re-authentication
    if (response.status === 401 && !skipRetry) {
      try {
        // Trigger re-authentication to get new token
        const newToken = await reAuthCallback();

        if (!newToken) {
          return response; // Return original 401 response
        }

        // Update authorization header with new token
        headers.set('Authorization', `Bearer ${newToken}`);

        // Retry the original request with new token
        const retryOptions: RequestInit = {
          ...fetchOptions,
          headers,
        };

        response = await fetch(input, retryOptions);
      } catch (error) {
        // Return original 401 response if re-auth fails
      }
    }

    return response;
  };
}

/**
 * Simple in-memory mutex to prevent concurrent re-authentication attempts
 */
export class AuthMutex {
  private locked = false;
  private queue: Array<() => void> = [];

  /**
   * Acquire the mutex lock
   * Returns a promise that resolves when the lock is acquired
   */
  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }

    // Wait for lock to be released
    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  /**
   * Release the mutex lock
   * Resolves the next waiting promise in the queue
   */
  release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.locked = false;
    }
  }

  /**
   * Check if mutex is currently locked
   */
  isLocked(): boolean {
    return this.locked;
  }
}
