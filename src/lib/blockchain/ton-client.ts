/**
 * TON Client Initialization
 *
 * Initializes and manages the TON blockchain client connection,
 * bank wallet contract, and related blockchain infrastructure.
 */

import { TonClient, WalletContractV4 } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';

export interface TONClientConfig {
  network: 'testnet' | 'mainnet';
  bankWalletMnemonic: string;
  apiKey?: string;
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
  private bankWallet: WalletContractV4 | null = null;
  private bankWalletAddress: string | null = null;

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
   */
  async initialize(config: TONClientConfig): Promise<void> {
    try {
      // Get TON network endpoint (use custom if provided, otherwise use default)
      const endpoint = config.endpoint || DEFAULT_ENDPOINTS[config.network];

      console.log(`[TON] Connecting to ${config.network} network: ${endpoint}`);

      // Create TonClient instance
      this.client = new TonClient({
        endpoint,
        apiKey: config.apiKey,
      });

      // Initialize bank wallet from mnemonic
      const mnemonic = config.bankWalletMnemonic.split(' ');
      if (mnemonic.length !== 24) {
        throw new Error(
          'Invalid mnemonic: must be 24 words. Please check TON_BANK_WALLET_MNEMONIC'
        );
      }

      const keyPair = await mnemonicToPrivateKey(mnemonic);
      this.bankWallet = WalletContractV4.create({
        publicKey: keyPair.publicKey,
        workchain: 0,
      });

      this.bankWalletAddress = this.bankWallet.address.toString({
        testOnly: config.network === 'testnet',
        bounceable: true,
      });

      console.log(`[TON] Bank wallet initialized: ${this.bankWalletAddress}`);
    } catch (error) {
      console.error('[TON] Failed to initialize TON client:', error);
      throw error;
    }
  }

  /**
   * Get initialized TON client
   * Throws if not initialized
   */
  getClient(): TonClient {
    if (!this.client) {
      throw new Error('TON Client not initialized. Call initialize() first.');
    }
    return this.client;
  }

  /**
   * Get bank wallet contract
   * Throws if not initialized
   */
  getBankWallet(): WalletContractV4 {
    if (!this.bankWallet) {
      throw new Error('Bank wallet not initialized. Call initialize() first.');
    }
    return this.bankWallet;
  }

  /**
   * Get bank wallet address
   * Throws if not initialized
   */
  getBankWalletAddress(): string {
    if (!this.bankWalletAddress) {
      throw new Error(
        'Bank wallet address not initialized. Call initialize() first.'
      );
    }
    return this.bankWalletAddress;
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
 * Environment variables:
 * - TON_NETWORK: 'testnet' or 'mainnet' (default: 'testnet')
 * - TON_BANK_WALLET_MNEMONIC: 24-word mnemonic for bank wallet
 * - TON_API_KEY: Optional API key for rate limiting
 * - TON_ENDPOINT: Optional custom endpoint URL (overrides default)
 */
export async function initializeTONClient(): Promise<void> {
  const network = (process.env.TON_NETWORK || 'testnet') as
    | 'testnet'
    | 'mainnet';
  const mnemonic = process.env.TON_BANK_WALLET_MNEMONIC;

  if (!mnemonic) {
    console.warn(
      '[TON] TON_BANK_WALLET_MNEMONIC not set. TON operations will be unavailable.'
    );
    return;
  }

  await tonClientManager.initialize({
    network,
    bankWalletMnemonic: mnemonic,
    apiKey: process.env.TON_API_KEY,
    endpoint: process.env.TON_ENDPOINT,
  });
}
