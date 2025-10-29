/**
 * WelcomeScreen Component - First Onboarding Step
 *
 * Displays wallet connection prompt for new users.
 * Enforces wallet requirement before accessing rest of app.
 *
 * Based on specs/005-mobile-first-onboarding/tasks.md (T013, T017)
 */

'use client';

import {
  Section,
  Placeholder,
  Button,
  Snackbar,
} from '@telegram-apps/telegram-ui';
import { useTonWalletContext } from '@/components/wallet/TonProvider';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/Auth/AuthProvider';

export interface WelcomeScreenProps {
  /**
   * Optional callback when wallet connection is successful
   * (T017: Used to redirect to buddy screen)
   */
  onWalletConnected?: () => void;
}

export function WelcomeScreen({ onWalletConnected }: WelcomeScreenProps) {
  const { isConnected, isConnecting, connectWallet, connectionError } =
    useTonWalletContext();

  const router = useRouter();
  const { authenticatedFetch } = useAuth();
  const [showSuccessSnackbar, setShowSuccessSnackbar] = useState(false);
  const [showErrorSnackbar, setShowErrorSnackbar] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isRedirecting, setIsRedirecting] = useState(false);

  /**
   * Handle wallet connection
   * When successful, calls API to verify state, then redirects to buddy screen
   */
  const handleConnect = async () => {
    try {
      // Connect wallet via TON Connect UI
      await connectWallet();

      // TonProvider automatically calls the wallet persist API
      // Show success message
      setShowSuccessSnackbar(true);

      // Wait a moment for API to persist the wallet
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Redirect to buddy screen (onboarding step 2)
      setIsRedirecting(true);
      if (onWalletConnected) {
        onWalletConnected();
      } else {
        // Default redirect to buddy screen
        router.push('/onboarding/buddy');
      }
    } catch (error) {
      console.error('Wallet connection error:', error);
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to connect wallet'
      );
      setShowErrorSnackbar(true);
    }
  };

  // Auto-redirect if wallet is already connected
  useEffect(() => {
    if (isConnected && !isRedirecting) {
      setIsRedirecting(true);
      // Verify state and redirect
      const redirectToNextStep = async () => {
        try {
          const response = await authenticatedFetch('/api/onboarding/status');
          if (response.ok) {
            const data = await response.json();
            if (data.onboarding.current_step === 'buddy') {
              router.push('/onboarding/buddy');
            }
          }
        } catch (error) {
          console.error('Failed to redirect:', error);
          setIsRedirecting(false);
        }
      };
      redirectToNextStep();
    }
  }, [isConnected, isRedirecting, authenticatedFetch, router]);

  return (
    <Section>
      <Placeholder
        header="🐕 Welcome to Corgi Buddy"
        description="To get started, please connect your TON wallet. This is required to earn and trade Corgi coins."
      >
        <Button
          size="m"
          onClick={handleConnect}
          disabled={isConnecting || isRedirecting}
        >
          {isConnecting
            ? 'Connecting...'
            : isRedirecting
              ? 'Redirecting...'
              : 'Connect Wallet'}
        </Button>

        {connectionError && (
          <div className="mt-4 text-center text-red-500 text-sm">
            <p>{connectionError}</p>
          </div>
        )}

        <div className="mt-6 text-xs text-gray-500 text-center">
          <p>
            We use TON Connect to securely connect your wallet.
            <br />
            Your private keys stay safe in your wallet app.
          </p>
        </div>
      </Placeholder>

      {/* Success snackbar */}
      {showSuccessSnackbar && (
        <Snackbar duration={3000} onClose={() => setShowSuccessSnackbar(false)}>
          ✓ Wallet connected successfully!
        </Snackbar>
      )}

      {/* Error snackbar */}
      {showErrorSnackbar && (
        <Snackbar duration={5000} onClose={() => setShowErrorSnackbar(false)}>
          {errorMessage}
        </Snackbar>
      )}
    </Section>
  );
}
