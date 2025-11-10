'use client';

import React, { useState, useCallback } from 'react';
import { Section, Spinner, Caption } from '@telegram-apps/telegram-ui';
import { BuddySearch } from '@/components/buddy/BuddySearch';
import { useAuth } from '@/components/Auth/AuthProvider';

// Types from BuddySearch
interface SearchedUser {
  id: number;
  telegramUsername: string | null;
  firstName: string;
  tonWalletAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BuddySearchScreenProps {
  /** Callback when buddy request is successfully sent */
  onRequestSent?: (buddyPairId: number) => void;
  /** Callback when error occurs */
  onError?: (error: string) => void;
}

/**
 * BuddySearchScreen - Onboarding wrapper for buddy search
 *
 * Wraps the BuddySearch component with onboarding-specific logic:
 * - Handles buddy request submission
 * - Shows loading state during request
 * - Handles errors and redirects
 *
 * User Story 2: Buddy Request and Confirmation
 */
export function BuddySearchScreen({
  onRequestSent,
  onError,
}: BuddySearchScreenProps) {
  const { authenticatedFetch } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle user selection and send buddy request
   */
  const handleUserSelect = useCallback(
    async (user: SearchedUser) => {
      setIsSubmitting(true);
      setError(null);

      try {
        // Send buddy request to selected user
        const response = await authenticatedFetch('/api/buddy/request', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            targetUserId: user.id,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to send buddy request');
        }

        const data = await response.json();

        // Notify parent that request was sent
        if (onRequestSent) {
          onRequestSent(data.id);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to send buddy request';
        setError(errorMessage);
        if (onError) {
          onError(errorMessage);
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [authenticatedFetch, onRequestSent, onError]
  );

  return (
    <div className="buddy-search-screen">
      {/* Loading state overlay */}
      {isSubmitting && (
        <Section>
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-900 rounded-lg p-8 flex flex-col items-center gap-4">
              <Spinner size="m" />
              <span className="text-sm font-medium">
                Sending buddy request...
              </span>
            </div>
          </div>
        </Section>
      )}

      {/* Error message */}
      {error && !isSubmitting && (
        <Section>
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <Caption level="1" className="text-red-600 dark:text-red-400">
              {error}
            </Caption>
          </div>
        </Section>
      )}

      {/* Buddy search component */}
      <BuddySearch
        onUserSelect={handleUserSelect}
        emptyPlaceholder={
          <div className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400">
              Search for a friend to add as your buddy
            </p>
          </div>
        }
      />
    </div>
  );
}

export default BuddySearchScreen;
