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
}

export function BuddySearch({
  onUserSelect,
  emptyPlaceholder,
  noResultsPlaceholder,
}: BuddySearchProps) {
  const { token, isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchedUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

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
      if (!isAuthenticated || !token) {
        setError('Authentication required');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/buddy/search?username=${encodeURIComponent(query)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Search failed');
        }

        const data: BuddySearchResponse = await response.json();
        setSearchResults(data.users);
        setHasSearched(true);
      } catch (err) {
        console.error('Search error:', err);
        setError(err instanceof Error ? err.message : 'Search failed');
        setSearchResults([]);
        setHasSearched(true);
      } finally {
        setIsLoading(false);
      }
    },
    [isAuthenticated, token]
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
      details.push('TON Connected');
    } else {
      details.push('No TON Wallet');
    }

    return details.join(' • ');
  };

  if (!isAuthenticated) {
    return (
      <Placeholder
        header="Authentication Required"
        description="Please log in to search for buddies"
      />
    );
  }

  return (
    <div className="buddy-search">
      {/* Search Input Section */}
      <Section header="Find Your Buddy">
        <div className="p-4">
          <Input
            header="Telegram Username"
            placeholder="Enter username (without @)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            status={error ? 'error' : undefined}
          />
          {error && (
            <Caption level="1" className="text-red-500 mt-2">
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
            <span className="ml-3">Searching users...</span>
          </div>
        </Section>
      )}

      {!isLoading && hasSearched && searchResults.length === 0 && (
        <Section>
          <div className="p-4">
            {noResultsPlaceholder || (
              <Placeholder
                header="No Users Found"
                description={`No users found matching "${searchQuery}". Try a different username.`}
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
                header="Search for Buddies"
                description="Enter at least 2 characters to search for users by their Telegram username."
              />
            )}
          </div>
        </Section>
      )}

      {/* Results List */}
      {!isLoading && searchResults.length > 0 && (
        <List>
          <Section
            header={`Found ${searchResults.length} user${searchResults.length === 1 ? '' : 's'}`}
          >
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
                    Send Request
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
