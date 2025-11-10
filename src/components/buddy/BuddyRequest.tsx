'use client';

import React, { useState, useCallback, useMemo } from 'react';
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
  Badge,
} from '@telegram-apps/telegram-ui';
import { useFormatter, useTranslations } from 'next-intl';
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
  onError,
}: BuddyRequestProps) {
  const { isAuthenticated, authenticatedFetch } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [requestResult, setRequestResult] = useState<BuddyRequestResult | null>(
    null
  );
  const t = useTranslations('buddy.request');
  const formatter = useFormatter();

  /**
   * Send buddy request to target user
   */
  const sendBuddyRequest = useCallback(async () => {
    if (!targetUser || !isAuthenticated) {
      const error = t('errors.authentication');
      onError?.(error);
      return;
    }

    setIsLoading(true);

    try {
      const response = await authenticatedFetch('/api/buddy/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetUserId: targetUser.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          (errorData && errorData.message) || t('errors.generic')
        );
      }

      const result: BuddyRequestResult = await response.json();
      setRequestResult(result);

      // Notify parent component
      onRequestSent?.(result);
    } catch (err) {
      console.error('Buddy request error:', err);
      const errorMessage =
        err instanceof Error ? err.message : t('errors.generic');
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [
    targetUser,
    isAuthenticated,
    authenticatedFetch,
    onRequestSent,
    onError,
    t,
  ]);

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
      details.push(t('tonReady'));
    } else {
      details.push(t('noWallet'));
    }

    const joinDate = new Date(user.createdAt);
    if (!Number.isNaN(joinDate.getTime())) {
      const formattedDate = formatter.dateTime(joinDate, {
        dateStyle: 'medium',
      });
      details.push(t('joinedDate', { date: formattedDate }));
    }

    return details.join(' • ');
  };

  const aboutItems = useMemo(() => {
    const rawItems = t.raw('aboutItems');
    if (rawItems && typeof rawItems === 'object') {
      return Object.values(rawItems as Record<string, string>);
    }
    return [];
  }, [t]);

  if (!targetUser) {
    return null;
  }

  return (
    <Modal
      header={t('modalHeader')}
      open={isOpen}
      onOpenChange={(open) => !open && handleClose()}
    >
      {/* Request Success State */}
      {requestResult && (
        <div className="p-4">
          <Placeholder
            header={t('successHeader')}
            description={t('successDescription', {
              username: formatUsername(targetUser),
            })}
          >
            <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <span className="text-2xl">✅</span>
            </div>
          </Placeholder>

          <div className="mt-6 flex justify-center">
            <Button onClick={handleClose}>{t('close')}</Button>
          </div>
        </div>
      )}

      {/* Request Form State */}
      {!requestResult && (
        <div className="p-4">
          {/* Target User Info */}
          <List>
            <Section header={t('sendToHeader')}>
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
                    <Badge type="number">{t('tonReady')}</Badge>
                  ) : (
                    <Badge type="dot">{t('noWallet')}</Badge>
                  )
                }
              >
                {formatUsername(targetUser)}
              </Cell>
            </Section>
          </List>

          {/* Request Information */}
          <Section header={t('aboutHeader')} className="mt-4">
            <Caption
              level="1"
              className="px-4 py-2 text-[var(--tg-theme-hint-color,#6b6b6d)]"
            >
              {t('aboutIntro')}
            </Caption>
            <ul className="space-y-1 px-4 text-sm text-[var(--tg-theme-hint-color,#6b6b6d)]">
              {aboutItems.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </Section>

          {/* Warning if no TON wallet */}
          {!targetUser.tonWalletAddress && (
            <Section className="mt-4">
              <Caption
                level="1"
                className="px-4 py-2 text-[var(--tg-theme-destructive-text-color,#ff3b30)]"
              >
                {t('walletWarning')}
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
                  {t('actions.sending')}
                </div>
              ) : (
                t('actions.send')
              )}
            </Button>

            <Button
              size="l"
              mode="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              {t('actions.cancel')}
            </Button>
          </div>

          {/* Authentication Warning */}
          {!isAuthenticated && (
            <Caption
              level="1"
              className="mt-4 text-center text-[var(--tg-theme-destructive-text-color,#ff3b30)]"
            >
              {t('authenticationHint')}
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
