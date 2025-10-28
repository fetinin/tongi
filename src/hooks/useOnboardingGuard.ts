/**
 * useOnboardingGuard Hook
 *
 * Client-side onboarding state guard for routing logic.
 * Fetches onboarding status from /api/onboarding/status and provides
 * redirect logic based on current step.
 *
 * Based on specs/005-mobile-first-onboarding/research.md
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/Auth/AuthProvider';
import {
  OnboardingState,
  OnboardingStatusResponse,
  OnboardingErrorResponse,
} from '@/types/onboarding';

export interface UseOnboardingGuardResult {
  /** Current onboarding state (null while loading) */
  onboardingState: OnboardingState | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state (network errors, validation failures) */
  error: OnboardingError | null;
  /** Retry function for error recovery */
  retry: () => Promise<void>;
}

export interface OnboardingError {
  type: 'network' | 'validation_failed' | 'unauthorized';
  message: string;
  retryable: boolean;
}

/**
 * Hook to guard routes based on onboarding completion
 *
 * @returns Onboarding state and loading/error states
 */
export function useOnboardingGuard(): UseOnboardingGuardResult {
  const [onboardingState, setOnboardingState] =
    useState<OnboardingState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<OnboardingError | null>(null);

  const { authenticatedFetch, isAuthenticated } = useAuth();

  /**
   * Fetch onboarding status from API
   */
  const fetchOnboardingStatus = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await authenticatedFetch('/api/onboarding/status');

      if (!response.ok) {
        // Handle HTTP errors
        if (response.status === 401) {
          setError({
            type: 'unauthorized',
            message: 'Authentication failed. Please log in again.',
            retryable: false,
          });
          return;
        }

        if (response.status >= 500) {
          setError({
            type: 'network',
            message: 'Cannot connect to server. Please retry.',
            retryable: true,
          });
          return;
        }

        const errorData = (await response.json()) as OnboardingErrorResponse;
        setError({
          type: 'validation_failed',
          message: errorData.error || 'Failed to retrieve onboarding status',
          retryable: false,
        });
        return;
      }

      const data = (await response.json()) as OnboardingStatusResponse;
      setOnboardingState(data.onboarding);
    } catch (err) {
      // Network errors (fetch failures, timeouts)
      setError({
        type: 'network',
        message: 'Network error. Please check your connection and retry.',
        retryable: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, authenticatedFetch]);

  /**
   * Retry function for error recovery
   */
  const retry = useCallback(async () => {
    await fetchOnboardingStatus();
  }, [fetchOnboardingStatus]);

  /**
   * Fetch onboarding status on mount and when authentication changes
   */
  useEffect(() => {
    fetchOnboardingStatus();
  }, [fetchOnboardingStatus]);

  return {
    onboardingState,
    isLoading,
    error,
    retry,
  };
}

/**
 * Hook to redirect user based on onboarding state
 *
 * Use this in pages that require complete onboarding.
 * Redirects to appropriate onboarding step if not complete.
 *
 * @param allowedStep - Minimum onboarding step required (optional)
 */
export function useOnboardingRedirect(
  allowedStep?: 'welcome' | 'buddy' | 'complete'
): UseOnboardingGuardResult {
  const result = useOnboardingGuard();
  const router = useRouter();

  useEffect(() => {
    if (result.isLoading || !result.onboardingState) {
      return;
    }

    const { current_step } = result.onboardingState;

    // If no specific step required, don't redirect
    if (!allowedStep) {
      return;
    }

    // Redirect logic based on current step vs required step
    if (allowedStep === 'complete' && current_step !== 'complete') {
      if (current_step === 'welcome') {
        router.push('/onboarding/welcome');
      } else if (current_step === 'buddy') {
        router.push('/onboarding/buddy');
      }
    } else if (allowedStep === 'buddy' && current_step === 'welcome') {
      router.push('/onboarding/welcome');
    }
  }, [result.isLoading, result.onboardingState, allowedStep, router]);

  return result;
}

/**
 * Type guard to check if onboarding is complete
 */
export function isOnboardingComplete(state: OnboardingState | null): boolean {
  return state?.current_step === 'complete';
}
