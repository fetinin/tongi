'use client';

import { useState } from 'react';
import {
  Caption,
  List,
  Section,
  Cell,
  Snackbar,
} from '@telegram-apps/telegram-ui';
import { useTranslations } from 'next-intl';
import { BuddySearch } from '@/components/buddy/BuddySearch';
import { BuddyRequest, useBuddyRequest } from '@/components/buddy/BuddyRequest';

interface BuddySearchScreenProps {
  /** Callback invoked after a buddy request is successfully created */
  onBuddyRequested?: () => Promise<void> | void;
}

export function BuddySearchScreen({
  onBuddyRequested,
}: BuddySearchScreenProps) {
  const t = useTranslations('onboarding.buddySearch');
  const {
    targetUser,
    isOpen: isRequestOpen,
    openRequest,
    closeRequest,
  } = useBuddyRequest();

  const [requestError, setRequestError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  async function handleRequestSent() {
    setRequestError(null);
    setShowSuccess(true);
    closeRequest();

    try {
      await onBuddyRequested?.();
    } finally {
      // Snackbar auto-closes, reset state via onClose handler
    }
  }

  function handleRequestError(message: string) {
    setRequestError(message);
  }

  return (
    <div className="flex flex-col gap-6">
      <List>
        <Section
          header={t('sectionHeader')}
          className="rounded-3xl bg-[var(--tg-theme-secondary-bg-color)]/70"
        >
          <Cell
            before={
              <span className="text-2xl" aria-hidden>
                🔍
              </span>
            }
          >
            {t('tips.search')}
          </Cell>
          <Cell
            before={
              <span className="text-2xl" aria-hidden>
                🤝
              </span>
            }
          >
            {t('tips.request')}
          </Cell>
          <Cell
            before={
              <span className="text-2xl" aria-hidden>
                ✅
              </span>
            }
          >
            {t('tips.confirm')}
          </Cell>
        </Section>
      </List>

      <div className="flex flex-col gap-3">
        {requestError ? (
          <Caption
            level="1"
            className="rounded-2xl bg-[var(--tg-theme-destructive-text-color)]/10 px-4 py-3 text-[var(--tg-theme-destructive-text-color)]"
            aria-live="assertive"
          >
            {requestError}
          </Caption>
        ) : null}

        <BuddySearch
          onUserSelect={(user) => {
            setRequestError(null);
            openRequest(user);
          }}
          emptyPlaceholder={
            <Caption
              level="1"
              className="px-4 py-2 text-[var(--tg-theme-hint-color)]"
            >
              {t('emptyPlaceholder')}
            </Caption>
          }
          noResultsPlaceholder={
            <Caption
              level="1"
              className="px-4 py-2 text-[var(--tg-theme-hint-color)]"
            >
              {t('noResultsPlaceholder')}
            </Caption>
          }
          translationsNamespace="buddy.search"
        />
      </div>

      <BuddyRequest
        targetUser={targetUser}
        isOpen={isRequestOpen}
        onClose={closeRequest}
        onRequestSent={() => {
          void handleRequestSent();
        }}
        onError={handleRequestError}
      />

      {showSuccess ? (
        <Snackbar onClose={() => setShowSuccess(false)} className="z-50">
          {t('snackbarSuccess')}
        </Snackbar>
      ) : null}
    </div>
  );
}

export default BuddySearchScreen;
