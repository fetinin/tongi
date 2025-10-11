'use client';

import {
  type PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  useTonAddress,
  useTonConnectUI,
  useTonWallet,
} from '@tonconnect/ui-react';
import { Cell, Section, Placeholder, Button } from '@telegram-apps/telegram-ui';
import { TON_CONFIG } from '@/lib/ton';

// TON Connect wallet state interface
interface TonWalletState {
  isConnected: boolean;
  address: string | null;
  friendlyAddress: string | null;
  isConnecting: boolean;
  connectionError: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  sendTransaction: (tx: {
    to: string;
    amount: string;
    payload?: string;
  }) => Promise<string>; // returns transaction BOC/hash
}

// Create context for TON wallet state
const TonWalletContext = createContext<TonWalletState | null>(null);

// Custom hook to use TON wallet context
export function useTonWalletContext(): TonWalletState {
  const context = useContext(TonWalletContext);
  if (!context) {
    throw new Error('useTonWalletContext must be used within TonProvider');
  }
  return context;
}

interface TonProviderProps extends PropsWithChildren {
  className?: string;
}

export function TonProvider({ children, className }: TonProviderProps) {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const userFriendlyAddress = useTonAddress();
  const rawAddress = useTonAddress(false);

  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Clear error when wallet state changes
  useEffect(() => {
    if (wallet) {
      setConnectionError(null);
    }
  }, [wallet]);

  // Connect wallet function
  const connectWallet = async () => {
    try {
      setIsConnecting(true);
      setConnectionError(null);
      await tonConnectUI.connectWallet();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to connect wallet';
      setConnectionError(errorMessage);
      console.error('TON Connect error:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect wallet function
  const disconnectWallet = async () => {
    try {
      setConnectionError(null);
      await tonConnectUI.disconnect();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to disconnect wallet';
      setConnectionError(errorMessage);
      console.error('TON Disconnect error:', error);
    }
  };

  // Send TON transaction via TON Connect
  const sendTransaction: TonWalletState['sendTransaction'] = async (tx) => {
    if (!wallet) {
      throw new Error('Wallet not connected');
    }

    const request = {
      validUntil:
        Math.floor(Date.now() / 1000) + TON_CONFIG.TRANSACTION_VALIDITY_SECONDS,
      messages: [
        {
          address: tx.to,
          amount: tx.amount,
          payload: tx.payload,
        },
      ],
    };

    const result = await tonConnectUI.sendTransaction(request);
    // TON Connect returns an object with BOC; use it as a transaction proof/hash surrogate
    // In production, you might resolve actual tx hash from a backend or explorer
     
    const boc = (result as unknown as { boc?: string }).boc;
    if (!boc) {
      throw new Error('Failed to obtain transaction BOC');
    }
    return boc;
  };

  // Wallet state object
  const walletState: TonWalletState = {
    isConnected: !!wallet,
    address: rawAddress,
    friendlyAddress: userFriendlyAddress,
    isConnecting,
    connectionError,
    connectWallet,
    disconnectWallet,
    sendTransaction,
  };

  return (
    <TonWalletContext.Provider value={walletState}>
      <div className={className}>{children}</div>
    </TonWalletContext.Provider>
  );
}

// Wallet connection status component using telegram-ui
interface WalletStatusProps {
  showActions?: boolean;
}

export function WalletStatus({ showActions = true }: WalletStatusProps) {
  const {
    isConnected,
    friendlyAddress,
    isConnecting,
    connectionError,
    connectWallet,
    disconnectWallet,
  } = useTonWalletContext();

  if (connectionError) {
    return (
      <Section header="Wallet Connection">
        <Placeholder header="Connection Error" description={connectionError}>
          {showActions && (
            <Button size="s" onClick={connectWallet} disabled={isConnecting}>
              {isConnecting ? 'Connecting...' : 'Try Again'}
            </Button>
          )}
        </Placeholder>
      </Section>
    );
  }

  if (!isConnected) {
    return (
      <Section header="TON Wallet">
        <Placeholder
          header="Wallet Not Connected"
          description="Connect your TON wallet to use Corgi coins and purchase wishes"
        >
          {showActions && (
            <Button size="s" onClick={connectWallet} disabled={isConnecting}>
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </Button>
          )}
        </Placeholder>
      </Section>
    );
  }

  return (
    <Section header="TON Wallet">
      <Cell
        subtitle={
          friendlyAddress
            ? `${friendlyAddress.slice(0, 8)}...${friendlyAddress.slice(-8)}`
            : 'Loading...'
        }
        after={
          showActions && (
            <Button size="s" mode="plain" onClick={disconnectWallet}>
              Disconnect
            </Button>
          )
        }
      >
        Connected
      </Cell>
    </Section>
  );
}

// Wallet connection button component
interface WalletButtonProps {
  variant?: 'primary' | 'secondary';
  size?: 's' | 'm' | 'l';
  disabled?: boolean;
}

export function WalletButton({
  variant = 'primary',
  size = 'm',
  disabled,
}: WalletButtonProps) {
  const { isConnected, isConnecting, connectWallet, disconnectWallet } =
    useTonWalletContext();

  const handleClick = isConnected ? disconnectWallet : connectWallet;
  const buttonText = isConnecting
    ? 'Connecting...'
    : isConnected
      ? 'Disconnect Wallet'
      : 'Connect Wallet';

  return (
    <Button
      size={size}
      mode={variant === 'primary' ? 'filled' : 'plain'}
      onClick={handleClick}
      disabled={disabled || isConnecting}
    >
      {buttonText}
    </Button>
  );
}
