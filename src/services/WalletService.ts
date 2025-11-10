import { getDatabase, withTransaction } from '@/lib/database';
import {
  UserValidationError,
  UserNotFoundError,
  UserConflictError,
} from '@/services/UserService';
import { normalizeTonAddress, validateTonAddress } from '@/lib/ton';

interface WalletStatus {
  connected: boolean;
  address: string | null;
}

export class WalletService {
  private static instance: WalletService;

  public static getInstance(): WalletService {
    if (!WalletService.instance) {
      WalletService.instance = new WalletService();
    }
    return WalletService.instance;
  }

  public validateWalletAddress(address: string): string {
    if (!validateTonAddress(address)) {
      throw new UserValidationError('Invalid TON wallet address format');
    }
    const normalized = normalizeTonAddress(address);
    if (!normalized) {
      throw new UserValidationError('Invalid TON wallet address format');
    }
    return normalized;
  }

  public getWalletStatus(userId: number): WalletStatus {
    const db = getDatabase();
    const row = db
      .prepare(
        `SELECT ton_wallet_address
         FROM users
         WHERE id = ?`
      )
      .get(userId) as { ton_wallet_address: string | null } | undefined;

    if (!row) {
      throw new UserNotFoundError(userId);
    }

    return {
      connected: row.ton_wallet_address !== null,
      address: row.ton_wallet_address,
    };
  }

  public updateWallet(userId: number, rawAddress: string): WalletStatus {
    const normalizedAddress = this.validateWalletAddress(rawAddress);

    return withTransaction(() => {
      const db = getDatabase();

      const userRow = db
        .prepare('SELECT id FROM users WHERE id = ?')
        .get(userId) as { id: number } | undefined;

      if (!userRow) {
        throw new UserNotFoundError(userId);
      }

      const existing = db
        .prepare(
          `SELECT id
           FROM users
           WHERE ton_wallet_address = ? AND id != ?`
        )
        .get(normalizedAddress, userId) as { id: number } | undefined;

      if (existing) {
        db.prepare(
          'UPDATE users SET ton_wallet_address = NULL WHERE id = ?'
        ).run(existing.id);
      }

      try {
        db.prepare('UPDATE users SET ton_wallet_address = ? WHERE id = ?').run(
          normalizedAddress,
          userId
        );
      } catch (error) {
        throw new UserConflictError(
          'Failed to update wallet; address may be linked elsewhere'
        );
      }

      return this.getWalletStatus(userId);
    });
  }

  public clearWallet(userId: number): WalletStatus {
    return withTransaction(() => {
      const db = getDatabase();

      const userRow = db
        .prepare('SELECT id FROM users WHERE id = ?')
        .get(userId) as { id: number } | undefined;

      if (!userRow) {
        throw new UserNotFoundError(userId);
      }

      db.prepare('UPDATE users SET ton_wallet_address = NULL WHERE id = ?').run(
        userId
      );

      return this.getWalletStatus(userId);
    });
  }
}

export const walletService = WalletService.getInstance();

export default walletService;
