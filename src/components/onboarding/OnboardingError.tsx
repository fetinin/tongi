/**
 * OnboardingError Component
 *
 * Displays error states for onboarding flow with retry functionality.
 * Distinguishes between network errors (retryable) and validation failures (not retryable).
 *
 * Based on specs/005-mobile-first-onboarding/research.md (Decision #6)
 */

'use client';

import React from 'react';
import { Button, Placeholder, Text } from '@telegram-apps/telegram-ui';
import { OnboardingError as OnboardingErrorType } from '@/hooks/useOnboardingGuard';

export interface OnboardingErrorProps {
  /** Error information */
  error: OnboardingErrorType;
  /** Retry callback (shown only for retryable errors) */
  onRetry?: () => void;
}

/**
 * Error display component for onboarding flow
 *
 * Shows appropriate error message and retry button based on error type:
 * - Network errors: Show retry button
 * - Validation failures: Show explanation without retry
 * - Unauthorized: Show re-authentication message
 */
export function OnboardingError({ error, onRetry }: OnboardingErrorProps) {
  const getErrorIcon = () => {
    switch (error.type) {
      case 'network':
        return '❌';
      case 'validation_failed':
        return '⚠️';
      case 'unauthorized':
        return '🔒';
      default:
        return '❌';
    }
  };

  const getErrorTitle = () => {
    switch (error.type) {
      case 'network':
        return 'Connection Error';
      case 'validation_failed':
        return 'Validation Failed';
      case 'unauthorized':
        return 'Authentication Required';
      default:
        return 'Error';
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <Placeholder
          header={getErrorTitle()}
          description={
            <div className="space-y-4">
              <Text className="text-base">{error.message}</Text>
              {error.retryable && onRetry && (
                <Button
                  size="l"
                  mode="filled"
                  onClick={onRetry}
                  className="w-full touch-manipulation"
                  style={{ minHeight: '44px' }}
                >
                  Retry
                </Button>
              )}
              {!error.retryable && error.type === 'unauthorized' && (
                <Text className="text-sm text-gray-500 dark:text-gray-400">
                  Please close and reopen the app to authenticate.
                </Text>
              )}
            </div>
          }
        >
          <div className="text-6xl">{getErrorIcon()}</div>
        </Placeholder>
      </div>
    </div>
  );
}
