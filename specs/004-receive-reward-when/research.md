# Research: Complete Corgi Reward Distribution System

**Feature**: 004-receive-reward-when
**Date**: 2025-10-16
**Status**: Complete

## Critical Discovery: Corgi Coin is a Jetton

**Finding**: Corgi coin is a Jetton token (TON's token standard, similar to ERC-20), not native TON cryptocurrency.

**Impact**:
- Jetton transfers require smart contract interactions, not direct wallet transfers
- Must interact with Jetton wallet contracts using TEP-74 standard
- Different transaction structure and gas costs compared to native TON
- Requires querying Jetton wallet addresses before transfers

**References**:
- TON Jetton Transfer Guide: https://docs.ton.org/v3/guidelines/ton-connect/cookbook/jetton-transfer
- TEP-74 Jetton Standard: https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md

---

## Decision 1: TON SDK for Server-Side Transaction Signing

### Decision
Use **`@ton/ton`** (with `@ton/core` and `@ton/crypto`) for server-side Jetton transfers from bank wallet.

### Rationale
- Official TON Foundation SDK with comprehensive TypeScript support
- Supports Jetton smart contract interactions via `JettonWallet` and `JettonMaster` classes
- Enables server-side transaction signing with private keys
- Active maintenance and production-ready (241+ dependent projects)
- Testnet and mainnet support via HTTP APIs

### Installation
```bash
pnpm add @ton/ton @ton/core @ton/crypto
```

### Key Capabilities for Jetton Transfers
- Initialize wallet from mnemonic phrase stored in environment variable
- Query Jetton wallet addresses via `get_wallet_address` method
- Build Jetton transfer message with opcode `0xf8a7ea5`
- Sign and broadcast transactions to TON blockchain
- Monitor transaction status and confirmations

### Alternatives Considered
- **`tonweb`**: Older SDK with weaker TypeScript support, not recommended for new projects
- **`@tonconnect/sdk`**: Client-side only, cannot sign with private keys server-side
- **`tonutils-js`**: Requires running TON node, too complex for current scale

### Security Requirements
- Store bank wallet mnemonic in `TON_BANK_WALLET_MNEMONIC` environment variable (24 words)
- Never log or expose private keys in API responses
- All transaction signing happens server-side in API routes
- Validate all inputs before signing transactions

---

## Decision 2: Jetton Transfer Implementation Pattern

### Decision
Use standard `WalletContractV4` with Jetton smart contract interactions for reward distribution.

### Rationale
- App has low user volume (1k-10k users, hundreds of daily transactions)
- Standard wallet sufficient for this scale (no need for Highload Wallet V3)
- Jetton transfers follow TEP-74 standard with specific message structure
- Each transfer costs ~0.05 TON in gas fees

### Jetton Transfer Process
1. **Get recipient's Jetton wallet address** from Jetton master contract
2. **Build transfer message body** with opcode `0xf8a7ea5` and transfer parameters
3. **Send transaction** to sender's Jetton wallet contract (not recipient's TON wallet)
4. **Monitor confirmation** on blockchain (typically 5-15 seconds)

### Transaction Structure
```typescript
const transferBody = beginCell()
  .storeUint(0xf8a7ea5, 32)              // Jetton transfer opcode (TEP-74)
  .storeUint(0, 64)                       // query_id (for tracking)
  .storeCoins(jettonAmount)               // Amount in smallest units
  .storeAddress(recipientAddress)         // Destination TON wallet
  .storeAddress(bankAddress)              // Response address (for refunds)
  .storeUint(0, 1)                        // custom_payload (none)
  .storeCoins(1n)                         // forward_ton_amount (1 nanoton notification)
  .storeBit(0)                            // forward_payload (none)
  .endCell();

await contract.sendTransfer({
  secretKey: keyPair.secretKey,
  seqno: await contract.getSeqno(),
  messages: [
    internal({
      to: senderJettonWallet,              // Bank's Jetton wallet address
      value: toNano('0.05'),                // Gas fee in TON
      body: transferBody,
      bounce: true                          // Return on failure
    })
  ]
});
```

### Gas Costs
- **Per transfer**: 0.05 TON (gas for Jetton wallet contract execution)
- **Forward amount**: 1 nanoton (standard notification fee)
- **Excess refund**: Unused gas returned to bank wallet

### Balance Verification
Must check TWO balances before transfer:
1. **Jetton balance**: Sufficient Corgi coins in bank's Jetton wallet
2. **TON balance**: Sufficient TON in bank wallet for gas fees

---

## Decision 3: Transaction Retry Strategy

### Decision
Implement exponential backoff retry with error classification (3 max attempts, 2-second initial delay).

### Rationale
- TON blockchain confirmations typically take 5-15 seconds
- Network errors and transient failures are recoverable
- Exponential backoff prevents overwhelming the blockchain RPC
- Error classification prevents retrying non-recoverable errors

### Retry Configuration
- **Initial delay**: 2 seconds
- **Multiplier**: 2x (exponential backoff)
- **Max attempts**: 3 retries
- **Jitter**: ±10% randomization to prevent thundering herd
- **Total window**: ~14 seconds maximum

### Retry Timing Sequence
- Attempt 1: Immediate
- Attempt 2: ~2s wait (total: ~2s)
- Attempt 3: ~4s wait (total: ~6s)
- Attempt 4: ~8s wait (total: ~14s)

### Error Classification

**Retryable Errors (will retry):**
- Network errors: `ECONNREFUSED`, `ETIMEDOUT`, `ENOTFOUND`
- Transient blockchain errors: "Server error", "Lite server timeout"
- Rate limiting: HTTP 429
- Exit code 13: Out of gas (may succeed on retry)

**Non-Retryable Errors (fail immediately):**
- Exit code 33: Invalid seqno (sequence number mismatch)
- Exit code 34: Invalid subwallet ID
- Exit code 35: Message expired (past `valid_until` time)
- Exit code 0x100+: Insufficient funds
- Invalid signatures or malformed addresses

### Sequence Number (seqno) Handling
**Critical**: Always fetch current seqno before retry to detect if previous attempt succeeded:
```typescript
const currentSeqno = await contract.getSeqno();
if (currentSeqno > expectedSeqno) {
  // Previous transaction may have succeeded despite error
  const exists = await verifyTransactionOnChain(...);
  if (exists) return; // Don't retry
}
```

### Database Tracking
Add columns to `transactions` table:
- `retry_count`: Track number of retry attempts
- `last_retry_at`: Timestamp of last retry
- `last_error`: Store error details for debugging

### Implementation
No built-in retry in `@ton/ton` SDK - must implement custom retry logic with exponential backoff and error classification.

---

## Decision 4: Transaction Monitoring Strategy

### Decision
Hybrid approach: TONAPI webhooks (primary) + polling fallback (safety net).

### Rationale
- TONAPI free tier (1 RPS) sufficient for hundreds of daily transactions
- Webhooks provide real-time updates within 5-15 seconds (meets 30-second requirement)
- Polling fallback ensures reliability if webhook service is down
- No additional infrastructure required (Redis/BullMQ unnecessary for current scale)

### Primary: TONAPI Webhooks

**Setup:**
1. Register at https://tonconsole.com for free API key
2. Create webhook endpoint: `/api/webhooks/ton-transactions`
3. Subscribe bank wallet address to webhook notifications
4. Receive POST requests when transactions occur

**Webhook Flow:**
```
Transaction broadcast → TON blockchain confirms → TONAPI webhook fires (5-15s)
→ POST /api/webhooks/ton-transactions → Update transaction status
```

**Pricing:**
- Free tier: 1 RPS (60 req/min = 3,600 req/hour) - sufficient for current scale
- Upgrade path: $9.90/month for 10 RPS if needed later

### Fallback: Polling Cron Job

**Configuration:**
- Runs every 60 seconds
- Checks transactions pending >2 minutes (webhook may have failed)
- Lightweight, no external dependencies

**Implementation:**
```typescript
// Runs every 60 seconds via Next.js cron or setInterval
async function pollPendingTransactions() {
  const pending = await transactionService.queryTransactions({
    status: 'pending',
    olderThan: '2 minutes',
    limit: 100
  });

  for (const tx of pending) {
    const status = await checkBlockchainStatus(tx.transaction_hash);
    if (status === 'completed') {
      await transactionService.confirmTransaction(tx.id);
    } else if (status === 'failed') {
      await transactionService.failTransaction(tx.id);
    }
  }
}
```

### Safety Net: Daily Cleanup

**Purpose**: Handle edge cases where both webhook and polling missed updates

**Configuration:**
- Runs once daily
- Checks transactions stuck in pending >24 hours
- Marks as failed or alerts admin for manual investigation

### Transaction Success Criteria

A Jetton transfer succeeds if and only if:
- **Compute Phase**: `exit_code === 0`
- **Action Phase**: `exit_code === 0` OR success flag is true

Common failure exit codes:
- `13`: Out of gas
- `37`: Not enough TON for gas fees
- `32-50`: Action phase errors (contract execution failures)

### Database Schema Enhancements

Add to `transactions` table:
- `broadcast_at`: When sent to blockchain
- `confirmed_at`: Blockchain confirmation timestamp
- `failure_reason`: Store exit code/error details
- `last_checked_at`: Last polling check timestamp

### Infrastructure Required

**Minimal setup (recommended):**
- TONAPI webhook (external service, free tier)
- Simple polling with Node.js (in-process, no additional infrastructure)
- Existing SQLite database

**No Redis/BullMQ needed** for current scale (1k-10k users).

---

## Decision 5: Jetton Master Contract Configuration

### Decision
Store Jetton master contract address in environment variable for flexibility.

### Rationale
- Jetton master address differs between testnet and mainnet
- Enables easy testing without code changes
- Supports potential token contract upgrades

### Environment Variables Required

```bash
# TON Network
TON_NETWORK=testnet  # or 'mainnet'
TON_API_KEY=your_tonapi_key_from_tonconsole

# Bank Wallet
TON_BANK_WALLET_MNEMONIC="word1 word2 word3 ... word24"
TON_BANK_WALLET_ADDRESS=EQ...

# Jetton Configuration
JETTON_MASTER_ADDRESS=EQ...  # Corgi coin Jetton master contract
JETTON_DECIMALS=9            # Corgi coin decimals (typically 9)

# Monitoring
TON_BANK_MIN_BALANCE=100     # Alert if TON balance < 100 (for gas)
JETTON_MIN_BALANCE=10000     # Alert if Corgi coin balance < 10000
TONAPI_WEBHOOK_SECRET=...    # For webhook signature verification
```

### Testnet vs Mainnet

**Testnet:**
- Get test TON from faucet: https://t.me/testgiver_ton_bot
- Deploy test Jetton contract or use existing testnet Jetton
- API endpoint: `https://testnet.toncenter.com/api/v2/jsonRPC`

**Mainnet:**
- Requires real TON for gas fees
- Production Corgi coin Jetton contract
- API endpoint: `https://toncenter.com/api/v2/jsonRPC`

---

## Decision 6: Reward Calculation Algorithm

### Decision
Implement reward calculation as pure function with unit tests (complex logic per constitution).

### Rationale
- Reward formula has conditional logic (1 corgi = 1 coin, 2-5 = 2x, 6+ = 3x)
- Business-critical calculation requiring accuracy
- Pure function enables comprehensive unit testing

### Implementation

```typescript
// lib/rewards/calculator.ts
export function calculateRewardAmount(corgiCount: number): number {
  if (corgiCount < 1) {
    throw new Error('Corgi count must be at least 1');
  }

  if (corgiCount === 1) {
    return 1; // 1 corgi = 1 coin
  } else if (corgiCount >= 2 && corgiCount <= 5) {
    return corgiCount * 2; // 2-5 corgis = 2 coins each
  } else {
    return corgiCount * 3; // 6+ corgis = 3 coins each
  }
}
```

### Test Coverage

Unit tests required for:
- Edge case: 1 corgi → 1 coin
- Lower tier: 2-5 corgis → 2x multiplier
- Upper tier: 6+ corgis → 3x multiplier
- Boundary: 5 corgis → 10 coins, 6 corgis → 18 coins
- Error: 0 or negative corgis → throws error

### Jetton Decimals Conversion

Jettons typically use 9 decimals (like native TON). Convert reward amount:
```typescript
const rewardInCorgiCoins = calculateRewardAmount(corgiCount);
const rewardInSmallestUnits = BigInt(rewardInCorgiCoins) * BigInt(10 ** JETTON_DECIMALS);
```

---

## Implementation Dependencies

### NPM Packages
```json
{
  "@ton/ton": "^15.4.0",
  "@ton/core": "^0.49.2",
  "@ton/crypto": "^3.2.0"
}
```

### Existing Dependencies (already installed)
- `@tonconnect/ui-react`: Frontend wallet connections (keep for user wallets)
- `better-sqlite3`: Database operations
- `next`: API routes for server-side signing

### No Additional Infrastructure
- ✅ No Redis needed (polling is in-process)
- ✅ No BullMQ needed (scale doesn't require job queue)
- ✅ No separate backend server (Next.js API routes sufficient)

---

## Testing Strategy

### Testnet First
- Deploy or identify test Corgi coin Jetton contract on testnet
- Fund bank wallet with test TON (for gas) and test Corgi coins
- Test complete flow: sighting → confirmation → Jetton transfer → verification

### Integration Tests (Mandatory per Constitution)
1. **User Story 1**: Successful reward distribution with Jetton transfer
2. **User Story 2**: Transaction history shows Jetton transfer hash
3. **User Story 3**: Pending rewards for users without wallets
4. **User Story 4**: Bank balance monitoring (both TON and Jetton)

### Unit Tests (Complex Logic Only)
- Reward calculation algorithm (all tiers and boundaries)
- Error classification logic
- Retry backoff timing

### Mock Strategy (Per Constitution)
- ✅ Mock: TONAPI webhook calls, TON blockchain RPC calls
- ❌ Don't mock: Database operations, transaction service, internal logic

---

## Security Considerations

### Private Key Management
- Store mnemonic in environment variable (24 words)
- Never log mnemonic, private key, or secret key
- Never expose in API responses or client-side code
- Server-side signing only (API routes)

### Authorization
- Validate Telegram initData server-side before processing confirmations
- Only designated buddies can trigger rewards for their paired users
- Rate limiting on confirmation endpoint

### Audit Trail
- Log all transaction attempts (without sensitive data)
- Store retry attempts and error details in database
- Admin dashboard for monitoring failed transactions

### Balance Monitoring
- Alert when TON balance < threshold (cannot pay gas)
- Alert when Jetton balance < threshold (cannot distribute rewards)
- Monitor for unauthorized withdrawals or unusual activity

---

## References

### TON Documentation
- Jetton Transfer Guide: https://docs.ton.org/v3/guidelines/ton-connect/cookbook/jetton-transfer
- TEP-74 Jetton Standard: https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md
- @ton/ton SDK: https://github.com/ton-org/ton
- TON Exit Codes: https://docs.ton.org/v3/documentation/tvm/exit-codes
- Writing to Network: https://docs.ton.org/v3/guidelines/quick-start/blockchain-interaction/writing-to-network

### API Services
- TONAPI (webhooks): https://tonconsole.com
- TON Center (mainnet): https://toncenter.com
- TON Center (testnet): https://testnet.toncenter.com
- Testnet Faucet: https://t.me/testgiver_ton_bot

### Project Files
- Feature Spec: `/Users/inv-denisf/dev/personal/tongi/specs/004-receive-reward-when/spec.md`
- Implementation Plan: `/Users/inv-denisf/dev/personal/tongi/specs/004-receive-reward-when/plan.md`
- Constitution: `/Users/inv-denisf/dev/personal/tongi/.specify/memory/constitution.md`

---

## Next Steps

Phase 0 (Research) is complete. Proceed to Phase 1:
1. Generate `data-model.md` with database schema for transactions and pending rewards
2. Generate API contracts in `/contracts/` for reward distribution endpoints
3. Update agent context with new technology (Jetton transfers, @ton/ton SDK)
4. Generate `quickstart.md` for development workflow

All "NEEDS CLARIFICATION" items have been resolved.
