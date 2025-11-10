/**
 * Onboarding Types
 *
 * Type definitions for the mobile-first onboarding flow.
 * State is derived from existing database entities (users.ton_wallet_address, buddy_pairs).
 */

import type { UserProfile } from '@/models/User';

/**
 * Current onboarding step
 * - welcome: User needs to connect wallet
 * - buddy: Wallet connected, user needs to add buddy
 * - main: Both wallet and buddy confirmed, user can access main app
 */
export type OnboardingStep = 'welcome' | 'buddy' | 'main';

/**
 * Buddy relationship status
 * Maps to buddy_pairs.status from database (pending, active, dissolved)
 */
export type BuddyPairStatus = 'no_buddy' | 'pending' | 'active' | 'dissolved';

/**
 * Onboarding state derived from database
 * (NOT stored - computed from users.ton_wallet_address and buddy_pairs)
 */
export interface OnboardingState {
  wallet_connected: boolean;
  buddy_confirmed: boolean;
  current_step: OnboardingStep;
}

/**
 * Re-export User profile for convenience
 */
export type { UserProfile };

/**
 * Buddy relationship details in onboarding response
 */
export interface BuddyInfo {
  buddy_id: number; // User ID of the buddy
  status: BuddyPairStatus;
  profile?: UserProfile; // Optional - buddy's user profile
  createdAt?: string; // ISO date string
  confirmedAt?: string | null; // ISO date string
}

/**
 * Wallet connection details
 */
export interface WalletInfo {
  address: string | null;
}

/**
 * Complete onboarding status response
 * Returned by GET /api/onboarding/status
 */
export interface OnboardingStatusResponse {
  success: true;
  onboarding: OnboardingState;
  wallet?: WalletInfo;
  buddy?: BuddyInfo;
}

/**
 * Error response for onboarding operations
 */
export interface OnboardingErrorResponse {
  success: false;
  error: string;
  code: string;
}

/**
 * Type guard for buddy status
 * Returns true if buddy relationship is confirmed/active
 */
export function isBuddyConfirmed(status: BuddyPairStatus): boolean {
  return status === 'active';
}

/**
 * Type guard for wallet connection
 */
export function isWalletConnected(address: string | null | undefined): boolean {
  return !!address;
}
