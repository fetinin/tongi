/**
 * Onboarding Types
 *
 * Shared interfaces and enums for representing onboarding state
 * across services, API handlers, and client components.
 */

export type OnboardingStep = 'welcome' | 'buddy' | 'complete';

export interface OnboardingState {
  wallet_connected: boolean;
  buddy_confirmed: boolean;
  current_step: OnboardingStep;
}

export interface OnboardingWalletInfo {
  address: string | null;
}

export type OnboardingBuddyStatus = 'pending' | 'confirmed' | 'rejected';

export interface OnboardingBuddyProfile {
  id: number;
  displayName: string;
  username: string | null;
  hasWallet: boolean;
  memberSince: string;
}

export interface OnboardingBuddyInfo {
  id: number;
  status: OnboardingBuddyStatus;
  profile: OnboardingBuddyProfile;
  createdAt: string;
  confirmedAt: string | null;
  initiatedBy?: number;
}

export interface OnboardingStatusResponse {
  success: true;
  onboarding: OnboardingState;
  wallet?: OnboardingWalletInfo;
  buddy?: OnboardingBuddyInfo;
}

export interface OnboardingErrorResponse {
  success: false;
  error: string;
  code: string;
}

export type OnboardingApiResponse =
  | OnboardingStatusResponse
  | OnboardingErrorResponse;

export type OnboardingErrorType =
  | 'network'
  | 'validation_failed'
  | 'unauthorized';

export interface OnboardingErrorState {
  type: OnboardingErrorType;
  message: string;
  retryable: boolean;
}

export interface GuardRedirectMap {
  welcome: string;
  buddy: string;
  complete: string;
}
