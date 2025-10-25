/**
 * Jetton Transfer Message Builder
 *
 * Builds, signs, and broadcasts TEP-74 Jetton transfer transactions
 * from the bank wallet to user wallets.
 */

import { Address, beginCell, internal, SendMode, toNano } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { tonClientManager } from './ton-client';
import { JETTON_OP_CODES } from '@/types/jetton';
import type {
  JettonTransferParams,
  JettonTransferBroadcastResult,
} from '@/types/jetton';

/**
 * Build a TEP-74 compliant Jetton transfer message body
 *
 * Creates the transfer message body with opcode 0xf8a7ea5 and required parameters.
 *
 * @param params - Jetton transfer parameters
 * @returns Cell containing the transfer body
 */
export async function buildJettonTransferBody(params: JettonTransferParams) {
  const {
    destination,
    amount,
    queryId = 0,
    forwardAmount = BigInt(1), // 1 nanoton for notification
  } = params;

  const destinationAddr = Address.parse(destination);
  const bankAddr = Address.parse(await tonClientManager.getBankWalletAddress());

  // TEP-74 Jetton transfer message structure
  return beginCell()
    .storeUint(JETTON_OP_CODES.TRANSFER, 32) // Opcode: 0xf8a7ea5
    .storeUint(queryId, 64) // Query ID for tracking
    .storeCoins(amount) // Amount in smallest units
    .storeAddress(destinationAddr) // Destination TON wallet
    .storeAddress(bankAddr) // Response address (for refunds)
    .storeUint(0, 1) // No custom_payload
    .storeCoins(forwardAmount) // Forward amount (notification)
    .storeBit(0) // No forward_payload
    .endCell();
}

/**
 * Sign and broadcast a Jetton transfer transaction
 *
 * Builds the transfer message, signs it with the bank wallet's private key,
 * and broadcasts it to the TON blockchain.
 *
 * @param params - Jetton transfer parameters
 * @returns Broadcast result with transaction hash and seqno
 * @throws Error if signing or broadcasting fails
 */
export async function broadcastJettonTransfer(
  params: JettonTransferParams
): Promise<JettonTransferBroadcastResult> {
  try {
    const client = await tonClientManager.getClient();
    const bankWallet = await tonClientManager.getBankWallet();

    // Get bank wallet mnemonic from environment
    const mnemonic = process.env.TON_BANK_WALLET_MNEMONIC;
    if (!mnemonic) {
      throw new Error('TON_BANK_WALLET_MNEMONIC not configured');
    }

    // Get key pair from mnemonic
    const keyPair = await mnemonicToPrivateKey(mnemonic.split(' '));

    // Get current sequence number using contract provider
    const seqno = await client.open(bankWallet).getSeqno();

    // Build transfer body
    const transferBody = await buildJettonTransferBody(params);

    // Create internal message to Jetton wallet contract
    const senderJettonWalletAddr = Address.parse(params.senderJettonWallet);

    // Send transaction (0.05 TON gas for Jetton transfer)
    const transfer = bankWallet.createTransfer({
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      secretKey: keyPair.secretKey,
      seqno,
      messages: [
        internal({
          to: senderJettonWalletAddr,
          value: toNano('0.05'), // Gas fee
          body: transferBody,
          bounce: true, // Return on failure
        }),
      ],
    });

    await client.sendExternalMessage(bankWallet, transfer);

    // Note: Transaction hash is generated from seqno and timestamp
    // Actual blockchain hash will be available after confirmation
    const txHash = `pending-${Date.now()}-${seqno}`;

    return {
      transactionHash: txHash,
      seqNo: seqno,
      fromAddress: await tonClientManager.getBankWalletAddress(),
      toAddress: params.destination,
      amount: params.amount,
      timestamp: new Date(),
    };
  } catch (error) {
    console.error('[Jetton] Failed to broadcast transfer:', error);
    throw new Error(
      `Failed to broadcast Jetton transfer: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Verify if a transaction was successfully broadcast by checking seqno change
 *
 * This is critical for retry logic: if seqno changed, the transaction was
 * broadcast even if we received an error response.
 *
 * @param expectedSeqno - Sequence number we expected to use
 * @returns Object with current seqno and whether it changed
 */
export async function checkSeqnoChanged(expectedSeqno: number): Promise<{
  currentSeqno: number;
  hasChanged: boolean;
}> {
  try {
    const client = await tonClientManager.getClient();
    const bankWallet = await tonClientManager.getBankWallet();

    const currentSeqno = await client.open(bankWallet).getSeqno();

    return {
      currentSeqno,
      hasChanged: currentSeqno > expectedSeqno,
    };
  } catch (error) {
    console.error('[Jetton] Failed to check seqno:', error);
    // If we can't check seqno, assume it didn't change (safe default for retry)
    return {
      currentSeqno: expectedSeqno,
      hasChanged: false,
    };
  }
}
