'use client';

import { type PropsWithChildren } from 'react';
import {
  init,
  miniApp,
  useLaunchParams,
  useSignal,
  backButton,
} from '@telegram-apps/sdk-react';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { AppRoot } from '@telegram-apps/telegram-ui';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorPage } from '@/components/ErrorPage';
import { useDidMount } from '@/hooks/useDidMount';
import { useBackButton } from '@/hooks/useBackButton';
import { TonProvider } from '@/components/wallet/TonProvider';
import { AuthProvider } from '@/components/Auth/AuthProvider';

import './styles.css';

// Initialize Telegram SDK
// This must be called before using any SDK features like cloudStorage
if (typeof window !== 'undefined') {
  init();
  backButton.mount();

  // Mount miniApp to initialize theme and background color
  if (miniApp.mountSync.isAvailable()) {
    miniApp.mountSync();
  }

  miniApp.setBackgroundColor('#000000');
  miniApp.setHeaderColor('#000000');
  miniApp.ready();
}

function RootInner({ children }: PropsWithChildren) {
  const lp = useLaunchParams();

  // Manage back button visibility and navigation
  useBackButton();

  // Construct absolute manifest URL
  const manifestUrl =
    'https://raw.githubusercontent.com/fetinin/tongi/refs/heads/master/public/tonconnect-manifest.json';

  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <AuthProvider
        loadingComponent={
          <div className="root__loading">Authenticating...</div>
        }
      >
        <TonProvider>
          <AppRoot
            appearance="light"
            platform={
              ['macos', 'ios'].includes(lp.tgWebAppPlatform) ? 'ios' : 'base'
            }
          >
            {children}
          </AppRoot>
        </TonProvider>
      </AuthProvider>
    </TonConnectUIProvider>
  );
}

export function Root(props: PropsWithChildren) {
  // Unfortunately, Telegram Mini Apps does not allow us to use all features of
  // the Server Side Rendering. That's why we are showing loader on the server
  // side.
  const didMount = useDidMount();

  return didMount ? (
    <ErrorBoundary fallback={ErrorPage}>
      <RootInner {...props} />
    </ErrorBoundary>
  ) : (
    <div className="root__loading">Loading...</div>
  );
}
