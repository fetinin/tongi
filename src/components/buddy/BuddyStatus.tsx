'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  List,
  Section,
  Cell,
  Badge,
  Button,
  Placeholder,
  Spinner,
  Caption,
} from '@telegram-apps/telegram-ui';
import { useAuth } from '@/components/Auth/AuthProvider';

// Types for buddy status
interface BuddyInfo {
  id: number;
  telegramUsername: string | null;
  firstName: string;
  tonWalletAddress: string | null;
  createdAt: string;
}

interface BuddyPairStatus {
  id: number;
  buddy: BuddyInfo;
  status: 'pending' | 'active' | 'dissolved';
  initiatedBy: number;
  createdAt: string;
  confirmedAt: string | null;
}

interface NoBuddyStatus {
  status: 'no_buddy';
  message: string;
}

type BuddyStatusData = BuddyPairStatus | NoBuddyStatus;

interface BuddyStatusProps {
  /** Callback when user wants to find a new buddy */
  onFindBuddy?: () => void;
  /** Callback when user wants to dissolve current buddy relationship */
  onDissolveBuddy?: (buddyId: number) => void;
  /** Auto-refresh interval in milliseconds (default: 30000) */
  refreshInterval?: number;
}

export function BuddyStatus({
  onFindBuddy,
  onDissolveBuddy,
  refreshInterval = 30000,
}: BuddyStatusProps) {
  const { token, isAuthenticated, user } = useAuth();
  const [buddyStatus, setBuddyStatus] = useState<BuddyStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch buddy status from API
  const fetchBuddyStatus = useCallback(async () => {
    if (!isAuthenticated || !token) {
      setError('Authentication required');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/buddy/status', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch buddy status');
      }

      const data: BuddyStatusData = await response.json();
      setBuddyStatus(data);
      setError(null);
    } catch (err) {
      console.error('Buddy status error:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load buddy status'
      );
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, token]);

  // Initial load and refresh setup
  useEffect(() => {
    fetchBuddyStatus();

    // Set up auto-refresh interval
    const interval = setInterval(fetchBuddyStatus, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchBuddyStatus, refreshInterval]);

  /**
   * Handle buddy dissolution
   */
  const handleDissolveBuddy = useCallback(
    async (buddyId: number) => {
      if (onDissolveBuddy) {
        await onDissolveBuddy(buddyId);
        // Refresh status after dissolution
        fetchBuddyStatus();
      }
    },
    [onDissolveBuddy, fetchBuddyStatus]
  );

  /**
   * Handle accept buddy request
   */
  const handleAccept = useCallback(async () => {
    if (!buddyStatus || buddyStatus.status === 'no_buddy') return;
    if (buddyStatus.status !== 'pending') return;
    if (!token) return;

    setIsProcessing(true);
    setActionError(null);

    try {
      const response = await fetch('/api/buddy/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          buddyPairId: buddyStatus.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to accept buddy request');
      }

      // Refresh buddy status to show updated state
      await fetchBuddyStatus();
    } catch (err) {
      console.error('Accept buddy error:', err);
      setActionError(
        err instanceof Error ? err.message : 'Failed to accept buddy request'
      );
    } finally {
      setIsProcessing(false);
    }
  }, [buddyStatus, token, fetchBuddyStatus]);

  /**
   * Handle reject buddy request
   */
  const handleReject = useCallback(async () => {
    if (!buddyStatus || buddyStatus.status === 'no_buddy') return;
    if (buddyStatus.status !== 'pending') return;
    if (!token) return;

    setIsProcessing(true);
    setActionError(null);

    try {
      const response = await fetch('/api/buddy/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          buddyPairId: buddyStatus.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to reject buddy request');
      }

      // Refresh buddy status to show updated state
      await fetchBuddyStatus();
    } catch (err) {
      console.error('Reject buddy error:', err);
      setActionError(
        err instanceof Error ? err.message : 'Failed to reject buddy request'
      );
    } finally {
      setIsProcessing(false);
    }
  }, [buddyStatus, token, fetchBuddyStatus]);

  /**
   * Format username display
   */
  const formatUsername = (buddy: BuddyInfo): string => {
    if (buddy.telegramUsername) {
      return `@${buddy.telegramUsername}`;
    }
    return buddy.firstName;
  };

  /**
   * Format buddy details
   */
  const formatBuddyDetails = (buddy: BuddyInfo): string => {
    const details = [];

    if (buddy.telegramUsername) {
      details.push(buddy.firstName);
    }

    const joinDate = new Date(buddy.createdAt).toLocaleDateString();
    details.push(`Joined ${joinDate}`);

    return details.join(' • ');
  };

  /**
   * Get status badge configuration
   */
  const getStatusBadge = (status: string, initiatedBy: number) => {
    const isInitiatedByCurrentUser = user?.id === initiatedBy;

    switch (status) {
      case 'pending':
        return {
          type: 'dot' as const,
          text: isInitiatedByCurrentUser ? 'Request Sent' : 'Pending',
        };
      case 'active':
        return {
          type: 'number' as const,
          text: 'Active',
        };
      case 'dissolved':
        return {
          type: 'dot' as const,
          text: 'Dissolved',
        };
      default:
        return {
          type: 'dot' as const,
          text: status,
        };
    }
  };

  /**
   * Get formatted creation date
   */
  const formatCreationDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (!isAuthenticated) {
    return (
      <Placeholder
        header="Authentication Required"
        description="Please log in to view your buddy status"
      />
    );
  }

  if (isLoading) {
    return (
      <Section header="Buddy Status">
        <div className="flex justify-center items-center p-8">
          <Spinner size="m" />
          <span className="ml-3">Loading buddy status...</span>
        </div>
      </Section>
    );
  }

  if (error) {
    return (
      <Section header="Buddy Status">
        <div className="p-4">
          <Placeholder header="Error Loading Status" description={error}>
            <Button size="s" mode="outline" onClick={fetchBuddyStatus}>
              Retry
            </Button>
          </Placeholder>
        </div>
      </Section>
    );
  }

  // No buddy relationship
  if (buddyStatus?.status === 'no_buddy') {
    return (
      <Section header="Buddy Status">
        <div className="p-4">
          <Placeholder
            header="No Buddy Yet"
            description="You don't have a buddy relationship yet. Find someone to be your corgi-spotting partner!"
          >
            <Button size="m" onClick={onFindBuddy}>
              Find a Buddy
            </Button>
          </Placeholder>
        </div>
      </Section>
    );
  }

  // Buddy relationship exists
  if (buddyStatus && 'buddy' in buddyStatus) {
    const badgeConfig = getStatusBadge(
      buddyStatus.status,
      buddyStatus.initiatedBy
    );

    return (
      <List>
        <Section header="Your Buddy">
          <Cell
            subtitle={formatBuddyDetails(buddyStatus.buddy)}
            before={
              <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
                <span className="text-lg">🤝</span>
              </div>
            }
            after={<Badge type={badgeConfig.type}>{badgeConfig.text}</Badge>}
          >
            {formatUsername(buddyStatus.buddy)}
          </Cell>

          {/* Relationship Details */}
          <Cell
            subtitle={`Partnership since ${formatCreationDate(buddyStatus.createdAt)}`}
          >
            Relationship Details
          </Cell>

          {/* TON Wallet Status */}
          <Cell
            subtitle={
              buddyStatus.buddy.tonWalletAddress
                ? 'Ready for Corgi coin transactions'
                : 'TON wallet not connected'
            }
            after={
              buddyStatus.buddy.tonWalletAddress ? (
                <Badge type="number">TON Connected</Badge>
              ) : (
                <Badge type="dot">No Wallet</Badge>
              )
            }
          >
            Wallet Status
          </Cell>

          {/* Accept/Reject Actions - Only show for pending requests where user is recipient */}
          {buddyStatus.status === 'pending' &&
            user?.id !== buddyStatus.initiatedBy && (
              <>
                {actionError && (
                  <Cell>
                    <div className="text-red-500 text-sm">{actionError}</div>
                  </Cell>
                )}
                <Cell>
                  <div className="flex gap-2">
                    <Button
                      mode="filled"
                      size="m"
                      onClick={handleAccept}
                      disabled={isProcessing}
                    >
                      {isProcessing ? 'Processing...' : 'Accept'}
                    </Button>
                    <Button
                      mode="outline"
                      size="m"
                      onClick={handleReject}
                      disabled={isProcessing}
                    >
                      Reject
                    </Button>
                  </div>
                </Cell>
              </>
            )}

          {/* Action Buttons */}
          {buddyStatus.status === 'active' && (
            <Cell>
              <div className="flex gap-2">
                <Button
                  size="s"
                  mode="outline"
                  onClick={() => handleDissolveBuddy(buddyStatus.buddy.id)}
                >
                  End Partnership
                </Button>
                {onFindBuddy && (
                  <Button size="s" mode="outline" onClick={onFindBuddy}>
                    Find New Buddy
                  </Button>
                )}
              </div>
            </Cell>
          )}
        </Section>

        {/* Status Information */}
        <Section>
          <Caption level="1" className="px-4 py-2 text-gray-600">
            {buddyStatus.status === 'pending' &&
            user?.id === buddyStatus.initiatedBy
              ? 'Waiting for your buddy to accept the request.'
              : buddyStatus.status === 'pending'
                ? 'You have a pending buddy request to respond to.'
                : buddyStatus.status === 'active'
                  ? 'You can now report corgi sightings and create wishes together!'
                  : 'This buddy relationship has been dissolved.'}
          </Caption>
        </Section>
      </List>
    );
  }

  return (
    <Section header="Buddy Status">
      <div className="p-4">
        <Placeholder
          header="Unable to Load Status"
          description="Something went wrong loading your buddy status."
        >
          <Button size="s" mode="outline" onClick={fetchBuddyStatus}>
            Retry
          </Button>
        </Placeholder>
      </div>
    </Section>
  );
}

export default BuddyStatus;
