'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Placeholder, Spinner } from '@telegram-apps/telegram-ui';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/components/Auth/AuthProvider';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import { OnboardingError } from '@/components/onboarding/OnboardingError';
import { BuddySearchScreen } from '@/components/onboarding/BuddySearchScreen';
import { PendingRequestDisplay } from '@/components/onboarding/PendingRequestDisplay';
import { useOnboardingGuard } from '@/hooks/useOnboardingGuard';
import type { OnboardingBuddyInfo } from '@/types/onboarding';

function RedirectingPlaceholder({
  header,
  description,
}: {
  header: string;
  description: string;
}) {
  return (
    <Placeholder header={header} description={description}>
      <Spinner size="m" />
    </Placeholder>
  );
}

export default function BuddyOnboardingPage() {
  const router = useRouter();
  const t = useTranslations('onboarding.buddyPage');
  const { authenticatedFetch } = useAuth();
  const { status, isLoading, error, refresh } = useOnboardingGuard({
    autoRedirect: false,
  });

  useEffect(() => {
    if (!status || isLoading) {
      return;
    }

    const step = status.onboarding.current_step;
    if (step === 'welcome') {
      router.replace('/onboarding/welcome');
    } else if (step === 'complete') {
      router.replace('/');
    }
  }, [status, isLoading, router]);

  const pendingRequest: OnboardingBuddyInfo | null = useMemo(() => {
    if (!status?.buddy || status.buddy.status !== 'pending') {
      return null;
    }
    return status.buddy;
  }, [status]);

  const handleBuddyRequested = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const handleCancelRequest = useCallback(async () => {
    const response = await authenticatedFetch('/api/buddy/cancel', {
      method: 'DELETE',
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        payload && typeof payload === 'object' && payload && 'error' in payload
          ? String((payload as { error?: unknown }).error)
          : 'Failed to cancel buddy request';
      throw new Error(message);
    }

    await refresh();
  }, [authenticatedFetch, refresh]);

  if (error) {
    return (
      <OnboardingLayout
        title={t('error.title')}
        description={t('error.description')}
      >
        <OnboardingError error={error} onRetry={refresh} />
      </OnboardingLayout>
    );
  }

  if (isLoading || !status) {
    return (
      <RedirectingPlaceholder
        header={t('placeholders.checkingTitle')}
        description={t('placeholders.checkingDescription')}
      />
    );
  }

  if (status.onboarding.current_step === 'welcome') {
    return (
      <RedirectingPlaceholder
        header={t('placeholders.walletTitle')}
        description={t('placeholders.walletDescription')}
      />
    );
  }

  if (status.onboarding.current_step === 'complete') {
    return (
      <RedirectingPlaceholder
        header={t('placeholders.completeTitle')}
        description={t('placeholders.completeDescription')}
      />
    );
  }

  const description = pendingRequest
    ? t('layout.descriptionPending', {
        name: pendingRequest.profile.displayName,
      })
    : t('layout.descriptionDefault');

  return (
    <OnboardingLayout title={t('layout.title')} description={description}>
      {pendingRequest ? (
        <PendingRequestDisplay
          request={pendingRequest}
          onCancel={() => handleCancelRequest()}
        />
      ) : (
        <BuddySearchScreen onBuddyRequested={handleBuddyRequested} />
      )}
    </OnboardingLayout>
  );
}
