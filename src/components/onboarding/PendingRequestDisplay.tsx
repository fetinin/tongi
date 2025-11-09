'use client';

import React, { useState, useCallback } from 'react';
import {
  List,
  Section,
  Cell,
  Badge,
  Button,
  Spinner,
  Caption,
} from '@telegram-apps/telegram-ui';
import { useAuth } from '@/components/Auth/AuthProvider';

interface BuddyInfo {
  id: number;
  telegramUsername: string | null;
  firstName: string;
  tonWalletAddress: string | null;
  createdAt: string;
}

interface PendingRequestData {
  id: number;
  buddy: BuddyInfo;
  status: 'pending' | 'active' | 'dissolved';
  initiatedBy: number;
  createdAt: string;
  confirmedAt: string | null;
}

interface PendingRequestDisplayProps {
  /** The pending buddy request to display */
  request: PendingRequestData;
  /** Callback when request is cancelled */
  onCancelled?: () => void;
  /** Callback when error occurs */
  onError?: (error: string) => void;
}

/**
 * PendingRequestDisplay - Shows a pending buddy request
 *
 * Displays a pending buddy request that was initiated by the current user,
 * with option to cancel it or wait for the buddy to accept.
 *
 * User Story 2: Buddy Request and Confirmation
 */
export function PendingRequestDisplay({
  request,
  onCancelled,
  onError,
}: PendingRequestDisplayProps) {
  const { authenticatedFetch } = useAuth();
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    if (buddy.tonWalletAddress) {
      details.push('TON Connected');
    } else {
      details.push('No TON Wallet');
    }

    return details.join(' • ');
  };

  /**
   * Handle cancel buddy request
   */
  const handleCancel = useCallback(async () => {
    setIsCancelling(true);
    setError(null);

    try {
      const response = await authenticatedFetch('/api/buddy/cancel', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          buddyPairId: request.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to cancel buddy request');
      }

      // Notify parent that request was cancelled
      if (onCancelled) {
        onCancelled();
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to cancel buddy request';
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsCancelling(false);
    }
  }, [request.id, authenticatedFetch, onCancelled, onError]);

  /**
   * Format creation date
   */
  const formatCreationDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <List>
      <Section header="Buddy Request Sent">
        <Cell
          subtitle={formatBuddyDetails(request.buddy)}
          before={
            <div className="flex items-center justify-center w-10 h-10 bg-yellow-100 rounded-full">
              <span className="text-lg">⏳</span>
            </div>
          }
          after={<Badge type="dot">Pending</Badge>}
        >
          {formatUsername(request.buddy)}
        </Cell>

        {/* Request Details */}
        <Cell subtitle={`Sent on ${formatCreationDate(request.createdAt)}`}>
          Request Details
        </Cell>

        {/* TON Wallet Status */}
        <Cell
          subtitle={
            request.buddy.tonWalletAddress
              ? 'Ready for transactions'
              : 'TON wallet not connected'
          }
          after={
            request.buddy.tonWalletAddress ? (
              <Badge type="number">TON Connected</Badge>
            ) : (
              <Badge type="dot">No Wallet</Badge>
            )
          }
        >
          Wallet Status
        </Cell>

        {/* Error message if any */}
        {error && (
          <Cell>
            <div className="text-red-500 text-sm">{error}</div>
          </Cell>
        )}

        {/* Action Button */}
        <Cell>
          <Button
            mode="outline"
            size="m"
            onClick={handleCancel}
            disabled={isCancelling}
            className="min-h-[2.75rem] w-full touch-manipulation"
          >
            {isCancelling ? 'Cancelling...' : 'Cancel Request'}
          </Button>
        </Cell>
      </Section>

      {/* Status Information */}
      <Section>
        <Caption
          level="1"
          className="px-4 py-2 text-gray-600 dark:text-gray-400"
        >
          {isCancelling ? (
            <div className="flex items-center gap-2">
              <Spinner size="s" />
              <span>Cancelling request...</span>
            </div>
          ) : (
            'Waiting for your buddy to accept the request. You can cancel anytime.'
          )}
        </Caption>
      </Section>
    </List>
  );
}

export default PendingRequestDisplay;
