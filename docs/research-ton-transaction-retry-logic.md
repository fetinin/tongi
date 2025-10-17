# Research: TON Blockchain Transaction Retry Logic Best Practices

**Date**: 2025-10-16
**Status**: Complete
**Context**: Server-side reward transaction implementation for Corgi Buddy app

## Executive Summary

Based on comprehensive research of TON blockchain documentation, SDK capabilities, and general distributed systems best practices, this document provides specific recommendations for implementing retry logic when broadcasting reward transactions from the bank wallet to user wallets.

**Key Finding**: TON blockchain has NO built-in retry mechanism in its SDK. You must implement custom retry logic with careful consideration of seqno (sequence number) handling to prevent transaction replay or skipping.

## 1. Recommended Exponential Backoff Pattern

### Configuration

```typescript
interface RetryConfig {
  maxAttempts: 3;
  initialDelayMs: 2000;    // 2 seconds
  multiplier: 2;           // Exponential factor
  maxDelayMs: 30000;       // 30 seconds cap
  jitter: true;            // Add randomization
}
```

### Timing Pattern

| Attempt | Base Delay | With Jitter Range | Total Wait Time |
|---------|------------|-------------------|-----------------|
| 1       | 2000ms     | 1800-2200ms      | ~2s             |
| 2       | 4000ms     | 3600-4400ms      | ~6s             |
| 3       | 8000ms     | 7200-8800ms      | ~14s            |

### Rationale

**Initial Delay (2 seconds)**:
- TON block time is ~5 seconds, so 2s gives the network time to process
- Not too aggressive to avoid overwhelming validators
- Allows temporary network hiccups to resolve

**Multiplier (2x)**:
- Standard exponential backoff proven in distributed systems
- Balances retry speed with network consideration
- Documented in TON community examples

**Max Attempts (3)**:
- Prevents infinite retry loops
- Most transient issues resolve within 3 attempts
- After 3 failures, likely a persistent problem requiring manual intervention
- Total retry window: ~14 seconds (acceptable for reward UX)

**Jitter (±10%)**:
- Prevents thundering herd when multiple transactions fail simultaneously
- Recommended by AWS, Google Cloud, and general best practices
- Small percentage (10%) maintains predictability

**Max Delay Cap (30s)**:
- Prevents exponentially growing delays from degrading UX
- User shouldn't wait indefinitely for reward confirmation
- Aligns with typical HTTP timeout configurations

### Implementation

```typescript
async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable (see section 2)
      if (!isRetryableError(lastError)) {
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const baseDelay = Math.min(
        config.initialDelayMs * Math.pow(config.multiplier, attempt),
        config.maxDelayMs
      );

      // Add jitter (±10%)
      const jitter = config.jitter
        ? baseDelay * (0.9 + Math.random() * 0.2)
        : baseDelay;

      // Wait before retry (unless last attempt)
      if (attempt < config.maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, jitter));
      }
    }
  }

  throw lastError;
}
```

## 2. Error Classification: Retryable vs Non-Retryable

### Retryable Errors (Should Retry)

**Network/Connectivity Issues**:
```typescript
- ECONNREFUSED      // Connection refused
- ECONNRESET        // Connection reset by peer
- ETIMEDOUT         // Request timeout
- ENOTFOUND         // DNS lookup failed
- Network error     // Generic network failure
```

**Transient TON-Specific Errors**:
```typescript
- "Transaction not accepted" // Validator busy
- "Server error" (5xx)       // TON API server issues
- "Lite server timeout"      // Lite client timeout
- "Block not found"          // Blockchain sync lag
- Rate limit (429)           // Too many requests (wait and retry)
```

**Blockchain State Issues**:
```typescript
- "Cannot get account state"  // Temporary sync issue
- "Account not found"         // May appear during sync
- Exit code 13: "Out of gas"  // May succeed with higher gas
```

### Non-Retryable Errors (Fail Immediately)

**Validation Errors**:
```typescript
- Exit code 33: Invalid seqno      // Sequence number mismatch
- Exit code 34: Invalid subwallet  // Wrong wallet ID
- Exit code 35: Message expired    // Past valid_until time
- Invalid signature                // Crypto validation failed
- Invalid address format           // Malformed recipient address
```

**Business Logic Errors**:
```typescript
- Exit code 0x100+: Insufficient funds  // Bank wallet empty
- "Destination wallet not initialized"  // Recipient has no wallet
- "Amount too small"                    // Below minimum transfer
```

**Authorization Errors**:
```typescript
- Authentication failed             // Wrong private key
- Permission denied                 // Access control issue
```

### Error Classification Helper

```typescript
interface ErrorClassification {
  isRetryable: boolean;
  reason: string;
  action: 'retry' | 'fail' | 'manual_review';
}

function classifyTransactionError(error: unknown): ErrorClassification {
  const errorMsg = error instanceof Error ? error.message : String(error);
  const errorCode = (error as any)?.code;
  const exitCode = (error as any)?.exitCode;

  // Network errors - always retryable
  const networkErrors = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'];
  if (networkErrors.includes(errorCode)) {
    return {
      isRetryable: true,
      reason: 'Network connectivity issue',
      action: 'retry'
    };
  }

  // TON exit codes - check specifics
  if (exitCode !== undefined) {
    // Validation errors - not retryable
    if ([33, 34, 35].includes(exitCode)) {
      return {
        isRetryable: false,
        reason: `Validation error (exit code ${exitCode})`,
        action: 'fail'
      };
    }

    // Insufficient funds - not retryable, needs manual fix
    if (exitCode >= 0x100 && exitCode < 0x200) {
      return {
        isRetryable: false,
        reason: 'Insufficient funds in bank wallet',
        action: 'manual_review'
      };
    }

    // Out of gas - retryable with adjustment
    if (exitCode === 13) {
      return {
        isRetryable: true,
        reason: 'Out of gas, may succeed with retry',
        action: 'retry'
      };
    }
  }

  // Server errors - retryable
  if (errorMsg.includes('Server error') || errorMsg.includes('5xx')) {
    return {
      isRetryable: true,
      reason: 'TON API server error',
      action: 'retry'
    };
  }

  // Rate limiting - retryable
  if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
    return {
      isRetryable: true,
      reason: 'Rate limited, backing off',
      action: 'retry'
    };
  }

  // Timeout - retryable
  if (errorMsg.toLowerCase().includes('timeout')) {
    return {
      isRetryable: true,
      reason: 'Request timeout',
      action: 'retry'
    };
  }

  // Address/validation issues - not retryable
  if (errorMsg.includes('Invalid address') || errorMsg.includes('Invalid signature')) {
    return {
      isRetryable: false,
      reason: 'Validation error',
      action: 'fail'
    };
  }

  // Default: assume transient issue, allow retry
  return {
    isRetryable: true,
    reason: 'Unknown error, assuming transient',
    action: 'retry'
  };
}

function isRetryableError(error: Error): boolean {
  return classifyTransactionError(error).isRetryable;
}
```

## 3. Database Retry Tracking

### Schema Enhancement

Add retry tracking to `transactions` table:

```sql
ALTER TABLE transactions ADD COLUMN retry_count INTEGER DEFAULT 0;
ALTER TABLE transactions ADD COLUMN last_retry_at DATETIME;
ALTER TABLE transactions ADD COLUMN last_error TEXT;
```

### Update Transaction Model

```typescript
// src/models/Transaction.ts

export interface Transaction {
  // ... existing fields ...
  retry_count: number;
  last_retry_at: Date | null;
  last_error: string | null;
}

export interface UpdateTransactionInput {
  // ... existing fields ...
  retry_count?: number;
  last_retry_at?: Date;
  last_error?: string;
}
```

### Tracking Pattern

```typescript
async function sendTransactionWithRetry(
  transactionId: number,
  recipientAddress: string,
  amount: number
): Promise<string> {
  const config: RetryConfig = {
    maxAttempts: 3,
    initialDelayMs: 2000,
    multiplier: 2,
    maxDelayMs: 30000,
    jitter: true
  };

  let currentAttempt = 0;

  const sendFn = async (): Promise<string> => {
    currentAttempt++;

    try {
      // Update retry metadata
      await transactionService.updateTransaction(transactionId, {
        retry_count: currentAttempt,
        last_retry_at: new Date(),
        status: TransactionStatus.PENDING
      });

      // Attempt blockchain broadcast
      const txHash = await tonBlockchainService.sendTransaction(
        recipientAddress,
        amount
      );

      return txHash;

    } catch (error) {
      // Log error details
      await transactionService.updateTransaction(transactionId, {
        retry_count: currentAttempt,
        last_retry_at: new Date(),
        last_error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
  };

  try {
    return await retryWithExponentialBackoff(sendFn, config);
  } catch (error) {
    // All retries exhausted - mark as failed
    await transactionService.updateTransaction(transactionId, {
      status: TransactionStatus.FAILED,
      completed_at: new Date()
    });

    throw error;
  }
}
```

### Monitoring Query

```sql
-- Find transactions stuck in retry loop
SELECT
  id,
  retry_count,
  last_retry_at,
  last_error,
  created_at
FROM transactions
WHERE status = 'pending'
  AND retry_count >= 2
ORDER BY last_retry_at DESC;
```

## 4. Seqno (Sequence Number) Handling

### Critical Understanding

**TON Wallet Sequence Numbers**:
- Every wallet has a `seqno` (sequence number) counter
- Each transaction increments seqno by 1
- Transactions MUST be processed sequentially (seqno 10, then 11, then 12...)
- If seqno doesn't match, contract throws exit code 33
- **Gap in sequence = all subsequent transactions blocked**

### The Retry Challenge

```
Scenario: Transaction broadcast succeeds but network error received

1. Client sends transaction with seqno=10
2. Blockchain receives and processes transaction
3. Seqno increments to 11
4. Network error prevents response from reaching client
5. Client thinks transaction failed, retries with seqno=10
6. Result: Exit code 33 (seqno mismatch) - transaction rejected
```

### Solution: Query Seqno Before Retry

```typescript
async function getWalletSeqno(walletAddress: string): Promise<number> {
  const client = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.TON_API_KEY
  });

  const address = Address.parse(walletAddress);

  try {
    const result = await client.runMethod(address, 'seqno');
    return result.stack.readNumber();
  } catch (error) {
    // If wallet not initialized, seqno = 0
    return 0;
  }
}

async function sendTransactionWithSeqnoCheck(
  walletAddress: string,
  recipientAddress: string,
  amount: number
): Promise<string> {
  let expectedSeqno = await getWalletSeqno(walletAddress);

  const config: RetryConfig = { /* ... */ };

  return retryWithExponentialBackoff(async () => {
    // ALWAYS fetch current seqno before sending
    const currentSeqno = await getWalletSeqno(walletAddress);

    // Check if previous attempt may have succeeded
    if (currentSeqno > expectedSeqno) {
      console.warn(
        `Seqno advanced from ${expectedSeqno} to ${currentSeqno}. ` +
        `Previous transaction may have succeeded despite error response.`
      );

      // Verify if our transaction is in recent history
      const wasSuccessful = await verifyTransactionWasSent(
        walletAddress,
        recipientAddress,
        amount
      );

      if (wasSuccessful) {
        throw new Error('TRANSACTION_ALREADY_SENT');
      }
    }

    // Use current seqno for this attempt
    expectedSeqno = currentSeqno;

    // Build and send transaction
    const txHash = await buildAndSendTransaction(
      walletAddress,
      recipientAddress,
      amount,
      currentSeqno
    );

    return txHash;

  }, config);
}
```

### Database Seqno Tracking

```typescript
// Store expected seqno with transaction
interface TransactionMetadata {
  expected_seqno: number;
  actual_seqno_at_creation: number;
  seqno_at_last_check: number;
}

// After each retry, log seqno state
await transactionService.updateTransaction(transactionId, {
  retry_count: currentAttempt,
  metadata: JSON.stringify({
    expected_seqno: expectedSeqno,
    actual_seqno_at_creation: initialSeqno,
    seqno_at_last_check: currentSeqno
  })
});
```

## 5. Transaction Verification Despite Error Response

### The Problem

TON blockchain operates asynchronously:
1. Lite client broadcasts message to validators
2. Client receives "broadcasted" status (NOT "completed")
3. Validators process transaction over next 5-30 seconds
4. Network error can occur before confirmation

**Result**: Transaction may succeed on blockchain even if client receives error.

### Solution: Verify by Blockchain State

```typescript
/**
 * Check if transaction was actually broadcast successfully
 * despite receiving an error response
 */
async function verifyTransactionWasSent(
  fromAddress: string,
  toAddress: string,
  amount: number,
  maxAgeSeconds: number = 60
): Promise<boolean> {
  const client = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.TON_API_KEY
  });

  try {
    // Fetch recent transactions from sender's wallet
    const transactions = await client.getTransactions(
      Address.parse(fromAddress),
      { limit: 10 }  // Check last 10 transactions
    );

    const cutoffTime = Date.now() - (maxAgeSeconds * 1000);

    for (const tx of transactions) {
      // Skip external messages (not our internal transfers)
      if (tx.inMessage?.info.type !== 'internal') continue;

      // Check transaction age
      const txTime = tx.now * 1000; // Convert to milliseconds
      if (txTime < cutoffTime) continue;

      // Extract transaction details
      const destAddress = tx.outMessages.items[0]?.info.dest?.toString();
      const txAmount = tx.outMessages.items[0]?.info.value.coins;

      // Convert amount to nanotons for comparison
      const expectedNanotons = BigInt(Math.floor(amount * 1e9));

      // Check if matches our transaction
      if (
        destAddress === toAddress &&
        txAmount === expectedNanotons
      ) {
        console.log(`Found matching transaction: ${tx.hash().toString('hex')}`);
        return true;
      }
    }

    return false;

  } catch (error) {
    console.error('Failed to verify transaction:', error);
    // If verification fails, assume not sent (safer to retry)
    return false;
  }
}

/**
 * Alternative: Verify by checking recipient's balance change
 */
async function verifyByBalanceChange(
  recipientAddress: string,
  expectedAmount: number,
  previousBalance: bigint
): Promise<boolean> {
  const client = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.TON_API_KEY
  });

  try {
    const address = Address.parse(recipientAddress);
    const currentBalance = await client.getBalance(address);

    const expectedIncrease = BigInt(Math.floor(expectedAmount * 1e9));
    const actualIncrease = currentBalance - previousBalance;

    // Allow small tolerance for gas fees
    const tolerance = BigInt(1e7); // 0.01 TON
    const difference = actualIncrease - expectedIncrease;

    return difference >= -tolerance && difference <= tolerance;

  } catch (error) {
    console.error('Failed to check balance:', error);
    return false;
  }
}
```

### Integration with Retry Logic

```typescript
async function sendTransactionWithVerification(
  transactionId: number,
  fromAddress: string,
  toAddress: string,
  amount: number
): Promise<string> {
  let txHash: string | null = null;

  const config: RetryConfig = { maxAttempts: 3, /* ... */ };

  return retryWithExponentialBackoff(async () => {
    try {
      // Attempt to send transaction
      txHash = await tonBlockchainService.sendTransaction(
        toAddress,
        amount
      );

      return txHash;

    } catch (error) {
      // Before retrying, check if transaction actually succeeded
      const wasActuallySent = await verifyTransactionWasSent(
        fromAddress,
        toAddress,
        amount
      );

      if (wasActuallySent) {
        // Transaction succeeded despite error response!
        console.warn(
          `Transaction ${transactionId} succeeded despite error. ` +
          `Marking as completed.`
        );

        // Find the transaction hash from blockchain
        const foundTxHash = await findTransactionHash(
          fromAddress,
          toAddress,
          amount
        );

        return foundTxHash;
      }

      // Transaction truly failed, propagate error for retry
      throw error;
    }
  }, config);
}

/**
 * Extract transaction hash from recent transactions
 */
async function findTransactionHash(
  fromAddress: string,
  toAddress: string,
  amount: number
): Promise<string> {
  const client = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.TON_API_KEY
  });

  const transactions = await client.getTransactions(
    Address.parse(fromAddress),
    { limit: 10 }
  );

  const expectedNanotons = BigInt(Math.floor(amount * 1e9));

  for (const tx of transactions) {
    const destAddress = tx.outMessages.items[0]?.info.dest?.toString();
    const txAmount = tx.outMessages.items[0]?.info.value.coins;

    if (destAddress === toAddress && txAmount === expectedNanotons) {
      return tx.hash().toString('hex');
    }
  }

  throw new Error('Transaction hash not found in recent history');
}
```

## 6. TON SDK Built-in Retry Mechanisms

### Finding: NO Built-in Retry

After researching TON SDK documentation and community examples:

**`@ton/ton` SDK**: ❌ No automatic retry mechanism
**`@ton/core` SDK**: ❌ No automatic retry mechanism
**`tonweb` SDK**: ❌ No automatic retry mechanism
**TON Connect**: ❌ No automatic retry (user-initiated only)

### Community Retry Pattern

The official TON documentation provides a simple retry helper:

```typescript
// From: https://docs.ton.org/develop/dapps/cookbook
export async function retry<T>(
  fn: () => Promise<T>,
  options: { retries: number, delay: number }
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < options.retries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof Error) {
        lastError = e;
      }
      await new Promise(resolve => setTimeout(resolve, options.delay));
    }
  }

  throw lastError;
}

// Usage in TON docs
return retry(async () => {
  const transactions = await client.getTransactions(myAddress, { limit: 5 });
  // ... process transactions ...
}, { retries: 30, delay: 1000 });
```

**Limitations of TON's Example**:
- Fixed delay (no exponential backoff)
- No jitter
- No error classification
- No seqno handling
- Simple but not production-ready

### Recommendation

**DO NOT rely on TON SDK for retry logic**. Implement custom retry mechanism with:
1. Exponential backoff (see section 1)
2. Error classification (see section 2)
3. Seqno verification (see section 4)
4. Transaction verification (see section 5)

## 7. Complete Implementation Example

### Service Layer

```typescript
// src/services/TonBlockchainService.ts

import { TonClient, WalletContractV4, internal } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';

export class TonBlockchainService {
  private client: TonClient;
  private bankWalletAddress: string;
  private bankWalletKeyPair: any;

  constructor() {
    this.client = new TonClient({
      endpoint: 'https://toncenter.com/api/v2/jsonRPC',
      apiKey: process.env.TON_API_KEY
    });

    this.bankWalletAddress = process.env.TON_BANK_WALLET_ADDRESS!;
    this.initializeBankWallet();
  }

  private async initializeBankWallet() {
    // Load private key from environment
    const mnemonic = process.env.TON_BANK_WALLET_MNEMONIC!.split(' ');
    this.bankWalletKeyPair = await mnemonicToPrivateKey(mnemonic);
  }

  /**
   * Send reward transaction with full retry logic
   */
  async sendRewardTransaction(
    transactionId: number,
    recipientAddress: string,
    amount: number,
    corgiSightingId: number
  ): Promise<string> {
    const config: RetryConfig = {
      maxAttempts: 3,
      initialDelayMs: 2000,
      multiplier: 2,
      maxDelayMs: 30000,
      jitter: true
    };

    let currentAttempt = 0;

    const sendFn = async (): Promise<string> => {
      currentAttempt++;

      // Update retry tracking
      await transactionService.updateTransaction(transactionId, {
        retry_count: currentAttempt,
        last_retry_at: new Date(),
        status: TransactionStatus.PENDING
      });

      try {
        // Get current seqno
        const currentSeqno = await this.getWalletSeqno(this.bankWalletAddress);

        // Before retry, check if previous attempt succeeded
        if (currentAttempt > 1) {
          const alreadySent = await this.verifyTransactionWasSent(
            this.bankWalletAddress,
            recipientAddress,
            amount,
            60 // Check last 60 seconds
          );

          if (alreadySent) {
            const txHash = await this.findTransactionHash(
              this.bankWalletAddress,
              recipientAddress,
              amount
            );

            console.log(
              `Transaction ${transactionId} already sent (hash: ${txHash}). ` +
              `Skipping retry.`
            );

            return txHash;
          }
        }

        // Build and send transaction
        const txHash = await this.buildAndSendTransaction(
          recipientAddress,
          amount,
          currentSeqno,
          corgiSightingId
        );

        return txHash;

      } catch (error) {
        // Log error details
        await transactionService.updateTransaction(transactionId, {
          last_error: error instanceof Error ? error.message : String(error)
        });

        throw error;
      }
    };

    try {
      const txHash = await retryWithExponentialBackoff(sendFn, config);

      // Mark as completed
      await transactionService.confirmTransaction(transactionId, txHash);

      return txHash;

    } catch (error) {
      // All retries exhausted
      const classification = classifyTransactionError(error);

      await transactionService.failTransaction(transactionId);

      // Alert admin for manual review cases
      if (classification.action === 'manual_review') {
        await this.alertAdmin(transactionId, classification.reason);
      }

      throw error;
    }
  }

  private async buildAndSendTransaction(
    recipientAddress: string,
    amount: number,
    seqno: number,
    sightingId: number
  ): Promise<string> {
    // Create wallet contract
    const wallet = WalletContractV4.create({
      workchain: 0,
      publicKey: this.bankWalletKeyPair.publicKey
    });

    const contract = this.client.open(wallet);

    // Build transaction
    const amountInNanotons = BigInt(Math.floor(amount * 1e9));

    const transfer = internal({
      to: recipientAddress,
      value: amountInNanotons,
      body: `Corgi reward for sighting #${sightingId}`,
      bounce: false
    });

    // Send transaction
    const txHash = await contract.sendTransfer({
      seqno,
      secretKey: this.bankWalletKeyPair.secretKey,
      messages: [transfer],
      sendMode: 3, // PAY_GAS_SEPARATELY + IGNORE_ERRORS
      timeout: 30000 // 30 second timeout
    });

    return txHash;
  }

  private async getWalletSeqno(walletAddress: string): Promise<number> {
    // Implementation from section 4
  }

  private async verifyTransactionWasSent(
    fromAddress: string,
    toAddress: string,
    amount: number,
    maxAgeSeconds: number
  ): Promise<boolean> {
    // Implementation from section 5
  }

  private async findTransactionHash(
    fromAddress: string,
    toAddress: string,
    amount: number
  ): Promise<string> {
    // Implementation from section 5
  }

  private async alertAdmin(transactionId: number, reason: string): Promise<void> {
    // Send notification to admin dashboard or Telegram
    console.error(
      `ADMIN ALERT: Transaction ${transactionId} requires manual review. ` +
      `Reason: ${reason}`
    );
  }
}

export const tonBlockchainService = new TonBlockchainService();
```

### API Endpoint Integration

```typescript
// src/app/api/corgi/confirm/[id]/route.ts

import { tonBlockchainService } from '@/services/TonBlockchainService';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<CorgiSightingResponse | ErrorResponse>> {
  try {
    // ... existing auth and validation ...

    // Confirm the sighting
    const result = await corgiService.confirmSighting(
      sightingId,
      currentUserId,
      confirmed
    );

    // If confirmed (not denied), send reward
    if (confirmed && result.rewardEarned && result.rewardEarned > 0) {
      // Get reporter's wallet address
      const reporter = await userService.getUserById(result.sighting.reporter_id);

      if (!reporter.ton_wallet_address) {
        // User has no connected wallet - cannot send reward
        return NextResponse.json(
          {
            error: 'NO_WALLET',
            message: 'Reporter has not connected a TON wallet. Reward cannot be sent.'
          },
          { status: 400 }
        );
      }

      // Create transaction record
      const transactionResult = await transactionService.createRewardTransaction(
        reporter.ton_wallet_address,
        result.rewardEarned,
        sightingId
      );

      // Send blockchain transaction (with retries)
      try {
        await tonBlockchainService.sendRewardTransaction(
          transactionResult.transaction.id,
          reporter.ton_wallet_address,
          result.rewardEarned,
          sightingId
        );
      } catch (txError) {
        // Transaction failed after retries
        // Record is already marked as FAILED by TonBlockchainService
        console.error(
          `Failed to send reward for sighting ${sightingId}:`,
          txError
        );

        // Still return success for sighting confirmation
        // Admin will handle failed transaction later
      }
    }

    const response: CorgiSightingResponse = {
      id: result.sighting.id,
      reporterId: result.sighting.reporter_id,
      buddyId: result.sighting.buddy_id,
      corgiCount: result.sighting.corgi_count,
      status: result.sighting.status,
      createdAt: result.sighting.created_at,
      respondedAt: result.sighting.responded_at,
      rewardEarned: result.rewardEarned,
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    return handleApiError('corgi/confirm:POST', error);
  }
}
```

## 8. Testing Strategy

### Unit Tests

```typescript
// tests/unit/ton-blockchain-retry.test.ts

describe('TonBlockchainService Retry Logic', () => {
  it('should retry on network errors', async () => {
    const mockSend = jest.fn()
      .mockRejectedValueOnce(new Error('ETIMEDOUT'))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce('tx-hash-123');

    const result = await retryWithExponentialBackoff(mockSend, {
      maxAttempts: 3,
      initialDelayMs: 100,
      multiplier: 2,
      maxDelayMs: 1000,
      jitter: false
    });

    expect(result).toBe('tx-hash-123');
    expect(mockSend).toHaveBeenCalledTimes(3);
  });

  it('should not retry on validation errors', async () => {
    const mockSend = jest.fn()
      .mockRejectedValue({ exitCode: 33, message: 'Invalid seqno' });

    await expect(
      retryWithExponentialBackoff(mockSend, { maxAttempts: 3 })
    ).rejects.toThrow('Invalid seqno');

    expect(mockSend).toHaveBeenCalledTimes(1); // No retries
  });

  it('should detect already-sent transactions', async () => {
    const mockVerify = jest.fn().mockResolvedValue(true);
    const mockFindHash = jest.fn().mockResolvedValue('existing-tx-hash');

    // Mock first attempt fails with network error
    const mockSend = jest.fn()
      .mockRejectedValueOnce(new Error('Network error'));

    // Service should check verification and skip retry
    const result = await sendTransactionWithVerification(
      mockSend,
      mockVerify,
      mockFindHash
    );

    expect(result).toBe('existing-tx-hash');
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockVerify).toHaveBeenCalled();
  });
});
```

### Integration Tests

```typescript
// tests/integration/ton-reward-transaction.test.ts

describe('Reward Transaction Flow', () => {
  it('should send reward after corgi confirmation', async () => {
    // Create test sighting
    const sighting = await createTestSighting();

    // Confirm sighting
    const response = await fetch('/api/corgi/confirm/' + sighting.id, {
      method: 'POST',
      body: JSON.stringify({ confirmed: true }),
      headers: { 'Authorization': 'Bearer test-token' }
    });

    expect(response.status).toBe(200);

    // Verify transaction created
    const transactions = await transactionService.getTransactionsByRelatedEntity(
      'corgi_sighting',
      sighting.id
    );

    expect(transactions).toHaveLength(1);
    expect(transactions[0].status).toBe('completed');
    expect(transactions[0].transaction_hash).toBeTruthy();
  });

  it('should handle retry on transient failure', async () => {
    // Mock TON client to fail twice, then succeed
    jest.spyOn(tonClient, 'sendTransaction')
      .mockRejectedValueOnce(new Error('ETIMEDOUT'))
      .mockRejectedValueOnce(new Error('Server error'))
      .mockResolvedValueOnce('tx-hash-success');

    const result = await tonBlockchainService.sendRewardTransaction(
      123,
      'recipient-address',
      5.0,
      456
    );

    expect(result).toBe('tx-hash-success');

    // Verify retry count tracked
    const transaction = await transactionService.getTransactionById(123);
    expect(transaction.retry_count).toBe(3);
  });
});
```

## 9. Monitoring and Alerting

### Metrics to Track

```typescript
interface TransactionMetrics {
  total_attempts: number;
  successful_on_first_try: number;
  successful_after_retry: number;
  failed_after_all_retries: number;
  average_retry_count: number;
  error_types: Record<string, number>;
}

class TransactionMonitor {
  async logMetrics(): Promise<TransactionMetrics> {
    const metrics = await db.query(`
      SELECT
        COUNT(*) as total_attempts,
        SUM(CASE WHEN retry_count = 1 THEN 1 ELSE 0 END) as successful_on_first_try,
        SUM(CASE WHEN retry_count > 1 AND status = 'completed' THEN 1 ELSE 0 END) as successful_after_retry,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_after_all_retries,
        AVG(retry_count) as average_retry_count
      FROM transactions
      WHERE created_at > datetime('now', '-24 hours')
    `);

    return metrics;
  }
}
```

### Alert Triggers

```typescript
async function checkTransactionHealth(): Promise<void> {
  const metrics = await transactionMonitor.logMetrics();

  // Alert if >10% transactions failing
  const failureRate = metrics.failed_after_all_retries / metrics.total_attempts;
  if (failureRate > 0.1) {
    await alertAdmin(`High transaction failure rate: ${failureRate * 100}%`);
  }

  // Alert if average retries >2
  if (metrics.average_retry_count > 2) {
    await alertAdmin(`High retry rate: avg ${metrics.average_retry_count} attempts`);
  }

  // Alert if any transaction stuck in pending for >5 minutes
  const stuckTransactions = await db.query(`
    SELECT id FROM transactions
    WHERE status = 'pending'
      AND created_at < datetime('now', '-5 minutes')
  `);

  if (stuckTransactions.length > 0) {
    await alertAdmin(`${stuckTransactions.length} transactions stuck in pending`);
  }
}

// Run health check every 5 minutes
setInterval(checkTransactionHealth, 5 * 60 * 1000);
```

## 10. Summary and Recommendations

### Key Recommendations

1. **Exponential Backoff**: Use 2s initial delay, 2x multiplier, 3 max attempts
2. **Error Classification**: Only retry network/transient errors, fail fast on validation errors
3. **Seqno Management**: Always fetch current seqno before retry to prevent sequence gaps
4. **Transaction Verification**: Check blockchain state to detect succeeded-but-errored transactions
5. **Database Tracking**: Log retry attempts, errors, and seqno state for debugging
6. **NO Built-in Retries**: TON SDK has no automatic retry - must implement custom logic
7. **Monitoring**: Track failure rates and alert on anomalies

### Implementation Checklist

- [ ] Add retry tracking columns to `transactions` table
- [ ] Implement `retryWithExponentialBackoff()` utility with jitter
- [ ] Implement `classifyTransactionError()` for error handling
- [ ] Create `TonBlockchainService` with seqno-aware retry logic
- [ ] Add transaction verification methods
- [ ] Update confirmation API endpoint to call blockchain service
- [ ] Write unit tests for retry logic
- [ ] Write integration tests for full flow
- [ ] Set up transaction health monitoring
- [ ] Configure admin alerting for failed transactions

### Production Considerations

**Security**:
- Store bank wallet private key in secure environment (AWS Secrets Manager, etc.)
- Never log private keys or transaction signatures
- Use rate limiting to prevent abuse
- Monitor for unusual transaction patterns

**Performance**:
- Total retry window: ~14 seconds (acceptable for async reward delivery)
- Consider background job queue for high volume
- Cache wallet seqno to reduce RPC calls (with short TTL)

**Reliability**:
- Implement manual retry endpoint for admin dashboard
- Set up daily report of failed transactions
- Keep audit log of all transaction attempts
- Consider dead letter queue for persistent failures

## References

- TON Blockchain Docs: https://docs.ton.org/
- TON SDK (@ton/ton): https://github.com/ton-org/ton
- TON Exit Codes: https://docs.ton.org/v3/documentation/tvm/exit-codes
- TON Wallet Contracts: https://docs.ton.org/v3/guidelines/smart-contracts/howto/wallet
- AWS Exponential Backoff: https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html
- Google Cloud Retry Strategy: https://cloud.google.com/storage/docs/retry-strategy

---

**Document Status**: Ready for implementation
**Next Steps**: Review with team, begin implementation according to checklist
