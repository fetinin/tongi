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

// Types for corgi sighting history
interface CorgiSightingData {
  id: number;
  reporterId: number;
  buddyId: number;
  corgiCount: number;
  status: 'pending' | 'confirmed' | 'denied';
  createdAt: string;
  respondedAt: string | null;
}

interface SightingHistoryResponse {
  sightings: CorgiSightingData[];
}

interface ErrorResponse {
  error: string;
  message: string;
}

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'denied';

interface SightingHistoryProps {
  /** Callback when sighting history is updated */
  onHistoryUpdated?: (sightings: CorgiSightingData[]) => void;
  /** Auto-refresh interval in milliseconds (default: 30000) */
  refreshInterval?: number;
  /** Whether to show empty state */
  showEmptyState?: boolean;
  /** Maximum number of sightings to display */
  limit?: number;
  /** Initial status filter */
  initialFilter?: StatusFilter;
}

export function SightingHistory({
  onHistoryUpdated,
  refreshInterval = 30000,
  showEmptyState = true,
  limit,
  initialFilter = 'all',
}: SightingHistoryProps) {
  const { token, isAuthenticated } = useAuth();
  const [sightings, setSightings] = useState<CorgiSightingData[]>([]);
  const [filteredSightings, setFilteredSightings] = useState<
    CorgiSightingData[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialFilter);

  // Fetch sighting history from API
  const fetchSightingHistory = useCallback(async () => {
    if (!isAuthenticated || !token) {
      setError('Authentication required');
      setIsLoading(false);
      return;
    }

    try {
      const url = new URL('/api/corgi/sightings', window.location.origin);
      if (limit) {
        url.searchParams.set('limit', limit.toString());
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData: ErrorResponse = await response.json();
        throw new Error(
          errorData.message || 'Failed to fetch sighting history'
        );
      }

      const data: SightingHistoryResponse = await response.json();
      setSightings(data.sightings);
      setError(null);

      // Notify parent component
      onHistoryUpdated?.(data.sightings);
    } catch (err) {
      console.error('Sighting history fetch error:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load sighting history'
      );
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, token, limit, onHistoryUpdated]);

  // Initial load and refresh setup
  useEffect(() => {
    fetchSightingHistory();

    // Set up auto-refresh interval
    const interval = setInterval(fetchSightingHistory, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchSightingHistory, refreshInterval]);

  // Filter sightings based on status
  useEffect(() => {
    if (statusFilter === 'all') {
      setFilteredSightings(sightings);
    } else {
      setFilteredSightings(
        sightings.filter((sighting) => sighting.status === statusFilter)
      );
    }
  }, [sightings, statusFilter]);

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
          year:
            date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        });
      }
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

  /**
   * Get status badge props based on sighting status
   */
  const getStatusBadge = (status: CorgiSightingData['status']) => {
    switch (status) {
      case 'pending':
        return { type: 'number' as const, children: 'Pending' };
      case 'confirmed':
        return { type: 'dot' as const, children: 'Confirmed' };
      case 'denied':
        return { type: 'number' as const, children: 'Denied' };
      default:
        return { type: 'number' as const, children: status };
    }
  };

  /**
   * Calculate reward for confirmed sighting
   * Based on the reward logic in CorgiService
   */
  const calculateReward = (corgiCount: number): number => {
    if (corgiCount === 1) {
      return 1;
    } else if (corgiCount >= 2 && corgiCount <= 5) {
      return corgiCount * 2;
    } else {
      return corgiCount * 3;
    }
  };

  /**
   * Calculate statistics from sightings
   */
  const getStatistics = () => {
    const confirmedSightings = sightings.filter(
      (s) => s.status === 'confirmed'
    );
    const pendingSightings = sightings.filter((s) => s.status === 'pending');
    const deniedSightings = sightings.filter((s) => s.status === 'denied');

    const totalRewards = confirmedSightings.reduce((total, sighting) => {
      return total + calculateReward(sighting.corgiCount);
    }, 0);

    const totalCorgisSpotted = confirmedSightings.reduce((total, sighting) => {
      return total + sighting.corgiCount;
    }, 0);

    return {
      total: sightings.length,
      confirmed: confirmedSightings.length,
      pending: pendingSightings.length,
      denied: deniedSightings.length,
      totalRewards,
      totalCorgisSpotted,
    };
  };

  if (!isAuthenticated) {
    return (
      <Placeholder
        header="Authentication Required"
        description="Please log in to view your sighting history"
      />
    );
  }

  if (isLoading) {
    return (
      <Section header="Sighting History">
        <div className="flex justify-center items-center p-8">
          <Spinner size="m" />
          <span className="ml-3">Loading sighting history...</span>
        </div>
      </Section>
    );
  }

  if (error) {
    return (
      <Section header="Sighting History">
        <div className="p-4">
          <Placeholder header="Error Loading History" description={error}>
            <Button size="s" mode="outline" onClick={fetchSightingHistory}>
              Retry
            </Button>
          </Placeholder>
        </div>
      </Section>
    );
  }

  const stats = getStatistics();

  // Empty state
  if (sightings.length === 0) {
    if (!showEmptyState) {
      return null;
    }

    return (
      <Section header="Sighting History">
        <div className="p-4">
          <Placeholder
            header="No Sightings Yet"
            description="You haven't reported any corgi sightings yet. Start spotting corgis and building your history!"
          >
            <div className="flex items-center justify-center w-16 h-16 bg-orange-100 rounded-full">
              <span className="text-2xl">🐕</span>
            </div>
          </Placeholder>
        </div>
      </Section>
    );
  }

  return (
    <List>
      {/* Statistics Section */}
      <Section header="Your Statistics">
        <div className="p-4 space-y-2">
          <div className="flex justify-between items-center">
            <Caption level="1" className="text-gray-600">
              Total Sightings
            </Caption>
            <span className="font-medium">{stats.total}</span>
          </div>
          <div className="flex justify-between items-center">
            <Caption level="1" className="text-gray-600">
              Corgis Spotted
            </Caption>
            <span className="font-medium">{stats.totalCorgisSpotted}</span>
          </div>
          <div className="flex justify-between items-center">
            <Caption level="1" className="text-gray-600">
              Corgi Coins Earned
            </Caption>
            <span className="font-medium text-green-600">
              {stats.totalRewards}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">Confirmed: {stats.confirmed}</span>
            <span className="text-gray-500">Pending: {stats.pending}</span>
            <span className="text-gray-500">Denied: {stats.denied}</span>
          </div>
        </div>
      </Section>

      {/* Filter Section */}
      <Section header="Filter by Status">
        <div className="p-4">
          <div className="flex gap-2 flex-wrap">
            <Button
              size="s"
              mode={statusFilter === 'all' ? 'filled' : 'outline'}
              onClick={() => setStatusFilter('all')}
            >
              All ({stats.total})
            </Button>
            <Button
              size="s"
              mode={statusFilter === 'confirmed' ? 'filled' : 'outline'}
              onClick={() => setStatusFilter('confirmed')}
            >
              Confirmed ({stats.confirmed})
            </Button>
            <Button
              size="s"
              mode={statusFilter === 'pending' ? 'filled' : 'outline'}
              onClick={() => setStatusFilter('pending')}
            >
              Pending ({stats.pending})
            </Button>
            <Button
              size="s"
              mode={statusFilter === 'denied' ? 'filled' : 'outline'}
              onClick={() => setStatusFilter('denied')}
            >
              Denied ({stats.denied})
            </Button>
          </div>
        </div>
      </Section>

      {/* Sightings List */}
      <Section
        header="Your Sightings"
        footer={`${filteredSightings.length} sighting${filteredSightings.length !== 1 ? 's' : ''} ${statusFilter !== 'all' ? `with status: ${statusFilter}` : 'total'}`}
      >
        {filteredSightings.length === 0 ? (
          <div className="p-4">
            <Placeholder
              header={`No ${statusFilter === 'all' ? '' : statusFilter} Sightings`}
              description={`You don&apos;t have any ${statusFilter === 'all' ? '' : statusFilter + ' '}sightings to display.`}
            >
              <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full">
                <span className="text-lg">🔍</span>
              </div>
            </Placeholder>
          </div>
        ) : (
          filteredSightings.map((sighting) => {
            const statusBadge = getStatusBadge(sighting.status);
            const isConfirmed = sighting.status === 'confirmed';
            const reward = isConfirmed
              ? calculateReward(sighting.corgiCount)
              : 0;

            return (
              <Cell
                key={sighting.id}
                subtitle={`Reported ${formatTimestamp(sighting.createdAt)}${sighting.respondedAt ? ` • Responded ${formatTimestamp(sighting.respondedAt)}` : ''}`}
                before={
                  <div className="flex items-center justify-center w-10 h-10 bg-orange-100 rounded-full">
                    <span className="text-lg">
                      {getCorgiEmoji(sighting.corgiCount)}
                    </span>
                  </div>
                }
                after={<Badge {...statusBadge} />}
              >
                <div className="flex flex-col gap-1">
                  <div>
                    <strong>
                      {sighting.corgiCount} Corgi
                      {sighting.corgiCount !== 1 ? 's' : ''} Spotted
                    </strong>
                  </div>
                  {isConfirmed && (
                    <div className="text-sm text-green-600">
                      +{reward} Corgi Coin{reward !== 1 ? 's' : ''} Earned
                    </div>
                  )}
                  {sighting.status === 'pending' && (
                    <div className="text-sm text-gray-500">
                      Waiting for buddy confirmation
                    </div>
                  )}
                  {sighting.status === 'denied' && (
                    <div className="text-sm text-red-500">Denied by buddy</div>
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
          Your sighting history shows all corgi reports you&apos;ve made.
          Confirmed sightings earn you Corgi coins, which can be used in the
          marketplace.
        </Caption>
      </Section>
    </List>
  );
}

/**
 * Hook to manage sighting history state and actions
 */
export function useCorgiSightingHistory() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [filter, setFilter] = useState<StatusFilter>('all');

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const setStatusFilter = useCallback((newFilter: StatusFilter) => {
    setFilter(newFilter);
  }, []);

  const handleHistoryUpdated = useCallback((sightings: CorgiSightingData[]) => {
    console.log(`Loaded ${sightings.length} sightings from history`);
    // Could trigger notifications or other side effects here
  }, []);

  return {
    refreshTrigger,
    triggerRefresh,
    filter,
    setStatusFilter,
    handleHistoryUpdated,
  };
}

export default SightingHistory;
