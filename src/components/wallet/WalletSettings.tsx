'use client';

import {
  Section,
  Placeholder,
  Button,
  Cell,
  Snackbar,
} from '@telegram-apps/telegram-ui';
import { useTonWalletContext } from './TonProvider';
import { useState } from 'react';

export function WalletSettings() {
  const {
    isConnected,
    friendlyAddress,
    isConnecting,
    connectWallet,
    disconnectWallet,
    connectionError,
  } = useTonWalletContext();

  const [showSuccessSnackbar, setShowSuccessSnackbar] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  // Handle wallet connection
  const handleConnect = async () => {
    try {
      await connectWallet();
      // AuthProvider automatically persists wallet address via onStatusChange listener
      setShowSuccessSnackbar(true);
      setTimeout(() => setShowSuccessSnackbar(false), 3000);
    } catch (error) {
      console.error('Connection error:', error);
    }
  };

  // Handle disconnect
  const handleDisconnect = () => {
    setShowDisconnectConfirm(true);
  };

  const confirmDisconnect = async () => {
    try {
      await disconnectWallet();
      // AuthProvider automatically clears wallet address via onStatusChange listener
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
          <Button size="m" onClick={handleConnect} disabled={isConnecting}>
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
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
