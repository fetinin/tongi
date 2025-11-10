/**
 * Onboarding Welcome Page - Wallet Connection Step (T014)
 *
 * First step of onboarding flow.
 * Displays wallet connection prompt and prevents access to rest of app
 * until wallet is connected.
 *
 * Based on specs/005-mobile-first-onboarding/plan.md
 */

'use client';

import { Root } from '@/components/Root/Root';
import { AuthProvider } from '@/components/Auth/AuthProvider';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { WelcomeScreen } from '@/components/onboarding/WelcomeScreen';
import { TonProvider } from '@/components/wallet/TonProvider';

export default function OnboardingWelcomePage() {
  return (
    <Root>
      <AuthProvider>
        <TonProvider>
          <OnboardingLayout title="Connect Your Wallet">
            <WelcomeScreen />
          </OnboardingLayout>
        </TonProvider>
      </AuthProvider>
    </Root>
  );
}
