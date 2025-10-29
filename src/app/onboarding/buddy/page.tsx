'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner, Section, Placeholder } from '@telegram-apps/telegram-ui';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { BuddySearchScreen } from '@/components/onboarding/BuddySearchScreen';
import { PendingRequestDisplay } from '@/components/onboarding/PendingRequestDisplay';
import { useAuth } from '@/components/Auth/AuthProvider';
import type {
  BuddyPairStatus,
  OnboardingStatusResponse,
  BuddyInfo,
} from '@/types/onboarding';

interface BuddyPairData {
  id: number;
  buddy: {
    id: number;
    telegramUsername: string | null;
    firstName: string;
    tonWalletAddress: string | null;
    createdAt: string;
  };
  status: BuddyPairStatus;
  initiatedBy: number;
  createdAt: string;
  confirmedAt: string | null;
}

/**
 * Onboarding Buddy Page
 *
 * Shows the buddy search/request flow during onboarding.
 * - If no buddy relationship: Show BuddySearchScreen to find and add buddy
 * - If pending request (initiated by user): Show PendingRequestDisplay with cancel option
 * - If buddy confirmed: Redirect to main app
 *
 * User Story 2: Buddy Request and Confirmation
 */
export default function BuddyOnboardingPage() {
  const router = useRouter();
  const { authenticatedFetch } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buddyStatus, setBuddyStatus] = useState<BuddyPairData | null>(null);
  const [hasBuddy, setHasBuddy] = useState(false);

  /**
   * Fetch current buddy status
   */
  const fetchBuddyStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authenticatedFetch('/api/buddy/status');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch buddy status');
      }

      const data = await response.json();

      // If no buddy relationship, show search screen
      if (data.status === 'no_buddy') {
        setBuddyStatus(null);
        setHasBuddy(false);
      } else {
        // Set buddy status (pending or active)
        setBuddyStatus(data);
        setHasBuddy(data.status === 'active');
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load buddy status';
      setError(errorMessage);
      console.error('Buddy status error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authenticatedFetch]);

  /**
   * Check onboarding status to verify buddy confirmation
   * and redirect to main app if complete
   */
  const checkOnboardingComplete = useCallback(async () => {
    try {
      const response = await authenticatedFetch('/api/onboarding/status');

      if (!response.ok) {
        throw new Error('Failed to check onboarding status');
      }

      const data: OnboardingStatusResponse = await response.json();

      // If onboarding is complete, redirect to main app
      if (
        data.success &&
        data.onboarding.wallet_connected &&
        data.onboarding.buddy_confirmed
      ) {
        router.push('/');
      }
    } catch (err) {
      console.error('Onboarding check error:', err);
      // Continue with buddy flow even if check fails
    }
  }, [authenticatedFetch, router]);

  // Initial load
  useEffect(() => {
    fetchBuddyStatus();
    checkOnboardingComplete();
  }, [fetchBuddyStatus, checkOnboardingComplete]);

  /**
   * Handle buddy request sent - refresh status to show pending state
   */
  const handleRequestSent = useCallback(
    async (buddyPairId: number) => {
      // Refresh buddy status to show pending request
      await fetchBuddyStatus();
    },
    [fetchBuddyStatus]
  );

  /**
   * Handle pending request cancelled - refresh to show search screen again
   */
  const handleRequestCancelled = useCallback(async () => {
    // Refresh buddy status to show search screen again
    await fetchBuddyStatus();
  }, [fetchBuddyStatus]);

  /**
   * Handle buddy request acceptance detected - redirect to main app
   */
  const handleBuddyAccepted = useCallback(async () => {
    // Wait a moment for database to sync, then redirect
    setTimeout(() => {
      router.push('/');
    }, 500);
  }, [router]);

  // Loading state
  if (isLoading) {
    return (
      <OnboardingLayout title="Add Your Buddy">
        <Section>
          <div className="flex justify-center items-center p-8">
            <Spinner size="m" />
            <span className="ml-3">Loading buddy status...</span>
          </div>
        </Section>
      </OnboardingLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <OnboardingLayout title="Add Your Buddy">
        <Section>
          <div className="p-4">
            <Placeholder
              header="Error Loading Buddy Status"
              description={error}
            />
          </div>
        </Section>
      </OnboardingLayout>
    );
  }

  // Show buddy is already confirmed - shouldn't reach here due to redirect, but handle it
  if (hasBuddy) {
    return (
      <OnboardingLayout title="Buddy Confirmed">
        <Section>
          <div className="p-4">
            <Placeholder
              header="Buddy Confirmed!"
              description="Redirecting to main app..."
            />
          </div>
        </Section>
      </OnboardingLayout>
    );
  }

  // Show pending request if user initiated one
  if (buddyStatus && buddyStatus.status === 'pending') {
    const pendingRequest = {
      ...buddyStatus,
      status: 'pending' as const,
    };
    return (
      <OnboardingLayout title="Add Your Buddy">
        <PendingRequestDisplay
          request={pendingRequest}
          onCancelled={handleRequestCancelled}
          onError={(error) => setError(error)}
        />
      </OnboardingLayout>
    );
  }

  // Show search screen if no buddy relationship
  return (
    <OnboardingLayout title="Add Your Buddy">
      <BuddySearchScreen
        onRequestSent={handleRequestSent}
        onError={(error) => setError(error)}
      />
    </OnboardingLayout>
  );
}
