/**
 * WalletService - TON wallet management operations
 *
 * Provides wallet connection status and validation for the Corgi Buddy TON Mini-App.
 * Leverages UserService for database operations.
 *
 * Based on specs/005-mobile-first-onboarding/research.md
 */

import { userService, UserNotFoundError } from '@/services/UserService';
import { UserValidation } from '@/models/User';

/**
 * Custom error types for WalletService operations
 */
export class WalletServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'WalletServiceError';
  }
}

export class WalletValidationError extends WalletServiceError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

/**
 * Wallet status response
 */
export interface WalletStatus {
  connected: boolean;
  address: string | null;
}

/**
 * WalletService class providing wallet-related operations
 */
export class WalletService {
  private static instance: WalletService;

  private constructor() {
    // Singleton - uses UserService for database operations
  }

  /**
   * Singleton instance getter
   */
  public static getInstance(): WalletService {
    if (!WalletService.instance) {
      WalletService.instance = new WalletService();
    }
    return WalletService.instance;
  }

  /**
   * Get wallet connection status for a user
   *
   * @param userId - Telegram user ID
   * @returns Wallet status (connected and address)
   */
  public async getWalletStatus(userId: number): Promise<WalletStatus> {
    try {
      const user = await userService.getUserById(userId);
      if (!user) {
        throw new UserNotFoundError(userId);
      }

      return {
        connected: !!user.ton_wallet_address,
        address: user.ton_wallet_address,
      };
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        throw error;
      }
      throw new WalletServiceError(
        `Failed to get wallet status: ${error}`,
        'SERVICE_ERROR'
      );
    }
  }

  /**
   * Validate TON wallet address format
   *
   * @param address - TON wallet address to validate
   * @returns true if valid format
   * @throws WalletValidationError if invalid
   */
  public validateWalletAddress(address: string): boolean {
    if (!UserValidation.isValidTonAddress(address)) {
      throw new WalletValidationError('Invalid TON wallet address format');
    }
    return true;
  }

  /**
   * Check if user has a connected wallet
   *
   * @param userId - Telegram user ID
   * @returns true if wallet is connected
   */
  public async isWalletConnected(userId: number): Promise<boolean> {
    try {
      const status = await this.getWalletStatus(userId);
      return status.connected;
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        throw error;
      }
      throw new WalletServiceError(
        `Failed to check wallet connection: ${error}`,
        'SERVICE_ERROR'
      );
    }
  }
}

/**
 * Export singleton instance for convenience
 */
export const walletService = WalletService.getInstance();

/**
 * Export default singleton instance
 */
export default walletService;
