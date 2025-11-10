'use client';

import { Placeholder, Spinner } from '@telegram-apps/telegram-ui';
import { useTranslations } from 'next-intl';
import { WelcomeScreen } from '@/components/onboarding/WelcomeScreen';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { OnboardingError } from '@/components/onboarding/OnboardingError';
import { useOnboardingGuard } from '@/hooks/useOnboardingGuard';

export default function WelcomePage() {
  const { status, isLoading, error, refresh } = useOnboardingGuard();
  const t = useTranslations('onboarding.welcomePage');

  if (isLoading) {
    return (
      <OnboardingLayout
        title={t('loadingTitle')}
        description={t('loadingDescription')}
      >
        <Placeholder>
          <Spinner size="l" />
        </Placeholder>
      </OnboardingLayout>
    );
  }

  if (error) {
    return (
      <OnboardingLayout
        title={t('errorTitle')}
        description={t('errorDescription')}
      >
        <OnboardingError error={error} onRetry={refresh} />
      </OnboardingLayout>
    );
  }

  if (!status || status.onboarding.current_step !== 'welcome') {
    return (
      <OnboardingLayout
        title={t('redirectTitle')}
        description={t('redirectDescription')}
      >
        <Placeholder>
          <Spinner size="m" />
        </Placeholder>
      </OnboardingLayout>
    );
  }

  return <WelcomeScreen onRefresh={refresh} />;
}
