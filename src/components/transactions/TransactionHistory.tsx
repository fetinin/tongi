'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  List,
  Section,
  Cell,
  Button,
  Badge,
  Placeholder,
  Spinner,
  Caption
} from '@telegram-apps/telegram-ui';
import { useAuth } from '@/components/Auth/AuthProvider';

// Types for transaction history
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

interface TransactionHistoryResponse {
  transactions: TransactionData[];
}

interface ErrorResponse {
  error: string;
  message: string;
}

type TransactionTypeFilter = 'all' | 'reward' | 'purchase';

interface TransactionHistoryProps {
  /** Callback when transaction history is updated */
  onHistoryUpdated?: (transactions: TransactionData[]) => void;
  /** Auto-refresh interval in milliseconds (default: 30000) */
  refreshInterval?: number;
  /** Whether to show empty state */
  showEmptyState?: boolean;
  /** Maximum number of transactions to display */
  limit?: number;
  /** Initial transaction type filter */
  initialFilter?: TransactionTypeFilter;
}

export function TransactionHistory({
  onHistoryUpdated,
  refreshInterval = 30000,
  showEmptyState = true,
  limit = 20,
  initialFilter = 'all'
}: TransactionHistoryProps) {
  const { token, isAuthenticated, user } = useAuth();
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<TransactionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>(initialFilter);

  // Fetch transaction history from API
  const fetchTransactionHistory = useCallback(async () => {
    if (!isAuthenticated || !token) {
      setError('Authentication required');
      setIsLoading(false);
      return;
    }

    try {
      const url = new URL('/api/transactions', window.location.origin);
      if (limit) {
        url.searchParams.set('limit', limit.toString());
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData: ErrorResponse = await response.json();
        throw new Error(errorData.message || 'Failed to fetch transaction history');
      }

      const data: TransactionHistoryResponse = await response.json();
      setTransactions(data.transactions);
      setError(null);

      // Notify parent component
      onHistoryUpdated?.(data.transactions);
    } catch (err) {
      console.error('Transaction history fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load transaction history');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, token, limit, onHistoryUpdated]);

  // Initial load and refresh setup
  useEffect(() => {
    fetchTransactionHistory();

    // Set up auto-refresh interval
    const interval = setInterval(fetchTransactionHistory, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchTransactionHistory, refreshInterval]);

  // Filter transactions based on type
  useEffect(() => {
    if (typeFilter === 'all') {
      setFilteredTransactions(transactions);
    } else {
      setFilteredTransactions(transactions.filter(transaction => transaction.transactionType === typeFilter));
    }
  }, [transactions, typeFilter]);

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
      const days = Math.floor(diffMinutes / (24 * 60));
      if (days === 1) {
        return 'Yesterday';
      } else if (days < 7) {
        return `${days} days ago`;
      } else {
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
      }
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
   * Get status badge props based on transaction status
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
   * Get transaction type label
   */
  const getTransactionTypeLabel = (type: TransactionData['transactionType']): string => {
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
   * Get transaction direction label
   */
  const getTransactionDirection = (transaction: TransactionData): 'incoming' | 'outgoing' => {
    if (!user?.tonWalletAddress) return 'outgoing';
    return transaction.toWallet === user.tonWalletAddress ? 'incoming' : 'outgoing';
  };

  /**
   * Format wallet address for display
   */
  const formatWalletAddress = (address: string): string => {
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  /**
   * Calculate statistics from transactions
   */
  const getStatistics = () => {
    const completedTransactions = transactions.filter(t => t.status === 'completed');
    const pendingTransactions = transactions.filter(t => t.status === 'pending');
    const failedTransactions = transactions.filter(t => t.status === 'failed');

    const rewardTransactions = completedTransactions.filter(t => t.transactionType === 'reward');
    const purchaseTransactions = completedTransactions.filter(t => t.transactionType === 'purchase');

    const totalRewards = rewardTransactions.reduce((total, transaction) => {
      const direction = getTransactionDirection(transaction);
      return total + (direction === 'incoming' ? transaction.amount : 0);
    }, 0);

    const totalSpent = purchaseTransactions.reduce((total, transaction) => {
      const direction = getTransactionDirection(transaction);
      return total + (direction === 'outgoing' ? transaction.amount : 0);
    }, 0);

    return {
      total: transactions.length,
      completed: completedTransactions.length,
      pending: pendingTransactions.length,
      failed: failedTransactions.length,
      rewards: rewardTransactions.length,
      purchases: purchaseTransactions.length,
      totalRewards,
      totalSpent
    };
  };

  if (!isAuthenticated) {
    return (
      <Placeholder
        header="Authentication Required"
        description="Please log in to view your transaction history"
      />
    );
  }

  if (isLoading) {
    return (
      <Section header="Transaction History">
        <div className="flex justify-center items-center p-8">
          <Spinner size="m" />
          <span className="ml-3">Loading transaction history...</span>
        </div>
      </Section>
    );
  }

  if (error) {
    return (
      <Section header="Transaction History">
        <div className="p-4">
          <Placeholder
            header="Error Loading History"
            description={error}
          >
            <Button
              size="s"
              mode="outline"
              onClick={fetchTransactionHistory}
            >
              Retry
            </Button>
          </Placeholder>
        </div>
      </Section>
    );
  }

  const stats = getStatistics();

  // Empty state
  if (transactions.length === 0) {
    if (!showEmptyState) {
      return null;
    }

    return (
      <Section header="Transaction History">
        <div className="p-4">
          <Placeholder
            header="No Transactions Yet"
            description="You haven't made any transactions yet. Start earning Corgi coins or making wish purchases!"
          >
            <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full">
              <span className="text-2xl">💳</span>
            </div>
          </Placeholder>
        </div>
      </Section>
    );
  }

  return (
    <List>
      {/* Statistics Section */}
      <Section header="Your Activity">
        <div className="p-4 space-y-2">
          <div className="flex justify-between items-center">
            <Caption level="1" className="text-gray-600">Total Transactions</Caption>
            <span className="font-medium">{stats.total}</span>
          </div>
          <div className="flex justify-between items-center">
            <Caption level="1" className="text-gray-600">Corgi Coins Earned</Caption>
            <span className="font-medium text-green-600">+{stats.totalRewards.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <Caption level="1" className="text-gray-600">Corgi Coins Spent</Caption>
            <span className="font-medium text-red-600">-{stats.totalSpent.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">Completed: {stats.completed}</span>
            <span className="text-gray-500">Pending: {stats.pending}</span>
            <span className="text-gray-500">Failed: {stats.failed}</span>
          </div>
        </div>
      </Section>

      {/* Filter Section */}
      <Section header="Filter by Type">
        <div className="p-4 flex gap-2">
          <Button
            size="s"
            mode={typeFilter === 'all' ? 'filled' : 'outline'}
            onClick={() => setTypeFilter('all')}
          >
            All ({stats.total})
          </Button>
          <Button
            size="s"
            mode={typeFilter === 'reward' ? 'filled' : 'outline'}
            onClick={() => setTypeFilter('reward')}
          >
            Rewards ({stats.rewards})
          </Button>
          <Button
            size="s"
            mode={typeFilter === 'purchase' ? 'filled' : 'outline'}
            onClick={() => setTypeFilter('purchase')}
          >
            Purchases ({stats.purchases})
          </Button>
        </div>
      </Section>

      {/* Transactions List */}
      <Section
        header="Your Transactions"
        footer={`${filteredTransactions.length} transaction${filteredTransactions.length !== 1 ? 's' : ''} ${typeFilter !== 'all' ? `of type: ${typeFilter}` : 'total'}`}
      >
        {filteredTransactions.length === 0 ? (
          <div className="p-4">
            <Placeholder
              header={`No ${typeFilter === 'all' ? '' : typeFilter} Transactions`}
              description={`You don't have any ${typeFilter === 'all' ? '' : typeFilter + ' '}transactions to display.`}
            >
              <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full">
                <span className="text-lg">🔍</span>
              </div>
            </Placeholder>
          </div>
        ) : (
          filteredTransactions.map((transaction) => {
            const statusBadge = getStatusBadge(transaction.status);
            const isCompleted = transaction.status === 'completed';
            const direction = getTransactionDirection(transaction);
            const isIncoming = direction === 'incoming';

            return (
              <Cell
                key={transaction.id}
                subtitle={
                  <div className="space-y-1">
                    <div>
                      {isIncoming ? 'From' : 'To'}: {formatWalletAddress(isIncoming ? transaction.fromWallet : transaction.toWallet)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatTimestamp(transaction.createdAt)}
                      {transaction.completedAt && ` • Completed ${formatTimestamp(transaction.completedAt)}`}
                    </div>
                    {transaction.transactionHash && (
                      <div className="text-xs text-gray-400">
                        Hash: {formatWalletAddress(transaction.transactionHash)}
                      </div>
                    )}
                  </div>
                }
                before={
                  <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
                    <span className="text-lg">{getTransactionIcon(transaction)}</span>
                  </div>
                }
                after={
                  <div className="text-right">
                    <div className={`font-medium ${isIncoming ? 'text-green-600' : 'text-red-600'}`}>
                      {isIncoming ? '+' : '-'}{transaction.amount.toFixed(2)}
                    </div>
                    <Badge {...statusBadge} />
                  </div>
                }
              >
                <div className="flex flex-col gap-1">
                  <div>
                    <strong>{getTransactionTypeLabel(transaction.transactionType)}</strong>
                  </div>
                  {transaction.status === 'pending' && (
                    <div className="text-sm text-gray-500">
                      Transaction is being processed
                    </div>
                  )}
                  {transaction.status === 'failed' && (
                    <div className="text-sm text-red-500">
                      Transaction failed
                    </div>
                  )}
                  {isCompleted && (
                    <div className="text-sm text-gray-600">
                      {isIncoming ? 'Received' : 'Sent'} {transaction.amount} Corgi Coin{transaction.amount !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </Cell>
            );
          })
        )}
      </Section>

      {/* Information Section */}
      <Section>
        <Caption level="1" className="px-4 py-2 text-gray-600">
          Your transaction history shows all Corgi coin transfers. Rewards come from confirmed corgi sightings, and purchases are for wishes from the marketplace.
        </Caption>
      </Section>
    </List>
  );
}

/**
 * Hook to manage transaction history state and actions
 */
export function useTransactionHistory() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [filter, setFilter] = useState<TransactionTypeFilter>('all');

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const setTypeFilter = useCallback((newFilter: TransactionTypeFilter) => {
    setFilter(newFilter);
  }, []);

  const handleHistoryUpdated = useCallback((transactions: TransactionData[]) => {
    console.log(`Loaded ${transactions.length} transactions from history`);
    // Could trigger notifications or other side effects here
  }, []);

  return {
    refreshTrigger,
    triggerRefresh,
    filter,
    setTypeFilter,
    handleHistoryUpdated,
  };
}

export default TransactionHistory;