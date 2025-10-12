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
} from '@telegram-apps/telegram-ui';
import { useAuth } from '@/components/Auth/AuthProvider';

// Types for corgi sighting confirmation
interface CorgiSightingData {
  id: number;
  reporterId: number;
  buddyId: number;
  corgiCount: number;
  status: 'pending' | 'confirmed' | 'denied';
  createdAt: string;
  respondedAt: string | null;
}

interface ConfirmationsResponse {
  confirmations: CorgiSightingData[];
}

interface ErrorResponse {
  error: string;
  message: string;
}

interface ConfirmationListProps {
  /** Callback when a confirmation is processed */
  onConfirmationProcessed?: (sightingId: number, confirmed: boolean) => void;
  /** Auto-refresh interval in milliseconds (default: 15000) */
  refreshInterval?: number;
  /** Whether to show empty state */
  showEmptyState?: boolean;
}

export function ConfirmationList({
  onConfirmationProcessed,
  refreshInterval = 15000,
  showEmptyState = true,
}: ConfirmationListProps) {
  const { isAuthenticated, authenticatedFetch } = useAuth();
  const [confirmations, setConfirmations] = useState<CorgiSightingData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());

  // Fetch pending confirmations from API
  const fetchConfirmations = useCallback(async () => {
    if (!isAuthenticated) {
      setError('Authentication required');
      setIsLoading(false);
      return;
    }

    try {
      const response = await authenticatedFetch('/api/corgi/confirmations');

      if (!response.ok) {
        const errorData: ErrorResponse = await response.json();
        throw new Error(errorData.message || 'Failed to fetch confirmations');
      }

      const data: ConfirmationsResponse = await response.json();
      setConfirmations(data.confirmations);
      setError(null);
    } catch (err) {
      console.error('Confirmations fetch error:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load confirmations'
      );
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, authenticatedFetch]);

  // Initial load and refresh setup
  useEffect(() => {
    fetchConfirmations();

    // Set up auto-refresh interval
    const interval = setInterval(fetchConfirmations, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchConfirmations, refreshInterval]);

  /**
   * Handle confirmation or denial of a sighting
   */
  const handleConfirmSighting = useCallback(
    async (sightingId: number, confirmed: boolean) => {
      if (!isAuthenticated) {
        setError('Authentication required');
        return;
      }

      // Mark as processing
      setProcessingIds((prev) => new Set(prev).add(sightingId));

      try {
        const response = await authenticatedFetch(`/api/corgi/confirm/${sightingId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ confirmed }),
        });

        if (!response.ok) {
          const errorData: ErrorResponse = await response.json();
          throw new Error(
            errorData.message || 'Failed to process confirmation'
          );
        }

        // Remove the confirmed/denied sighting from the list
        setConfirmations((prev) =>
          prev.filter((sighting) => sighting.id !== sightingId)
        );

        // Notify parent component
        onConfirmationProcessed?.(sightingId, confirmed);
      } catch (err) {
        console.error('Confirmation processing error:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to process confirmation'
        );
      } finally {
        // Remove from processing
        setProcessingIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(sightingId);
          return newSet;
        });
      }
    },
    [isAuthenticated, authenticatedFetch, onConfirmationProcessed]
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
   * Get corgi emoji based on count
   */
  const getCorgiEmoji = (count: number): string => {
    if (count === 1) return '🐕';
    if (count <= 3) return '🐕🐕';
    if (count <= 5) return '🐕🐕🐕';
    return '🐕🐕🐕+';
  };

  if (!isAuthenticated) {
    return (
      <Placeholder
        header="Authentication Required"
        description="Please log in to view pending confirmations"
      />
    );
  }

  if (isLoading) {
    return (
      <Section header="Pending Confirmations">
        <div className="flex justify-center items-center p-8">
          <Spinner size="m" />
          <span className="ml-3">Loading confirmations...</span>
        </div>
      </Section>
    );
  }

  if (error) {
    return (
      <Section header="Pending Confirmations">
        <div className="p-4">
          <Placeholder header="Error Loading Confirmations" description={error}>
            <Button size="s" mode="outline" onClick={fetchConfirmations}>
              Retry
            </Button>
          </Placeholder>
        </div>
      </Section>
    );
  }

  // Empty state
  if (confirmations.length === 0) {
    if (!showEmptyState) {
      return null;
    }

    return (
      <Section header="Pending Confirmations">
        <div className="p-4">
          <Placeholder
            header="No Pending Confirmations"
            description="You don't have any corgi sightings waiting for your confirmation. When your buddy spots corgis, they'll appear here for you to verify."
          >
            <div className="flex items-center justify-center w-16 h-16 bg-orange-100 rounded-full">
              <span className="text-2xl">🐕</span>
            </div>
          </Placeholder>
        </div>
      </Section>
    );
  }

  // List of confirmations
  return (
    <List>
      <Section
        header="Pending Confirmations"
        footer={`${confirmations.length} sighting${confirmations.length !== 1 ? 's' : ''} waiting for your confirmation`}
      >
        {confirmations.map((sighting) => {
          const isProcessing = processingIds.has(sighting.id);

          return (
            <Cell
              key={sighting.id}
              subtitle={`Reported ${formatTimestamp(sighting.createdAt)}`}
              before={
                <div className="flex items-center justify-center w-10 h-10 bg-orange-100 rounded-full">
                  <span className="text-lg">
                    {getCorgiEmoji(sighting.corgiCount)}
                  </span>
                </div>
              }
              after={<Badge type="dot">Pending</Badge>}
            >
              <div className="flex flex-col gap-2">
                <div>
                  <strong>
                    {sighting.corgiCount} Corgi
                    {sighting.corgiCount !== 1 ? 's' : ''} Spotted
                  </strong>
                </div>

                <div className="flex gap-2 mt-2">
                  <Button
                    size="s"
                    onClick={() => handleConfirmSighting(sighting.id, true)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <div className="flex items-center gap-1">
                        <Spinner size="s" />
                        Processing...
                      </div>
                    ) : (
                      'Confirm'
                    )}
                  </Button>

                  <Button
                    size="s"
                    mode="outline"
                    onClick={() => handleConfirmSighting(sighting.id, false)}
                    disabled={isProcessing}
                  >
                    Deny
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
          When you confirm a sighting, your buddy will earn Corgi coins. Only
          confirm sightings you can actually verify or trust.
        </Caption>
      </Section>
    </List>
  );
}

/**
 * Hook to manage confirmation list state and actions
 */
export function useCorgiConfirmations() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const handleConfirmationProcessed = useCallback(
    (sightingId: number, confirmed: boolean) => {
      console.log(
        `Sighting ${sightingId} ${confirmed ? 'confirmed' : 'denied'}`
      );
      // Could trigger notifications or other side effects here
    },
    []
  );

  return {
    refreshTrigger,
    triggerRefresh,
    handleConfirmationProcessed,
  };
}

export default ConfirmationList;
