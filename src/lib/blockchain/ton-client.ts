/**
 * TON Client Initialization
 *
 * Initializes and manages the TON blockchain client connection,
 * bank wallet contract, and related blockchain infrastructure.
 */

import { TonClient, WalletContractV5R1 } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';

export interface TONClientConfig {
  network: 'testnet' | 'mainnet';
  bankWalletMnemonic: string;
  endpoint?: string; // Custom endpoint (overrides default)
}

/**
 * Default TON network endpoints
 * Can be overridden via config or environment variables
 */
const DEFAULT_ENDPOINTS: Record<'testnet' | 'mainnet', string> = {
  mainnet: 'https://toncenter.com/api/v2/jsonRPC',
  testnet: 'https://testnet.toncenter.com/api/v2/jsonRPC',
};

class TONClientManager {
  private static instance: TONClientManager;
  private client: TonClient | null = null;
  private bankWallet: WalletContractV5R1 | null = null;
  private bankWalletAddress: string | null = null;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): TONClientManager {
    if (!TONClientManager.instance) {
      TONClientManager.instance = new TONClientManager();
    }
    return TONClientManager.instance;
  }

  /**
   * Initialize TON client with configuration
   * This should be called once during application startup
   * Idempotent: safe to call multiple times
   */
  async initialize(config: TONClientConfig): Promise<void> {
    // If already initialized, skip
    if (this.isInitialized()) {
      return;
    }

    // If initialization is in progress, wait for it
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Start initialization
    this.initializationPromise = this._doInitialize(config);
    await this.initializationPromise;
    this.initializationPromise = null;
  }

  /**
   * Internal initialization logic
   */
  private async _doInitialize(config: TONClientConfig): Promise<void> {
    try {
      // Get TON network endpoint (use custom if provided, otherwise use default)
      const endpoint = config.endpoint || DEFAULT_ENDPOINTS[config.network];

      // Create TonClient instance
      this.client = new TonClient({
        endpoint,
      });

      // Initialize bank wallet from mnemonic
      const mnemonic = config.bankWalletMnemonic.split(' ');
      if (mnemonic.length !== 24) {
        throw new Error(
          'Invalid mnemonic: must be 24 words. Please check TON_BANK_WALLET_MNEMONIC'
        );
      }

      const keyPair = await mnemonicToPrivateKey(mnemonic);

      // V5R1 wallets require walletId with networkGlobalId to match TonKeeper
      // -3 for testnet, -239 for mainnet
      const networkGlobalId = config.network === 'testnet' ? -3 : -239;

      this.bankWallet = WalletContractV5R1.create({
        publicKey: keyPair.publicKey,
        workchain: 0,
        walletId: {
          networkGlobalId,
        },
      });

      this.bankWalletAddress = this.bankWallet.address.toString({
        testOnly: config.network === 'testnet',
        bounceable: true,
      });
    } catch (error) {
      console.error('[TON] Failed to initialize TON client:', error);
      // Reset state on failure
      this.client = null;
      this.bankWallet = null;
      this.bankWalletAddress = null;
      throw error;
    }
  }

  /**
   * Ensure TON client is initialized (lazy initialization)
   * Automatically initializes from environment if not already initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized()) {
      return;
    }

    // If initialization is in progress, wait for it
    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    // Auto-initialize from environment variables
    const network = (process.env.TON_NETWORK || 'testnet') as
      | 'testnet'
      | 'mainnet';
    const mnemonic = process.env.TON_BANK_WALLET_MNEMONIC;

    if (!mnemonic) {
      throw new Error(
        'TON_BANK_WALLET_MNEMONIC is required but not set in environment variables. ' +
          'Please configure this environment variable to enable TON operations.'
      );
    }

    await this.initialize({
      network,
      bankWalletMnemonic: mnemonic,
      endpoint: process.env.TON_ENDPOINT,
    });
  }

  /**
   * Get initialized TON client
   * Auto-initializes if not already initialized
   */
  async getClient(): Promise<TonClient> {
    await this.ensureInitialized();
    return this.client!;
  }

  /**
   * Get bank wallet contract
   * Auto-initializes if not already initialized
   */
  async getBankWallet(): Promise<WalletContractV5R1> {
    await this.ensureInitialized();
    return this.bankWallet!;
  }

  /**
   * Get bank wallet address
   * Auto-initializes if not already initialized
   */
  async getBankWalletAddress(): Promise<string> {
    await this.ensureInitialized();
    return this.bankWalletAddress!;
  }

  /**
   * Check if client is initialized
   */
  isInitialized(): boolean {
    return this.client !== null && this.bankWallet !== null;
  }

  /**
   * Close client connection
   */
  close(): void {
    if (this.client) {
      // TonClient doesn't have explicit close, but we can reset state
      this.client = null;
      this.bankWallet = null;
      this.bankWalletAddress = null;
    }
  }
}

export const tonClientManager = TONClientManager.getInstance();

/**
 * Ensure TON client is initialized
 * Use this in API routes that need blockchain access
 */
export function ensureTONClientInitialized(): void {
  if (!tonClientManager.isInitialized()) {
    throw new Error(
      'TON client not initialized. Check environment variables and server startup.'
    );
  }
}

/**
 * Initialize TON client from environment variables
 * Call this during application startup (e.g., in root layout or API middleware)
 *
 * CRITICAL: This function throws an error if TON_BANK_WALLET_MNEMONIC is not set,
 * preventing the application from starting in a broken state.
 *
 * Environment variables:
 * - TON_NETWORK: 'testnet' or 'mainnet' (default: 'testnet')
 * - TON_BANK_WALLET_MNEMONIC: 24-word mnemonic for bank wallet (REQUIRED)
 * - TON_ENDPOINT: Optional custom endpoint URL (overrides default)
 */
export async function initializeTONClient(): Promise<void> {
  const network = (process.env.TON_NETWORK || 'testnet') as
    | 'testnet'
    | 'mainnet';
  const mnemonic = process.env.TON_BANK_WALLET_MNEMONIC;

  if (!mnemonic) {
    throw new Error(
      'TON_BANK_WALLET_MNEMONIC is required but not set in environment variables. ' +
        'Please configure this environment variable to enable TON operations.'
    );
  }

  await tonClientManager.initialize({
    network,
    bankWalletMnemonic: mnemonic,
    endpoint: process.env.TON_ENDPOINT,
  });
}
