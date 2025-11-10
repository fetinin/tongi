'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Caption,
  List,
  Cell,
  Snackbar,
  Spinner,
} from '@telegram-apps/telegram-ui';
import { useTranslations } from 'next-intl';
import { useTonWalletContext } from '@/components/wallet/TonProvider';
import { useAuth } from '@/components/Auth/AuthProvider';
import OnboardingLayout from './OnboardingLayout';

interface WelcomeScreenProps {
  /**
   * Optional callback invoked after the onboarding status refresh completes.
   * Used by pages to revalidate guard state before navigating forward.
   */
  onRefresh?: () => Promise<void>;
}

/**
 * Renders the onboarding welcome screen where new users connect their TON wallet.
 * Handles TON Connect flow, persists wallet to the backend, and advances the
 * onboarding process to the buddy step on success.
 */
export function WelcomeScreen({ onRefresh }: WelcomeScreenProps) {
  const router = useRouter();
  const t = useTranslations('onboarding.welcome');
  const {
    isConnecting,
    connectionError,
    connectWallet,
    address,
    friendlyAddress,
  } = useTonWalletContext();
  const { authenticatedFetch } = useAuth();

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSavingWallet, setIsSavingWallet] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const processedAddressRef = useRef<string | null>(null);

  const connectionStatusMessage = useMemo(() => {
    if (friendlyAddress) {
      return t('status.connectedDetailed', { address: friendlyAddress });
    }
    if (address) {
      return t('status.connected');
    }
    return t('status.disconnected');
  }, [address, friendlyAddress, t]);

  async function handleConnectClick() {
    setSubmitError(null);
    try {
      await connectWallet();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('errors.connectStart');
      setSubmitError(message);
    }
  }

  useEffect(() => {
    if (!address || processedAddressRef.current === address) {
      return;
    }

    let cancelled = false;
    processedAddressRef.current = address;

    async function persistWallet() {
      setSubmitError(null);
      setIsSavingWallet(true);

      try {
        const response = await authenticatedFetch('/api/wallet/connect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ walletAddress: address }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          const message =
            payload && typeof payload === 'object' && 'error' in payload
              ? String(payload.error)
              : t('errors.persist');
          throw new Error(message);
        }

        setShowSuccess(true);

        if (onRefresh) {
          await onRefresh();
        }

        if (!cancelled) {
          router.replace('/onboarding/buddy');
        }
      } catch (error) {
        processedAddressRef.current = null;

        if (cancelled) {
          return;
        }

        const message =
          error instanceof Error ? error.message : t('errors.generic');
        setSubmitError(message);
      } finally {
        if (!cancelled) {
          setIsSavingWallet(false);
        }
      }
    }

    void persistWallet();

    return () => {
      cancelled = true;
    };
  }, [address, authenticatedFetch, onRefresh, router, t]);

  const isProcessing = isConnecting || isSavingWallet;
  const errorMessage = submitError || connectionError;

  return (
    <OnboardingLayout title={t('title')} description={t('description')}>
      <div className="flex flex-col gap-4">
        <Button
          size="l"
          mode="filled"
          onClick={() => void handleConnectClick()}
          disabled={isProcessing}
          className="min-h-[44px] touch-manipulation"
          aria-busy={isProcessing}
        >
          {isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner size="s" />
              {t('button.connecting')}
            </span>
          ) : (
            t('button.connect')
          )}
        </Button>

        <Caption
          level="2"
          className="text-[var(--tg-theme-hint-color)]"
          aria-live="polite"
          role="status"
        >
          {connectionStatusMessage}
        </Caption>

        {errorMessage ? (
          <Caption
            level="2"
            className="text-[var(--tg-theme-destructive-text-color)]"
          >
            {errorMessage}
          </Caption>
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-[var(--tg-theme-secondary-bg-color)]/60 bg-[var(--tg-theme-secondary-bg-color)]">
          <List>
            <Cell multiline>{t('list.link')}</Cell>
            <Cell multiline>{t('list.requirement')}</Cell>
          </List>
        </div>
      </div>

      {showSuccess ? (
        <Snackbar
          duration={1500}
          onClose={() => setShowSuccess(false)}
          className="mt-2"
        >
          {t('snackbar.success')}
        </Snackbar>
      ) : null}
    </OnboardingLayout>
  );
}

export default WelcomeScreen;
