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
  Text,
} from '@telegram-apps/telegram-ui';
import { useAuth } from '@/components/Auth/AuthProvider';

// Types for wish approval
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

interface PendingWishesResponse {
  wishes: WishData[];
}

interface ErrorResponse {
  error: string;
  message: string;
}

interface WishApprovalProps {
  /** Callback when a wish is processed */
  onWishProcessed?: (wishId: number, accepted: boolean) => void;
  /** Auto-refresh interval in milliseconds (default: 15000) */
  refreshInterval?: number;
  /** Whether to show empty state */
  showEmptyState?: boolean;
}

export function WishApproval({
  onWishProcessed,
  refreshInterval = 15000,
  showEmptyState = true,
}: WishApprovalProps) {
  const { isAuthenticated, authenticatedFetch } = useAuth();
  const [wishes, setWishes] = useState<WishData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());

  // Fetch pending wishes from API
  const fetchPendingWishes = useCallback(async () => {
    if (!isAuthenticated) {
      setError('Authentication required');
      setIsLoading(false);
      return;
    }

    try {
      const response = await authenticatedFetch('/api/wishes/pending');

      if (!response.ok) {
        const errorData: ErrorResponse = await response.json();
        throw new Error(errorData.message || 'Failed to fetch pending wishes');
      }

      const data: PendingWishesResponse = await response.json();
      setWishes(data.wishes);
      setError(null);
    } catch (err) {
      console.error('Pending wishes fetch error:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load pending wishes'
      );
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, authenticatedFetch]);

  // Initial load and refresh setup
  useEffect(() => {
    fetchPendingWishes();

    // Set up auto-refresh interval
    const interval = setInterval(fetchPendingWishes, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchPendingWishes, refreshInterval]);

  /**
   * Handle acceptance or rejection of a wish
   */
  const handleWishResponse = useCallback(
    async (wishId: number, accepted: boolean) => {
      if (!isAuthenticated) {
        setError('Authentication required');
        return;
      }

      // Mark as processing
      setProcessingIds((prev) => new Set(prev).add(wishId));

      try {
        const response = await authenticatedFetch(
          `/api/wishes/${wishId}/respond`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ accepted }),
          }
        );

        if (!response.ok) {
          const errorData: ErrorResponse = await response.json();
          throw new Error(
            errorData.message || 'Failed to process wish response'
          );
        }

        // Remove the accepted/rejected wish from the list
        setWishes((prev) => prev.filter((wish) => wish.id !== wishId));

        // Notify parent component
        onWishProcessed?.(wishId, accepted);
      } catch (err) {
        console.error('Wish response processing error:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to process wish response'
        );
      } finally {
        // Remove from processing
        setProcessingIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(wishId);
          return newSet;
        });
      }
    },
    [isAuthenticated, authenticatedFetch, onWishProcessed]
  );

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
   * Format amount for display
   */
  const formatAmount = (amount: number): string => {
    return amount.toFixed(2);
  };

  /**
   * Truncate description if too long
   */
  const truncateDescription = (
    description: string,
    maxLength: number = 100
  ): string => {
    if (description.length <= maxLength) {
      return description;
    }
    return description.slice(0, maxLength) + '...';
  };

  if (!isAuthenticated) {
    return (
      <Placeholder
        header="Authentication Required"
        description="Please log in to view pending wish approvals"
      />
    );
  }

  if (isLoading) {
    return (
      <Section header="Pending Wish Approvals">
        <div className="flex justify-center items-center p-8">
          <Spinner size="m" />
          <span className="ml-3">Loading pending wishes...</span>
        </div>
      </Section>
    );
  }

  if (error) {
    return (
      <Section header="Pending Wish Approvals">
        <div className="p-4">
          <Placeholder header="Error Loading Wishes" description={error}>
            <Button size="s" mode="outline" onClick={fetchPendingWishes}>
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

    return (
      <Section header="Pending Wish Approvals">
        <div className="p-4">
          <Placeholder
            header="No Pending Wishes"
            description="You don't have any wishes waiting for your approval. When your buddy creates wishes, they'll appear here for you to accept or reject."
          >
            <div className="flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full">
              <span className="text-2xl">💝</span>
            </div>
          </Placeholder>
        </div>
      </Section>
    );
  }

  // List of pending wishes
  return (
    <List>
      <Section
        header="Pending Wish Approvals"
        footer={`${wishes.length} wish${wishes.length !== 1 ? 'es' : ''} waiting for your approval`}
      >
        {wishes.map((wish) => {
          const isProcessing = processingIds.has(wish.id);

          return (
            <Cell
              key={wish.id}
              subtitle={`Created ${formatTimestamp(wish.createdAt)}`}
              before={
                <div className="flex items-center justify-center w-10 h-10 bg-purple-100 rounded-full">
                  <span className="text-lg">💝</span>
                </div>
              }
              after={<Badge type="dot">Pending</Badge>}
            >
              <div className="flex flex-col gap-2">
                <div>
                  <Text weight="3" className="text-sm">
                    {truncateDescription(wish.description)}
                  </Text>
                </div>

                <div>
                  <Caption level="1" className="text-gray-600">
                    Proposed amount: {formatAmount(wish.proposedAmount)} Corgi
                    coins
                  </Caption>
                </div>

                <div className="flex gap-2 mt-2">
                  <Button
                    size="s"
                    onClick={() => handleWishResponse(wish.id, true)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <div className="flex items-center gap-1">
                        <Spinner size="s" />
                        Processing...
                      </div>
                    ) : (
                      'Accept'
                    )}
                  </Button>

                  <Button
                    size="s"
                    mode="outline"
                    onClick={() => handleWishResponse(wish.id, false)}
                    disabled={isProcessing}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </Cell>
          );
        })}
      </Section>

      {/* Information Section */}
      <Section>
        <Caption level="1" className="px-4 py-2 text-gray-600">
          When you accept a wish, it will appear in the marketplace where anyone
          can purchase it. Only accept wishes you&apos;re comfortable with
          others seeing.
        </Caption>
      </Section>
    </List>
  );
}

/**
 * Hook to manage wish approval state and actions
 */
export function useWishApproval() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const handleWishProcessed = useCallback(
    (wishId: number, accepted: boolean) => {
      console.log(`Wish ${wishId} ${accepted ? 'accepted' : 'rejected'}`);
      // Could trigger notifications or other side effects here
    },
    []
  );

  return {
    refreshTrigger,
    triggerRefresh,
    handleWishProcessed,
  };
}

export default WishApproval;
