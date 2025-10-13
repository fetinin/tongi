'use client';

import {
  Section,
  Placeholder,
  Button,
  Cell,
  Snackbar,
} from '@telegram-apps/telegram-ui';
import { useTonWalletContext } from './TonProvider';
import { useState, useEffect } from 'react';
import { retrieveLaunchParams } from '@telegram-apps/sdk-react';

export function WalletSettings() {
  const {
    isConnected,
    friendlyAddress,
    isConnecting,
    connectWallet,
    disconnectWallet,
    connectionError,
  } = useTonWalletContext();

  const [isPersisting, setIsPersisting] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [showSuccessSnackbar, setShowSuccessSnackbar] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  // Get Telegram initData for API calls
  const getInitData = () => {
    try {
      const { initDataRaw } = retrieveLaunchParams();
      return initDataRaw || '';
    } catch {
      return '';
    }
  };

  // Handle wallet connection
  const handleConnect = async () => {
    try {
      setPersistError(null);
      await connectWallet();

      // After TON Connect succeeds, persist to database
      // Note: friendlyAddress will be updated after connectWallet() completes
    } catch (error) {
      console.error('Connection error:', error);
    }
  };

  // Persist wallet address to database after TON Connect succeeds
  useEffect(() => {
    const persistWalletAddress = async () => {
      if (!isConnected || !friendlyAddress || isPersisting) {
        return;
      }

      setIsPersisting(true);
      setPersistError(null);

      try {
        const initData = getInitData();
        const response = await fetch('/api/wallet/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: friendlyAddress,
            initData,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to persist wallet address');
        }

        setShowSuccessSnackbar(true);
        setTimeout(() => setShowSuccessSnackbar(false), 3000);
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to save wallet address';
        setPersistError(errorMessage);
        console.error('Persist error:', error);
      } finally {
        setIsPersisting(false);
      }
    };

    persistWalletAddress();
  }, [isConnected, friendlyAddress, isPersisting]);

  // Handle disconnect
  const handleDisconnect = () => {
    setShowDisconnectConfirm(true);
  };

  const confirmDisconnect = async () => {
    try {
      setPersistError(null);
      await disconnectWallet();
      setShowDisconnectConfirm(false);
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  };

  // Show connection error
  if (connectionError) {
    return (
      <Section header="Wallet Connection">
        <Placeholder header="Connection Error" description={connectionError}>
          <Button size="m" onClick={handleConnect} disabled={isConnecting}>
            Try Again
          </Button>
        </Placeholder>
      </Section>
    );
  }

  // Show persist error
  if (persistError) {
    return (
      <Section header="Wallet Connection">
        <Placeholder header="Failed to Save" description={persistError}>
          <Button size="m" onClick={handleConnect}>
            Retry
          </Button>
        </Placeholder>
      </Section>
    );
  }

  // Show disconnect confirmation
  if (showDisconnectConfirm) {
    return (
      <Section header="Confirm Disconnection">
        <Placeholder
          header="Disconnect Wallet?"
          description="Your wallet will be removed from your account. You can reconnect anytime."
        >
          <Button size="m" mode="filled" onClick={confirmDisconnect}>
            Yes, Disconnect
          </Button>
          <Button
            size="m"
            mode="plain"
            onClick={() => setShowDisconnectConfirm(false)}
          >
            Cancel
          </Button>
        </Placeholder>
      </Section>
    );
  }

  // Show not connected state
  if (!isConnected) {
    return (
      <Section header="TON Wallet">
        <Placeholder
          header="No Wallet Connected"
          description="Connect your TON wallet to receive Corgi coin rewards"
        >
          <Button
            size="m"
            onClick={handleConnect}
            disabled={isConnecting || isPersisting}
          >
            {isConnecting || isPersisting ? 'Connecting...' : 'Connect Wallet'}
          </Button>
        </Placeholder>
      </Section>
    );
  }

  // Show connected state
  return (
    <>
      <Section header="TON Wallet">
        <Cell
          subtitle={
            friendlyAddress
              ? `${friendlyAddress.slice(0, 8)}...${friendlyAddress.slice(-8)}`
              : 'Loading...'
          }
          after={
            <Button size="s" mode="plain" onClick={handleDisconnect}>
              Disconnect
            </Button>
          }
        >
          Connected
        </Cell>
      </Section>

      {showSuccessSnackbar && (
        <Snackbar duration={3000} onClose={() => setShowSuccessSnackbar(false)}>
          Wallet connected successfully!
        </Snackbar>
      )}
    </>
  );
}
