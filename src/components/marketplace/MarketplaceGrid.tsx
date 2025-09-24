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

// Types for marketplace wish data
interface MarketplaceWishData {
  id: number;
  creatorId: number;
  buddyId: number;
  description: string;
  proposedAmount: number;
  status: string;
  createdAt: string;
  acceptedAt: string | null;
  purchasedAt: string | null;
  purchasedBy: number | null;
  creator: {
    id: number;
    firstName: string;
    createdAt: string;
  };
  timeRemaining: string;
}

interface MarketplaceResponse {
  wishes: MarketplaceWishData[];
  total: number;
  hasMore: boolean;
}

interface ErrorResponse {
  error: string;
  message: string;
}

interface MarketplaceGridProps {
  /** Callback when a wish is selected for purchase */
  onWishSelect?: (wish: MarketplaceWishData) => void;
  /** Auto-refresh interval in milliseconds (default: 30000) */
  refreshInterval?: number;
  /** Whether to show empty state */
  showEmptyState?: boolean;
  /** Number of wishes to load per page (default: 20) */
  pageSize?: number;
  /** Callback when marketplace is refreshed */
  onRefresh?: () => void;
  /** Custom empty state message */
  emptyMessage?: string;
}

export function MarketplaceGrid({
  onWishSelect,
  refreshInterval = 30000,
  showEmptyState = true,
  pageSize = 20,
  onRefresh,
  emptyMessage
}: MarketplaceGridProps) {
  const { token, isAuthenticated } = useAuth();
  const [wishes, setWishes] = useState<MarketplaceWishData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);

  // Fetch marketplace wishes from API
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

      const response = await fetch(`/api/marketplace?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData: ErrorResponse = await response.json();
        throw new Error(errorData.message || 'Failed to fetch marketplace wishes');
      }

      const data: MarketplaceResponse = await response.json();

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
      console.error('Marketplace fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load marketplace wishes');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [isAuthenticated, token, pageSize, offset, onRefresh]);

  // Initial load and refresh setup
  useEffect(() => {
    fetchWishes();

    // Set up auto-refresh interval if enabled
    if (refreshInterval > 0) {
      const interval = setInterval(() => fetchWishes(), refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchWishes, refreshInterval]); // Dependencies for fetchWishes and refreshInterval

  // Load more wishes (pagination)
  const loadMoreWishes = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      fetchWishes(true);
    }
  }, [fetchWishes, isLoadingMore, hasMore]);

  /**
   * Handle wish selection for purchase
   */
  const handleWishSelect = useCallback((wish: MarketplaceWishData) => {
    onWishSelect?.(wish);
  }, [onWishSelect]);

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
  const truncateDescription = (description: string, maxLength: number = 100): string => {
    if (description.length <= maxLength) {
      return description;
    }
    return description.slice(0, maxLength) + '...';
  };

  /**
   * Get wish category icon based on content
   */
  const getWishIcon = (description: string): string => {
    const lowerDesc = description.toLowerCase();
    if (lowerDesc.includes('dog') || lowerDesc.includes('walk')) return '🐕';
    if (lowerDesc.includes('food') || lowerDesc.includes('cook')) return '🍽️';
    if (lowerDesc.includes('help') || lowerDesc.includes('assist')) return '🤝';
    if (lowerDesc.includes('clean') || lowerDesc.includes('tidy')) return '🧹';
    if (lowerDesc.includes('shop') || lowerDesc.includes('buy')) return '🛒';
    if (lowerDesc.includes('drive') || lowerDesc.includes('ride')) return '🚗';
    return '💝';
  };

  if (!isAuthenticated) {
    return (
      <Placeholder
        header="Authentication Required"
        description="Please log in to browse the marketplace"
      />
    );
  }

  if (isLoading) {
    return (
      <Section header="Marketplace">
        <div className="flex justify-center items-center p-8">
          <Spinner size="m" />
          <span className="ml-3">Loading marketplace wishes...</span>
        </div>
      </Section>
    );
  }

  if (error) {
    return (
      <Section header="Marketplace">
        <div className="p-4">
          <Placeholder
            header="Error Loading Marketplace"
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

    const defaultEmptyMessage = "No wishes are currently available for purchase. Check back later to see new wishes from the community!";

    return (
      <Section header="Marketplace">
        <div className="p-4">
          <Placeholder
            header="No Wishes Available"
            description={emptyMessage || defaultEmptyMessage}
          >
            <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full">
              <span className="text-2xl">🏪</span>
            </div>
          </Placeholder>
        </div>
      </Section>
    );
  }

  // Grid of marketplace wishes
  return (
    <List>
      <Section
        header="Marketplace"
        footer={`${total} wish${total !== 1 ? 'es' : ''} available for purchase`}
      >
        {wishes.map((wish) => {
          const wishIcon = getWishIcon(wish.description);

          return (
            <Cell
              key={wish.id}
              subtitle={
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-gray-600">
                    By {wish.creator.firstName} • {formatTimestamp(wish.acceptedAt!)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {wish.timeRemaining}
                  </span>
                </div>
              }
              before={
                <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full">
                  <span className="text-xl">{wishIcon}</span>
                </div>
              }
              after={
                <div className="flex flex-col items-end gap-1">
                  <Badge type="dot" className="text-green-600">
                    Available
                  </Badge>
                  <Text weight="3" className="text-lg text-blue-600">
                    {formatAmount(wish.proposedAmount)} ⭐
                  </Text>
                </div>
              }
              onClick={() => handleWishSelect(wish)}
              style={{ cursor: 'pointer' }}
            >
              <div className="flex flex-col gap-2">
                <div>
                  <Text weight="3" className="text-base">
                    {truncateDescription(wish.description)}
                  </Text>
                </div>

                <div className="flex items-center justify-between">
                  <Caption level="1" className="text-gray-600">
                    Corgi coins required
                  </Caption>

                  <Button
                    size="s"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleWishSelect(wish);
                    }}
                  >
                    Purchase
                  </Button>
                </div>
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
          Browse wishes that have been accepted by their creators&apos; buddies. Purchase any wish to help someone and support the Corgi Buddy community!
        </Caption>
      </Section>
    </List>
  );
}

/**
 * Hook to manage marketplace grid state and actions
 */
export function useMarketplaceGrid() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedWish, setSelectedWish] = useState<MarketplaceWishData | null>(null);

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const handleRefresh = useCallback(() => {
    console.log('Marketplace refreshed');
  }, []);

  const handleWishSelect = useCallback((wish: MarketplaceWishData) => {
    setSelectedWish(wish);
  }, []);

  const clearSelectedWish = useCallback(() => {
    setSelectedWish(null);
  }, []);

  return {
    refreshTrigger,
    triggerRefresh,
    handleRefresh,
    selectedWish,
    handleWishSelect,
    clearSelectedWish,
  };
}

export default MarketplaceGrid;