'use client';

import { useMemo, useState } from 'react';
import {
  Button,
  Caption,
  List,
  Section,
  Cell,
  Snackbar,
} from '@telegram-apps/telegram-ui';
import { useFormatter, useTranslations } from 'next-intl';
import type { OnboardingBuddyInfo } from '@/types/onboarding';

interface PendingRequestDisplayProps {
  request: OnboardingBuddyInfo;
  onCancel?: () => Promise<void> | void;
}

export function PendingRequestDisplay({
  request,
  onCancel,
}: PendingRequestDisplayProps) {
  const t = useTranslations('onboarding.pending');
  const formatter = useFormatter();
  const { profile, createdAt } = request;
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const submittedAt = useMemo(() => {
    try {
      const value = new Date(createdAt);
      if (Number.isNaN(value.getTime())) {
        return createdAt;
      }

      return formatter.dateTime(value, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return createdAt;
    }
  }, [createdAt, formatter]);

  async function handleCancel() {
    if (!onCancel) {
      return;
    }

    setError(null);
    setIsCancelling(true);

    try {
      await onCancel();
      setShowSuccess(true);
    } catch (cancelError) {
      const message =
        cancelError instanceof Error ? cancelError.message : t('error');
      setError(message);
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <List>
        <Section header={t('header')}>
          <Cell
            before={
              <span className="text-2xl" aria-hidden>
                🌟
              </span>
            }
            subtitle={t('waitingSubtitle', { name: profile.displayName })}
          >
            {profile.username ? `@${profile.username}` : profile.displayName}
          </Cell>
          <Cell
            before={
              <span className="text-2xl" aria-hidden>
                ⏱️
              </span>
            }
            subtitle={t('submittedSubtitle', { date: submittedAt })}
          >
            {t('reminder')}
          </Cell>
        </Section>
      </List>

      <div className="rounded-3xl bg-[var(--tg-theme-secondary-bg-color)]/70 px-4 py-5">
        <Caption level="1" className="text-[var(--tg-theme-hint-color)]">
          {t('tip')}
        </Caption>
      </div>

      <Button
        size="l"
        mode="outline"
        className="min-h-[44px] touch-manipulation"
        disabled={isCancelling}
        onClick={() => void handleCancel()}
      >
        {isCancelling ? t('button.cancelling') : t('button.cancel')}
      </Button>

      {error ? (
        <Caption
          level="1"
          className="rounded-2xl bg-[var(--tg-theme-destructive-text-color)]/10 px-4 py-3 text-[var(--tg-theme-destructive-text-color)]"
          aria-live="assertive"
        >
          {error}
        </Caption>
      ) : null}

      {showSuccess ? (
        <Snackbar onClose={() => setShowSuccess(false)} className="z-50">
          {t('snackbar')}
        </Snackbar>
      ) : null}
    </div>
  );
}

export default PendingRequestDisplay;
