'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  List,
  Section,
  Cell,
  Input,
  Button,
  Placeholder,
  Spinner,
  Caption,
} from '@telegram-apps/telegram-ui';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/components/Auth/AuthProvider';

// Types for search results
interface SearchedUser {
  id: number;
  telegramUsername: string | null;
  firstName: string;
  tonWalletAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BuddySearchResponse {
  users: SearchedUser[];
}

interface BuddySearchProps {
  /** Callback when a user is selected for buddy request */
  onUserSelect?: (user: SearchedUser) => void;
  /** Optional custom placeholder when no search performed */
  emptyPlaceholder?: React.ReactNode;
  /** Optional custom placeholder when no results found */
  noResultsPlaceholder?: React.ReactNode;
  /** Optional translations namespace (defaults to buddy.search) */
  translationsNamespace?: string;
}

export function BuddySearch({
  onUserSelect,
  emptyPlaceholder,
  noResultsPlaceholder,
  translationsNamespace = 'buddy.search',
}: BuddySearchProps) {
  const { isAuthenticated, authenticatedFetch } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchedUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const t = useTranslations(translationsNamespace);

  // Debounced search effect
  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        performSearch(searchQuery.trim());
      } else {
        setSearchResults([]);
        setHasSearched(false);
        setError(null);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(delayedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  /**
   * Perform user search via API
   */
  const performSearch = useCallback(
    async (query: string) => {
      if (!isAuthenticated) {
        setError(t('errors.authenticationRequired'));
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await authenticatedFetch(
          `/api/buddy/search?username=${encodeURIComponent(query)}`
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            (errorData && errorData.message) || t('errors.searchFailed')
          );
        }

        const data: BuddySearchResponse = await response.json();
        setSearchResults(data.users);
        setHasSearched(true);
      } catch (err) {
        console.error('Search error:', err);
        setError(err instanceof Error ? err.message : t('errors.searchFailed'));
        setSearchResults([]);
        setHasSearched(true);
      } finally {
        setIsLoading(false);
      }
    },
    [isAuthenticated, authenticatedFetch, t]
  );

  /**
   * Handle user selection for buddy request
   */
  const handleUserSelect = useCallback(
    (user: SearchedUser) => {
      if (onUserSelect) {
        onUserSelect(user);
      }
    },
    [onUserSelect]
  );

  /**
   * Format username display
   */
  const formatUsername = (user: SearchedUser): string => {
    if (user.telegramUsername) {
      return `@${user.telegramUsername}`;
    }
    return user.firstName;
  };

  /**
   * Format user details for subtitle
   */
  const formatUserDetails = (user: SearchedUser): string => {
    const details = [];

    if (user.telegramUsername) {
      details.push(user.firstName);
    }

    if (user.tonWalletAddress) {
      details.push(t('tonConnected'));
    } else {
      details.push(t('noTonWallet'));
    }

    return details.join(' • ');
  };

  if (!isAuthenticated) {
    return (
      <Placeholder
        header={t('authRequiredTitle')}
        description={t('authRequiredDescription')}
      />
    );
  }

  return (
    <div className="buddy-search">
      {/* Search Input Section */}
      <Section header={t('heading')}>
        <div className="p-4">
          <Input
            header={t('usernameLabel')}
            placeholder={t('usernamePlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            status={error ? 'error' : undefined}
          />
          {error && (
            <Caption
              level="1"
              className="mt-2 text-[var(--tg-theme-destructive-text-color,#ff3b30)]"
            >
              {error}
            </Caption>
          )}
        </div>
      </Section>

      {/* Search Results Section */}
      {isLoading && (
        <Section>
          <div className="flex justify-center items-center p-8">
            <Spinner size="m" />
            <span className="ml-3">{t('searching')}</span>
          </div>
        </Section>
      )}

      {!isLoading && hasSearched && searchResults.length === 0 && (
        <Section>
          <div className="p-4">
            {noResultsPlaceholder || (
              <Placeholder
                header={t('noResultsHeader')}
                description={t('noResultsDescription', {
                  query: searchQuery,
                })}
              />
            )}
          </div>
        </Section>
      )}

      {!isLoading && !hasSearched && searchQuery.length < 2 && (
        <Section>
          <div className="p-4">
            {emptyPlaceholder || (
              <Placeholder
                header={t('emptyHeader')}
                description={t('emptyDescription')}
              />
            )}
          </div>
        </Section>
      )}

      {/* Results List */}
      {!isLoading && searchResults.length > 0 && (
        <List>
          <Section header={t('resultsHeader', { count: searchResults.length })}>
            {searchResults.map((user) => (
              <Cell
                key={user.id}
                subtitle={formatUserDetails(user)}
                after={
                  <Button
                    size="s"
                    mode="outline"
                    onClick={() => handleUserSelect(user)}
                  >
                    {t('sendRequest')}
                  </Button>
                }
              >
                {formatUsername(user)}
              </Cell>
            ))}
          </Section>
        </List>
      )}
    </div>
  );
}

export default BuddySearch;
