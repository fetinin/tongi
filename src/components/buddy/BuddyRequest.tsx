'use client';

import React, { useState, useCallback } from 'react';
import {
  List,
  Section,
  Cell,
  Button,
  Modal,
  Placeholder,
  Spinner,
  Caption,
  Avatar,
  Badge
} from '@telegram-apps/telegram-ui';
import { useAuth } from '@/components/Auth/AuthProvider';

// Types for user and buddy request
interface User {
  id: number;
  telegramUsername: string | null;
  firstName: string;
  tonWalletAddress: string | null;
  createdAt: string;
  updatedAt?: string;
}

interface BuddyRequestResult {
  id: number;
  buddy: {
    id: number;
    telegramUsername: string | null;
    firstName: string;
    tonWalletAddress: string | null;
    createdAt: string;
  };
  status: string;
  initiatedBy: number;
  createdAt: string;
  confirmedAt: string | null;
}

interface BuddyRequestProps {
  /** User to send buddy request to */
  targetUser: User | null;
  /** Whether the request modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Callback when buddy request is successfully sent */
  onRequestSent?: (result: BuddyRequestResult) => void;
  /** Callback when request fails */
  onError?: (error: string) => void;
}

export function BuddyRequest({
  targetUser,
  isOpen,
  onClose,
  onRequestSent,
  onError
}: BuddyRequestProps) {
  const { token, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [requestResult, setRequestResult] = useState<BuddyRequestResult | null>(null);

  /**
   * Send buddy request to target user
   */
  const sendBuddyRequest = useCallback(async () => {
    if (!targetUser || !isAuthenticated || !token) {
      const error = 'Authentication required to send buddy request';
      onError?.(error);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/buddy/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetUserId: targetUser.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send buddy request');
      }

      const result: BuddyRequestResult = await response.json();
      setRequestResult(result);

      // Notify parent component
      onRequestSent?.(result);
    } catch (err) {
      console.error('Buddy request error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to send buddy request';
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [targetUser, isAuthenticated, token, onRequestSent, onError]);

  /**
   * Handle modal close
   */
  const handleClose = useCallback(() => {
    setRequestResult(null);
    onClose();
  }, [onClose]);

  /**
   * Format username display
   */
  const formatUsername = (user: User): string => {
    if (user.telegramUsername) {
      return `@${user.telegramUsername}`;
    }
    return user.firstName;
  };

  /**
   * Format user details
   */
  const formatUserDetails = (user: User): string => {
    const details = [];

    if (user.telegramUsername) {
      details.push(user.firstName);
    }

    if (user.tonWalletAddress) {
      details.push('TON Connected');
    } else {
      details.push('No TON Wallet');
    }

    const joinDate = new Date(user.createdAt).toLocaleDateString();
    details.push(`Joined ${joinDate}`);

    return details.join(' • ');
  };

  if (!targetUser) {
    return null;
  }

  return (
    <Modal
      header="Send Buddy Request"
      open={isOpen}
      onOpenChange={(open) => !open && handleClose()}
    >
      {/* Request Success State */}
      {requestResult && (
        <div className="p-4">
          <Placeholder
            header="Request Sent!"
            description={`Your buddy request has been sent to ${formatUsername(targetUser)}. They will receive a notification and can accept or decline your request.`}
          >
            <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <span className="text-2xl">✅</span>
            </div>
          </Placeholder>

          <div className="mt-6 flex justify-center">
            <Button onClick={handleClose}>
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Request Form State */}
      {!requestResult && (
        <div className="p-4">
          {/* Target User Info */}
          <List>
            <Section header="Send Request To">
              <Cell
                subtitle={formatUserDetails(targetUser)}
                before={
                  <Avatar
                    size={40}
                    fallbackIcon={
                      <div className="flex items-center justify-center w-full h-full bg-blue-100 rounded-full">
                        <span className="text-lg">👤</span>
                      </div>
                    }
                  />
                }
                after={
                  targetUser.tonWalletAddress ? (
                    <Badge type="number">TON Ready</Badge>
                  ) : (
                    <Badge type="dot">No Wallet</Badge>
                  )
                }
              >
                {formatUsername(targetUser)}
              </Cell>
            </Section>
          </List>

          {/* Request Information */}
          <Section header="About Buddy Relationships" className="mt-4">
            <Caption level="1" className="px-4 py-2 text-gray-600">
              When you become buddies, you&apos;ll be able to:
            </Caption>
            <ul className="px-4 text-sm text-gray-600 space-y-1">
              <li>• Confirm each other&apos;s corgi sightings</li>
              <li>• Earn Corgi coins together</li>
              <li>• Create and approve wishes for the marketplace</li>
              <li>• Support each other&apos;s TON transactions</li>
            </ul>
          </Section>

          {/* Warning if no TON wallet */}
          {!targetUser.tonWalletAddress && (
            <Section className="mt-4">
              <Caption level="1" className="px-4 py-2 text-orange-600">
                ⚠️ This user hasn&apos;t connected a TON wallet yet. They&apos;ll need to connect one to participate in Corgi coin transactions.
              </Caption>
            </Section>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col gap-3">
            <Button
              size="l"
              onClick={sendBuddyRequest}
              disabled={isLoading || !isAuthenticated}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Spinner size="s" />
                  Sending Request...
                </div>
              ) : (
                'Send Buddy Request'
              )}
            </Button>

            <Button
              size="l"
              mode="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>

          {/* Authentication Warning */}
          {!isAuthenticated && (
            <Caption level="1" className="text-center mt-4 text-red-500">
              Please log in to send buddy requests
            </Caption>
          )}
        </div>
      )}
    </Modal>
  );
}

/**
 * Hook to manage buddy request modal state
 */
export function useBuddyRequest() {
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openRequest = useCallback((user: User) => {
    setTargetUser(user);
    setIsOpen(true);
  }, []);

  const closeRequest = useCallback(() => {
    setIsOpen(false);
    // Don't clear targetUser immediately to allow for smooth animation
    setTimeout(() => setTargetUser(null), 300);
  }, []);

  return {
    targetUser,
    isOpen,
    openRequest,
    closeRequest,
  };
}

export default BuddyRequest;