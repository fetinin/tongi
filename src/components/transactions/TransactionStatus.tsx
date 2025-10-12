'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Section,
  Cell,
  Button,
  Badge,
  Placeholder,
  Spinner,
  Caption,
} from '@telegram-apps/telegram-ui';
import { useAuth } from '@/components/Auth/AuthProvider';

// Types for transaction status
interface TransactionData {
  id: number;
  transactionHash: string | null;
  fromWallet: string;
  toWallet: string;
  amount: number;
  transactionType: 'reward' | 'purchase';
  relatedEntityId: number | null;
  relatedEntityType: string | null;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  completedAt: string | null;
}

interface ErrorResponse {
  error: string;
  message: string;
}

interface TransactionStatusProps {
  /** Transaction ID to fetch and display */
  transactionId?: number;
  /** Pre-loaded transaction data */
  transaction?: TransactionData;
  /** Callback when transaction status changes */
  onStatusChange?: (transaction: TransactionData) => void;
  /** Auto-refresh pending transactions (default: true) */
  autoRefresh?: boolean;
  /** Refresh interval in milliseconds (default: 5000) */
  refreshInterval?: number;
  /** Show action buttons (refresh, retry) (default: true) */
  showActions?: boolean;
  /** Show detailed transaction information (default: true) */
  showDetails?: boolean;
  /** Compact display mode (default: false) */
  compact?: boolean;
}

export function TransactionStatus({
  transactionId,
  transaction: initialTransaction,
  onStatusChange,
  autoRefresh = true,
  refreshInterval = 5000,
  showActions = true,
  showDetails = true,
  compact = false,
}: TransactionStatusProps) {
  const { isAuthenticated, user, authenticatedFetch } = useAuth();
  const [transaction, setTransaction] = useState<TransactionData | null>(
    initialTransaction || null
  );
  const [isLoading, setIsLoading] = useState(!initialTransaction);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Fetch transaction data by ID
  const fetchTransactionById = useCallback(
    async (id: number) => {
      if (!isAuthenticated) {
        setError('Authentication required');
        setIsLoading(false);
        return;
      }

      try {
        const response = await authenticatedFetch(`/api/transactions`);

        if (!response.ok) {
          const errorData: ErrorResponse = await response.json();
          throw new Error(errorData.message || 'Failed to fetch transactions');
        }

        const data = await response.json();
        const foundTransaction = data.transactions.find(
          (t: TransactionData) => t.id === id
        );

        if (!foundTransaction) {
          throw new Error(`Transaction with ID ${id} not found`);
        }

        return foundTransaction;
      } catch (err) {
        console.error('Transaction fetch error:', err);
        throw err;
      }
    },
    [isAuthenticated, authenticatedFetch]
  );

  // Load transaction data
  const loadTransaction = useCallback(async () => {
    if (initialTransaction) {
      setTransaction(initialTransaction);
      setIsLoading(false);
      return;
    }

    if (!transactionId) {
      setError('Transaction ID or transaction data required');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const fetchedTransaction = await fetchTransactionById(transactionId);
      setTransaction(fetchedTransaction);
      setLastRefresh(new Date());

      // Notify parent component of status change
      onStatusChange?.(fetchedTransaction);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load transaction'
      );
    } finally {
      setIsLoading(false);
    }
  }, [transactionId, initialTransaction, fetchTransactionById, onStatusChange]);

  // Auto-refresh for pending transactions
  useEffect(() => {
    if (!autoRefresh || !transaction || transaction.status !== 'pending') {
      return;
    }

    const interval = setInterval(() => {
      loadTransaction();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [transaction, autoRefresh, refreshInterval, loadTransaction]);

  // Initial load
  useEffect(() => {
    loadTransaction();
  }, [loadTransaction]);

  /**
   * Get status badge configuration based on transaction status
   */
  const getStatusBadge = (status: TransactionData['status']) => {
    switch (status) {
      case 'pending':
        return { type: 'number' as const, children: 'Pending' };
      case 'completed':
        return { type: 'dot' as const, children: 'Completed' };
      case 'failed':
        return { type: 'number' as const, children: 'Failed' };
      default:
        return { type: 'number' as const, children: status };
    }
  };

  /**
   * Get status color for visual indicators
   */
  const getStatusColor = (status: TransactionData['status']): string => {
    switch (status) {
      case 'pending':
        return 'text-blue-600';
      case 'completed':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  /**
   * Get transaction icon based on type and direction
   */
  const getTransactionIcon = (transaction: TransactionData): string => {
    if (!user?.tonWalletAddress) return '💳';

    const isIncoming = transaction.toWallet === user.tonWalletAddress;

    if (transaction.transactionType === 'reward') {
      return isIncoming ? '🎁' : '💸';
    } else {
      return isIncoming ? '📥' : '📤';
    }
  };

  /**
   * Get transaction type label
   */
  const getTransactionTypeLabel = (
    type: TransactionData['transactionType']
  ): string => {
    switch (type) {
      case 'reward':
        return 'Corgi Reward';
      case 'purchase':
        return 'Wish Purchase';
      default:
        return type;
    }
  };

  /**
   * Format timestamp for display
   */
  const formatTimestamp = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffMinutes < 24 * 60) {
      const hours = Math.floor(diffMinutes / 60);
      return `${hours}h ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  /**
   * Format wallet address for display
   */
  const formatWalletAddress = (address: string): string => {
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  /**
   * Copy text to clipboard
   */
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Could show a toast notification here
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  /**
   * Get transaction direction
   */
  const getTransactionDirection = (
    transaction: TransactionData
  ): 'incoming' | 'outgoing' => {
    if (!user?.tonWalletAddress) return 'outgoing';
    return transaction.toWallet === user.tonWalletAddress
      ? 'incoming'
      : 'outgoing';
  };

  // Loading state
  if (isLoading) {
    return (
      <Section header="Transaction Status">
        <div className="flex justify-center items-center p-8">
          <Spinner size="m" />
          <span className="ml-3">Loading transaction status...</span>
        </div>
      </Section>
    );
  }

  // Error state
  if (error) {
    return (
      <Section header="Transaction Status">
        <div className="p-4">
          <Placeholder header="Error Loading Transaction" description={error}>
            {showActions && (
              <Button size="s" mode="outline" onClick={loadTransaction}>
                Retry
              </Button>
            )}
          </Placeholder>
        </div>
      </Section>
    );
  }

  // No transaction data
  if (!transaction) {
    return (
      <Section header="Transaction Status">
        <div className="p-4">
          <Placeholder
            header="No Transaction Data"
            description="Transaction information is not available"
          />
        </div>
      </Section>
    );
  }

  const statusBadge = getStatusBadge(transaction.status);
  const direction = getTransactionDirection(transaction);
  const isIncoming = direction === 'incoming';
  const statusColor = getStatusColor(transaction.status);

  // Compact mode
  if (compact) {
    return (
      <Cell
        subtitle={
          <div className="flex items-center gap-2">
            <Badge {...statusBadge} />
            <span className="text-xs text-gray-500">
              {formatTimestamp(transaction.createdAt)}
            </span>
          </div>
        }
        before={
          <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
            <span className="text-sm">{getTransactionIcon(transaction)}</span>
          </div>
        }
        after={
          <div
            className={`font-medium ${isIncoming ? 'text-green-600' : 'text-red-600'}`}
          >
            {isIncoming ? '+' : '-'}
            {transaction.amount.toFixed(2)}
          </div>
        }
      >
        <div>
          <strong>
            {getTransactionTypeLabel(transaction.transactionType)}
          </strong>
        </div>
      </Cell>
    );
  }

  return (
    <Section
      header="Transaction Status"
      footer={`Last updated: ${formatTimestamp(lastRefresh.toISOString())}`}
    >
      {/* Main Status Display */}
      <Cell
        subtitle={
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge {...statusBadge} />
              <span className={`font-medium ${statusColor}`}>
                {transaction.status.charAt(0).toUpperCase() +
                  transaction.status.slice(1)}
              </span>
              {transaction.status === 'pending' && autoRefresh && (
                <Spinner size="s" />
              )}
            </div>
            <div className="text-sm text-gray-600">
              {getTransactionTypeLabel(transaction.transactionType)} •{' '}
              {formatTimestamp(transaction.createdAt)}
            </div>
          </div>
        }
        before={
          <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full">
            <span className="text-xl">{getTransactionIcon(transaction)}</span>
          </div>
        }
        after={
          <div className="text-right">
            <div
              className={`text-lg font-bold ${isIncoming ? 'text-green-600' : 'text-red-600'}`}
            >
              {isIncoming ? '+' : '-'}
              {transaction.amount.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500">Corgi Coins</div>
          </div>
        }
      >
        <div>
          <strong>Transaction #{transaction.id}</strong>
        </div>
      </Cell>

      {/* Transaction Details */}
      {showDetails && (
        <>
          <Cell
            onClick={() => copyToClipboard(transaction.fromWallet)}
            subtitle="From Wallet"
          >
            {formatWalletAddress(transaction.fromWallet)}
          </Cell>

          <Cell
            onClick={() => copyToClipboard(transaction.toWallet)}
            subtitle="To Wallet"
          >
            {formatWalletAddress(transaction.toWallet)}
          </Cell>

          {transaction.transactionHash && (
            <Cell
              onClick={() => copyToClipboard(transaction.transactionHash!)}
              subtitle="Transaction Hash"
            >
              {formatWalletAddress(transaction.transactionHash)}
            </Cell>
          )}

          {transaction.completedAt && (
            <Cell subtitle="Completed">
              {formatTimestamp(transaction.completedAt)}
            </Cell>
          )}

          {transaction.relatedEntityType && transaction.relatedEntityId && (
            <Cell subtitle="Related Entity">
              {transaction.relatedEntityType.replace('_', ' ')} #
              {transaction.relatedEntityId}
            </Cell>
          )}
        </>
      )}

      {/* Action Buttons */}
      {showActions && (
        <div className="p-4 space-y-2">
          {transaction.status === 'pending' && (
            <Caption level="1" className="text-center text-gray-600 mb-2">
              {autoRefresh
                ? `Auto-refreshing every ${refreshInterval / 1000}s`
                : 'Transaction is being processed'}
            </Caption>
          )}

          <div className="flex gap-2">
            <Button
              size="s"
              mode="outline"
              onClick={loadTransaction}
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-1">
                  <Spinner size="s" />
                  Refreshing...
                </div>
              ) : (
                'Refresh Status'
              )}
            </Button>

            {transaction.transactionHash && (
              <Button
                size="s"
                mode="outline"
                onClick={() => copyToClipboard(transaction.transactionHash!)}
              >
                Copy Hash
              </Button>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}

/**
 * Hook to manage transaction status state and actions
 */
export function useTransactionStatus(transactionId?: number) {
  // TODO: Use transactionId to filter or fetch specific transaction data
  void transactionId; // Explicitly mark as unused until specific transaction tracking is implemented

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const toggleAutoRefresh = useCallback(() => {
    setAutoRefresh((prev) => !prev);
  }, []);

  const handleStatusChange = useCallback((transaction: TransactionData) => {
    console.log(
      `Transaction ${transaction.id} status updated to: ${transaction.status}`
    );

    // Auto-disable refresh for completed/failed transactions
    if (transaction.status === 'completed' || transaction.status === 'failed') {
      setAutoRefresh(false);
    }
  }, []);

  return {
    refreshTrigger,
    triggerRefresh,
    autoRefresh,
    toggleAutoRefresh,
    handleStatusChange,
  };
}

export default TransactionStatus;
