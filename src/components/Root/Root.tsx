'use client';

import { type PropsWithChildren, useEffect } from 'react';
import {
  init,
  initData,
  miniApp,
  useLaunchParams,
  useSignal,
  backButton,
} from '@telegram-apps/sdk-react';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { AppRoot } from '@telegram-apps/telegram-ui';
import { NextIntlClientProvider } from 'next-intl';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorPage } from '@/components/ErrorPage';
import { useDidMount } from '@/hooks/useDidMount';
import { useBackButton } from '@/hooks/useBackButton';
import { setLocale } from '@/core/i18n/locale';
import { getMessages, resolveLocale } from '@/core/i18n/config';
import type { Locale } from '@/core/i18n/types';
import { TonProvider } from '@/components/wallet/TonProvider';

import './styles.css';

// Initialize Telegram SDK
// This must be called before using any SDK features like cloudStorage
if (typeof window !== 'undefined') {
  const permissions = navigator.permissions as
    | (Permissions & { __tongiDeviceOrientationPatched?: boolean })
    | undefined;

  if (
    permissions &&
    typeof permissions.query === 'function' &&
    !permissions.__tongiDeviceOrientationPatched
  ) {
    const originalQuery = permissions.query.bind(permissions);
    const unsupportedStatus = {
      name: 'device-orientation' as PermissionName,
      state: 'denied' as PermissionState,
      onchange: null as PermissionStatus['onchange'],
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    } as PermissionStatus;

    permissions.query = ((descriptor: PermissionDescriptor | PermissionName) => {
      const name =
        typeof descriptor === 'string'
          ? descriptor
          : descriptor && typeof descriptor === 'object' && 'name' in descriptor
            ? String(
                (descriptor as {
                  name?: PermissionName | string | null | undefined;
                }).name
              )
            : undefined;

      if (name === 'device-orientation') {
        return Promise.resolve(unsupportedStatus);
      }

      return originalQuery(descriptor as PermissionDescriptor);
    }) as typeof permissions.query;

    permissions.__tongiDeviceOrientationPatched = true;
  }

  init();
  backButton.mount();
}

function RootInner({ children }: PropsWithChildren) {
  const lp = useLaunchParams();

  const isDark = useSignal(miniApp.isDark);
  const initDataUser = useSignal(initData.user);

  // Manage back button visibility and navigation
  useBackButton();

  // Set the user locale based on Telegram user data
  useEffect(() => {
    const resolved = resolveLocale(initDataUser?.language_code ?? undefined);
    void setLocale(resolved);
  }, [initDataUser]);

  const locale: Locale = resolveLocale(
    initDataUser?.language_code ?? undefined
  );
  const messages = getMessages(locale);

  // Construct absolute manifest URL
  const manifestUrl =
    'https://raw.githubusercontent.com/fetinin/tongi/refs/heads/master/public/tonconnect-manifest.json';

  return (
    <NextIntlClientProvider key={locale} locale={locale} messages={messages}>
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
    </NextIntlClientProvider>
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
