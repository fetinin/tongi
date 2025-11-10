'use client';

import { useMemo, useState } from 'react';
import { Button, Placeholder } from '@telegram-apps/telegram-ui';
import { useTranslations } from 'next-intl';
import type {
  OnboardingErrorState,
  OnboardingErrorType,
} from '@/types/onboarding';

interface OnboardingErrorProps {
  error: OnboardingErrorState | null;
  onRetry?: () => Promise<void> | void;
  onReset?: () => void;
  className?: string;
}

const ERROR_ICONS: Record<OnboardingErrorType, string> = {
  network: '📡',
  validation_failed: '⚠️',
  unauthorized: '🔐',
};

export function OnboardingError({
  error,
  onRetry,
  onReset,
  className,
}: OnboardingErrorProps) {
  const t = useTranslations('onboarding.error');
  const [isRetrying, setIsRetrying] = useState(false);

  const header = useMemo(() => {
    if (!error) {
      return '';
    }
    return t(`headers.${error.type}` as const);
  }, [error, t]);

  if (!error) {
    return null;
  }

  async function handleRetry() {
    if (!onRetry) {
      return;
    }

    try {
      setIsRetrying(true);
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  }

  const primaryAction =
    error.retryable && onRetry ? (
      <Button
        size="m"
        mode="filled"
        disabled={isRetrying}
        onClick={() => void handleRetry()}
      >
        {isRetrying ? t('retrying') : t('retry')}
      </Button>
    ) : undefined;

  const secondaryAction =
    !error.retryable && onReset ? (
      <Button size="m" mode="outline" onClick={onReset}>
        {t('tryAgain')}
      </Button>
    ) : null;

  return (
    <div className={className}>
      <Placeholder
        header={header}
        description={error.message}
        action={primaryAction}
      >
        <div className="text-5xl" aria-hidden>
          {ERROR_ICONS[error.type]}
        </div>
        {secondaryAction}
      </Placeholder>
    </div>
  );
}

export default OnboardingError;
