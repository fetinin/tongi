'use client';

import { type PropsWithChildren, useEffect } from 'react';
import {
  init,
  initData,
  miniApp,
  useLaunchParams,
  useSignal,
} from '@telegram-apps/sdk-react';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { AppRoot } from '@telegram-apps/telegram-ui';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorPage } from '@/components/ErrorPage';
import { useDidMount } from '@/hooks/useDidMount';
import { setLocale } from '@/core/i18n/locale';
import { TonProvider } from '@/components/wallet/TonProvider';

import './styles.css';

// Initialize Telegram SDK
// This must be called before using any SDK features like cloudStorage
if (typeof window !== 'undefined') {
  init();
}

function RootInner({ children }: PropsWithChildren) {
  const lp = useLaunchParams();

  const isDark = useSignal(miniApp.isDark);
  const initDataUser = useSignal(initData.user);

  // Set the user locale based on Telegram user data
  useEffect(() => {
    if (initDataUser) {
      setLocale(initDataUser.language_code);
    }
  }, [initDataUser]);

  // Construct absolute manifest URL
  const manifestUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/tonconnect-manifest.json`
      : 'https://tongi.loca.lt/tonconnect-manifest.json';

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
