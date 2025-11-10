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

import './styles.css';

// Initialize Telegram SDK
// This must be called before using any SDK features like cloudStorage
if (typeof window !== 'undefined') {
  init();
  backButton.mount();
}

function RootInner({ children }: PropsWithChildren) {
  const lp = useLaunchParams();

  const isDark = useSignal(miniApp.isDark);

  // Manage back button visibility and navigation
  useBackButton();

  // Construct absolute manifest URL
  const manifestUrl =
    'https://raw.githubusercontent.com/fetinin/tongi/refs/heads/master/public/tonconnect-manifest.json';

  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <TonProvider>
        <AppRoot
          appearance={isDark ? 'dark' : 'light'}
          platform={
            ['macos', 'ios'].includes(lp.tgWebAppPlatform) ? 'ios' : 'base'
          }
        >
          {children}
        </AppRoot>
      </TonProvider>
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
