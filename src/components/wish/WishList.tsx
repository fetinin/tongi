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
  Caption,
  Text
} from '@telegram-apps/telegram-ui';
import { useAuth } from '@/components/Auth/AuthProvider';

// Types for wish data
interface WishData {
  id: number;
  creatorId: number;
  buddyId: number;
  description: string;
  proposedAmount: number;
  status: 'pending' | 'accepted' | 'rejected' | 'purchased';
  createdAt: string;
  acceptedAt: string | null;
  purchasedAt: string | null;
  purchasedBy: number | null;
}

interface WishesListResponse {
  wishes: WishData[];
  total: number;
  hasMore: boolean;
}

interface ErrorResponse {
  error: string;
  message: string;
}

interface WishListProps {
  /** Filter wishes by status */
  statusFilter?: 'pending' | 'accepted' | 'rejected' | 'purchased';
  /** Auto-refresh interval in milliseconds (default: 30000) */
  refreshInterval?: number;
  /** Whether to show empty state */
  showEmptyState?: boolean;
  /** Number of wishes to load per page (default: 20) */
  pageSize?: number;
  /** Callback when wish list is refreshed */
  onRefresh?: () => void;
  /** Custom empty state message */
  emptyMessage?: string;
}

export function WishList({
  statusFilter,
  refreshInterval = 30000,
  showEmptyState = true,
  pageSize = 20,
  onRefresh,
  emptyMessage
}: WishListProps) {
  const { token, isAuthenticated } = useAuth();
  const [wishes, setWishes] = useState<WishData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);

  // Fetch wishes from API
  const fetchWishes = useCallback(async (loadMore: boolean = false) => {
    if (!isAuthenticated || !token) {
      setError('Authentication required');
      setIsLoading(false);
      return;
    }

    const currentOffset = loadMore ? offset : 0;
    if (loadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
      setWishes([]);
      setOffset(0);
    }

    try {
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: currentOffset.toString(),
      });

      if (statusFilter) {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/wishes?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData: ErrorResponse = await response.json();
        throw new Error(errorData.message || 'Failed to fetch wishes');
      }

      const data: WishesListResponse = await response.json();

      if (loadMore) {
        setWishes(prev => [...prev, ...data.wishes]);
        setOffset(prev => prev + pageSize);
      } else {
        setWishes(data.wishes);
        setOffset(pageSize);
      }

      setTotal(data.total);
      setHasMore(data.hasMore);
      setError(null);
      onRefresh?.();

    } catch (err) {
      console.error('Wishes fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load wishes');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [isAuthenticated, token, statusFilter, pageSize, offset, onRefresh]);

  // Initial load and refresh setup
  useEffect(() => {
    fetchWishes();

    // Set up auto-refresh interval if enabled
    if (refreshInterval > 0) {
      const interval = setInterval(() => fetchWishes(), refreshInterval);
      return () => clearInterval(interval);
    }
  }, [statusFilter]); // Re-fetch when status filter changes

  // Load more wishes (pagination)
  const loadMoreWishes = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      fetchWishes(true);
    }
  }, [fetchWishes, isLoadingMore, hasMore]);

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
        return '1 day ago';
      } else if (days < 30) {
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
   * Format amount for display
   */
  const formatAmount = (amount: number): string => {
    return amount.toFixed(2);
  };

  /**
   * Truncate description if too long
   */
  const truncateDescription = (description: string, maxLength: number = 120): string => {
    if (description.length <= maxLength) {
      return description;
    }
    return description.slice(0, maxLength) + '...';
  };

  /**
   * Get status badge configuration
   */
  const getStatusBadge = (status: WishData['status']) => {
    switch (status) {
      case 'pending':
        return { type: 'dot' as const, children: 'Pending', className: 'text-yellow-600' };
      case 'accepted':
        return { type: 'dot' as const, children: 'In Marketplace', className: 'text-green-600' };
      case 'rejected':
        return { type: 'dot' as const, children: 'Rejected', className: 'text-red-600' };
      case 'purchased':
        return { type: 'dot' as const, children: 'Purchased', className: 'text-blue-600' };
      default:
        return { type: 'dot' as const, children: status, className: 'text-gray-600' };
    }
  };

  /**
   * Get status icon
   */
  const getStatusIcon = (status: WishData['status']): string => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'accepted':
        return '🏪';
      case 'rejected':
        return '❌';
      case 'purchased':
        return '✅';
      default:
        return '💝';
    }
  };

  /**
   * Get section header based on filter
   */
  const getSectionHeader = (): string => {
    if (statusFilter) {
      const statusLabels = {
        pending: 'Pending Wishes',
        accepted: 'Wishes in Marketplace',
        rejected: 'Rejected Wishes',
        purchased: 'Purchased Wishes'
      };
      return statusLabels[statusFilter];
    }
    return 'My Wishes';
  };

  /**
   * Get section footer based on data
   */
  const getSectionFooter = (): string => {
    if (total === 0) return '';
    if (statusFilter) {
      return `${total} ${statusFilter} wish${total !== 1 ? 'es' : ''}`;
    }
    return `${total} wish${total !== 1 ? 'es' : ''} total`;
  };

  if (!isAuthenticated) {
    return (
      <Placeholder
        header="Authentication Required"
        description="Please log in to view your wishes"
      />
    );
  }

  if (isLoading) {
    return (
      <Section header={getSectionHeader()}>
        <div className="flex justify-center items-center p-8">
          <Spinner size="m" />
          <span className="ml-3">Loading your wishes...</span>
        </div>
      </Section>
    );
  }

  if (error) {
    return (
      <Section header={getSectionHeader()}>
        <div className="p-4">
          <Placeholder
            header="Error Loading Wishes"
            description={error}
          >
            <Button
              size="s"
              mode="outline"
              onClick={() => fetchWishes()}
            >
              Retry
            </Button>
          </Placeholder>
        </div>
      </Section>
    );
  }

  // Empty state
  if (wishes.length === 0) {
    if (!showEmptyState) {
      return null;
    }

    const defaultEmptyMessage = statusFilter
      ? `You don't have any ${statusFilter} wishes yet.`
      : "You haven't created any wishes yet. Create your first wish to get started!";

    return (
      <Section header={getSectionHeader()}>
        <div className="p-4">
          <Placeholder
            header="No Wishes Found"
            description={emptyMessage || defaultEmptyMessage}
          >
            <div className="flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full">
              <span className="text-2xl">💝</span>
            </div>
          </Placeholder>
        </div>
      </Section>
    );
  }

  // List of wishes
  return (
    <List>
      <Section
        header={getSectionHeader()}
        footer={getSectionFooter()}
      >
        {wishes.map((wish) => {
          const statusBadge = getStatusBadge(wish.status);
          const statusIcon = getStatusIcon(wish.status);

          return (
            <Cell
              key={wish.id}
              subtitle={`Created ${formatTimestamp(wish.createdAt)}`}
              before={
                <div className="flex items-center justify-center w-10 h-10 bg-purple-100 rounded-full">
                  <span className="text-lg">{statusIcon}</span>
                </div>
              }
              after={
                <Badge type={statusBadge.type} className={statusBadge.className}>
                  {statusBadge.children}
                </Badge>
              }
            >
              <div className="flex flex-col gap-2">
                <div>
                  <Text weight="3" className="text-sm">
                    {truncateDescription(wish.description)}
                  </Text>
                </div>

                <div>
                  <Caption level="1" className="text-gray-600">
                    Amount: {formatAmount(wish.proposedAmount)} Corgi coins
                  </Caption>
                </div>

                {/* Additional status information */}
                {wish.acceptedAt && (
                  <div>
                    <Caption level="1" className="text-green-600 text-xs">
                      Accepted {formatTimestamp(wish.acceptedAt)}
                    </Caption>
                  </div>
                )}

                {wish.purchasedAt && (
                  <div>
                    <Caption level="1" className="text-blue-600 text-xs">
                      Purchased {formatTimestamp(wish.purchasedAt)}
                    </Caption>
                  </div>
                )}
              </div>
            </Cell>
          );
        })}
      </Section>

      {/* Load More Button */}
      {hasMore && (
        <Section>
          <div className="p-4 flex justify-center">
            <Button
              size="m"
              mode="outline"
              onClick={loadMoreWishes}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? (
                <div className="flex items-center gap-2">
                  <Spinner size="s" />
                  Loading more...
                </div>
              ) : (
                `Load More (${total - wishes.length} remaining)`
              )}
            </Button>
          </div>
        </Section>
      )}

      {/* Information Section */}
      <Section>
        <Caption level="1" className="px-4 py-2 text-gray-600">
          {statusFilter === 'pending' && 'Pending wishes are waiting for your buddy\'s approval.'}
          {statusFilter === 'accepted' && 'These wishes are available for purchase in the marketplace.'}
          {statusFilter === 'rejected' && 'Your buddy rejected these wishes. You can create new ones.'}
          {statusFilter === 'purchased' && 'These wishes have been purchased and completed.'}
          {!statusFilter && 'Track all your wishes and their current status. Create new wishes to earn Corgi coins!'}
        </Caption>
      </Section>
    </List>
  );
}

/**
 * Hook to manage wish list state and actions
 */
export function useWishList(statusFilter?: WishData['status']) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const handleRefresh = useCallback(() => {
    console.log('Wish list refreshed');
    // Could trigger notifications or other side effects here
  }, []);

  return {
    refreshTrigger,
    triggerRefresh,
    handleRefresh,
    statusFilter,
  };
}

export default WishList;