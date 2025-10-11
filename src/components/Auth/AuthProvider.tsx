'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type PropsWithChildren,
} from 'react';
import { initData, useSignal, cloudStorage } from '@telegram-apps/sdk-react';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { Placeholder, Spinner } from '@telegram-apps/telegram-ui';
import { retrieveRawLaunchParams } from '@tma.js/bridge';

// Types for authentication state
interface User {
  id: number;
  firstName: string;
  username: string | null;
  tonWalletAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isNewUser: boolean;
}

interface AuthContextValue extends AuthState {
  login: () => Promise<void>;
  logout: () => Promise<void>;
  updateWalletAddress: (address: string | null) => Promise<void>;
}

// Create authentication context
const AuthContext = createContext<AuthContextValue | null>(null);

// Custom hook to use authentication context
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Storage keys for three-tier storage strategy
const STORAGE_KEYS = {
  SECURE: {
    AUTH_TOKEN: 'auth_token', // Sensitive authentication token
  },
  DEVICE: {
    USER_PREFERENCES: 'user_preferences', // Local app state
  },
  CLOUD: {
    USER_DATA: 'user_data', // Cross-device user information
  },
} as const;

interface AuthProviderProps extends PropsWithChildren {
  /** Optional loading component to show during authentication */
  loadingComponent?: React.ReactNode;
}

export function AuthProvider({
  children,
  loadingComponent,
}: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    isNewUser: false,
  });

  const initDataUser = useSignal(initData.user);
  const [tonConnectUI] = useTonConnectUI();

  // Monitor TON Connect wallet changes
  useEffect(() => {
    const unsubscribe = tonConnectUI.onStatusChange((wallet) => {
      if (wallet && authState.user) {
        // Update wallet address when TON Connect wallet changes
        updateWalletAddress(wallet.account.address);
      } else if (!wallet && authState.user?.tonWalletAddress) {
        // Clear wallet address when disconnected
        updateWalletAddress(null);
      }
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tonConnectUI, authState.user]);

  /**
   * Initialize authentication by checking stored credentials and Telegram data
   */
  const initializeAuth = useCallback(async (): Promise<void> => {
    try {
      setAuthState((prev) => ({ ...prev, isLoading: true }));

      // Check if we have a stored auth token
      const storedToken = await getStoredToken();
      const storedUserData = await getStoredUserData();

      if (storedToken && storedUserData) {
        // Verify stored credentials are still valid
        const isValid = await verifyStoredCredentials(storedToken);
        if (isValid) {
          setAuthState({
            user: storedUserData,
            token: storedToken,
            isAuthenticated: true,
            isLoading: false,
            isNewUser: false,
          });
          return;
        }
      }

      // No valid stored credentials, attempt fresh authentication
      // Try to get raw launch params directly from Telegram environment
      try {
        const rawParams = retrieveRawLaunchParams();
        if (rawParams) {
          await performAuthentication(rawParams);
        } else {
          setAuthState((prev) => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.log('No Telegram launch params available:', error);
        setAuthState((prev) => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      setAuthState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        isNewUser: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initDataUser]);

  // Initialize authentication on mount
  useEffect(() => {
    initializeAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initDataUser]);

  /**
   * Perform authentication with Telegram initData
   */
  const performAuthentication = useCallback(
    async (rawInitData?: string): Promise<void> => {
      try {
        // Get raw init data from parameter or retrieve it
        let rawLaunchParams = rawInitData;
        if (!rawLaunchParams) {
          try {
            rawLaunchParams = retrieveRawLaunchParams();
          } catch (error) {
            throw new Error('No Telegram initData available');
          }
        }

        if (!rawLaunchParams) {
          throw new Error('No Telegram initData available');
        }

        // Extract tgWebAppData from launch params
        // The launch params contain: tgWebAppData=...&tgWebAppVersion=...&tgWebAppPlatform=...
        // We need to extract and decode the tgWebAppData parameter value
        const params = new URLSearchParams(rawLaunchParams);
        const tgWebAppData = params.get('tgWebAppData');

        if (!tgWebAppData) {
          throw new Error('No tgWebAppData found in launch params');
        }

        // The tgWebAppData is already URL-encoded, so we need to decode it
        const initDataString = decodeURIComponent(tgWebAppData);

        // Get TON wallet address if connected
        const tonWalletAddress =
          tonConnectUI.wallet?.account.address || undefined;

        // Call authentication API
        const response = await fetch('/api/auth/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            initData: initDataString,
            tonWalletAddress,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Authentication failed');
        }

        const authResponse = await response.json();
        const { user, token, isNewUser } = authResponse;

        // Store credentials using three-tier storage strategy
        await storeCredentials(token, user);

        setAuthState({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
          isNewUser,
        });
      } catch (error) {
        console.error('Authentication error:', error);
        throw error;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [tonConnectUI]
  );

  /**
   * Manually trigger login process
   */
  async function login(): Promise<void> {
    if (authState.isLoading) {
      return;
    }

    setAuthState((prev) => ({ ...prev, isLoading: true }));
    try {
      await performAuthentication();
    } catch (error) {
      setAuthState((prev) => ({ ...prev, isLoading: false }));
      throw error;
    }
  }

  /**
   * Logout and clear stored credentials
   */
  async function logout(): Promise<void> {
    try {
      // Clear stored credentials
      await clearStoredCredentials();

      // Disconnect TON wallet if connected
      if (tonConnectUI.wallet) {
        await tonConnectUI.disconnect();
      }

      setAuthState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        isNewUser: false,
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  /**
   * Update user's TON wallet address
   */
  const updateWalletAddress = useCallback(
    async (address: string | null): Promise<void> => {
      if (!authState.user || !authState.token) {
        return;
      }

      try {
        // Get raw init data for wallet update
        let initDataString: string;
        try {
          initDataString = retrieveRawLaunchParams();
        } catch (error) {
          console.error('Cannot update wallet: No Telegram data available');
          return;
        }

        // Update via API if different from current
        if (address !== authState.user.tonWalletAddress) {
          const response = await fetch('/api/auth/validate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authState.token}`,
            },
            body: JSON.stringify({
              initData: initDataString,
              tonWalletAddress: address,
            }),
          });

          if (response.ok) {
            const authResponse = await response.json();
            const updatedUser = authResponse.user;

            // Update stored user data
            await storeUserData(updatedUser);

            setAuthState((prev) => ({
              ...prev,
              user: updatedUser,
            }));
          }
        }
      } catch (error) {
        console.error('Error updating wallet address:', error);
      }
    },
    [authState.user, authState.token]
  );

  /**
   * Get stored authentication token from localStorage
   * Note: In production, consider using more secure storage mechanisms
   */
  async function getStoredToken(): Promise<string | null> {
    try {
      return localStorage.getItem(STORAGE_KEYS.SECURE.AUTH_TOKEN);
    } catch {
      return null;
    }
  }

  /**
   * Get stored user data from cloud storage (with localStorage fallback)
   */
  async function getStoredUserData(): Promise<User | null> {
    try {
      const userData = await cloudStorage.getItem(STORAGE_KEYS.CLOUD.USER_DATA);
      return userData ? JSON.parse(userData) : null;
    } catch {
      // Fallback to localStorage if cloudStorage is unavailable
      try {
        const localData = localStorage.getItem(STORAGE_KEYS.CLOUD.USER_DATA);
        return localData ? JSON.parse(localData) : null;
      } catch {
        return null;
      }
    }
  }

  /**
   * Store authentication credentials using available storage options
   */
  async function storeCredentials(token: string, user: User): Promise<void> {
    try {
      // Store token in localStorage (fallback for secure storage)
      localStorage.setItem(STORAGE_KEYS.SECURE.AUTH_TOKEN, token);

      // Store user data in cloud storage for cross-device sync
      await storeUserData(user);
    } catch (error) {
      console.error('Error storing credentials:', error);
    }
  }

  /**
   * Store user data in cloud storage (with localStorage fallback)
   */
  async function storeUserData(user: User): Promise<void> {
    try {
      await cloudStorage.setItem(
        STORAGE_KEYS.CLOUD.USER_DATA,
        JSON.stringify(user)
      );
    } catch (error) {
      console.error('Error storing user data in cloudStorage:', error);
      // Fallback to localStorage if cloudStorage is unavailable
      try {
        localStorage.setItem(
          STORAGE_KEYS.CLOUD.USER_DATA,
          JSON.stringify(user)
        );
      } catch (fallbackError) {
        console.error(
          'Error storing user data in localStorage fallback:',
          fallbackError
        );
      }
    }
  }

  /**
   * Clear all stored credentials
   */
  async function clearStoredCredentials(): Promise<void> {
    try {
      // Clear localStorage token
      localStorage.removeItem(STORAGE_KEYS.SECURE.AUTH_TOKEN);

      // Clear cloud storage user data
      try {
        await cloudStorage.deleteItem(STORAGE_KEYS.CLOUD.USER_DATA);
      } catch {
        // If cloudStorage fails, also clear from localStorage fallback
        localStorage.removeItem(STORAGE_KEYS.CLOUD.USER_DATA);
      }
    } catch (error) {
      console.error('Error clearing credentials:', error);
    }
  }

  /**
   * Verify that stored credentials are still valid
   */
  async function verifyStoredCredentials(token: string): Promise<boolean> {
    try {
      // Simple token validation - in a real app, you might want to call an API endpoint
      const parts = token.split('.');
      if (parts.length !== 3) {
        return false;
      }

      // Decode JWT payload to check expiration
      const payload = JSON.parse(atob(parts[1]));
      const now = Math.floor(Date.now() / 1000);

      return payload.exp > now;
    } catch {
      return false;
    }
  }

  // Provide context value
  const contextValue: AuthContextValue = {
    ...authState,
    login,
    logout,
    updateWalletAddress,
  };

  // Show loading state with telegram-ui components
  if (authState.isLoading) {
    const loadingElement = loadingComponent || (
      <Placeholder
        header="Authenticating"
        description="Please wait while we verify your Telegram identity..."
      >
        <Spinner size="l" />
      </Placeholder>
    );

    return <>{loadingElement}</>;
  }

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

// Export AuthContext for advanced usage
export { AuthContext };
