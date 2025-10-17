# Research: Missing Corgi Coin Reward Implementation

**Date**: 2025-10-16
**Researcher**: Claude
**Status**: Complete

## Executive Summary

The corgi coin reward system has most building blocks in place but is **missing the critical server-side transaction execution layer**. When a buddy confirms a corgi sighting, the system calculates the reward but does not actually transfer TON coins from the bank wallet to the user's wallet.

## Research Objective

Investigate what functionality is missing when a buddy confirms that a corgi was spotted, specifically regarding the transfer of corgi coins from the "bank" TON wallet to the user's TON wallet.

## Current State Analysis

### ✅ What's Implemented

1. **Reward Calculation Logic** (`src/services/CorgiService.ts:547-555`)
   - `calculateReward()` method correctly computes coins based on corgi count
   - 1 corgi = 1 coin, 2-5 corgis = 2 coins each, 6+ corgis = 3 coins each

2. **Transaction Service** (`src/services/TransactionService.ts:696-720`)
   - `createRewardTransaction()` method exists
   - Creates database record for reward transactions
   - Updates bank wallet balance
   - Links transaction to corgi sighting

3. **Confirmation API Endpoint** (`src/app/api/corgi/confirm/[id]/route.ts`)
   - Authenticates buddy
   - Validates sighting status
   - Calls `corgiService.confirmSighting()`
   - Returns reward amount in response

4. **TON Utilities** (`src/lib/ton.ts`)
   - `createRewardTransaction()` helper (line 327-339)
   - Transaction validation and formatting
   - Address validation
   - Amount conversion (Corgi coins ↔ nanotons)

5. **Bank Wallet Infrastructure**
   - `BankWallet` model (`src/models/BankWallet.ts`)
   - `BankService` with balance management (`src/services/BankService.ts`)
   - Environment variables defined (`.env.example:10-11`)
     - `TON_BANK_WALLET_ADDRESS`
     - `TON_BANK_WALLET_PRIVATE_KEY`

6. **Client-Side TON Integration** (`src/components/wallet/TonProvider.tsx`)
   - TON Connect UI integration
   - User wallet connection/disconnection
   - Client-initiated transaction signing
   - Works for marketplace purchases

### ❌ What's Missing

## Critical Gap #1: Server-Side Transaction Execution

**Location**: No implementation exists
**Required**: New service for server-initiated blockchain transactions

The system has **no mechanism to sign and send transactions from the bank wallet**. The existing TON integration (`src/components/wallet/TonProvider.tsx`) is **client-side only** and uses `@tonconnect/ui-react`, which requires user interaction.

**Why This Matters:**
- Marketplace purchases: User initiates → User signs → Seller receives (✅ works)
- Rewards: System initiates → Bank signs → User receives (❌ not implemented)

**Missing Components:**
- Server-side TON SDK (e.g., `@ton/ton`, `@ton/core`, `tonweb`)
- Transaction signing using `TON_BANK_WALLET_PRIVATE_KEY`
- Transaction broadcast to TON blockchain
- Result parsing and error handling

## Critical Gap #2: Transaction Record Creation

**Location**: `src/app/api/corgi/confirm/[id]/route.ts:75-80`
**Current Code**:
```typescript
// Confirm the sighting using CorgiService
const result = await corgiService.confirmSighting(
  sightingId,
  currentUserId,
  confirmed
);
```

**Missing**: No call to `transactionService.createRewardTransaction()`

**Required Implementation**:
```typescript
// 1. Get reporter's wallet address
const reporter = await userService.getUserById(result.sighting.reporter_id);

// 2. Validate reporter has connected wallet
if (!reporter.ton_wallet_address) {
  // Handle: user can't receive reward
}

// 3. Create transaction record
const transaction = await transactionService.createRewardTransaction(
  reporter.ton_wallet_address,
  result.rewardEarned!,
  sightingId
);

// 4. Execute blockchain transaction (see Gap #1)
// 5. Update transaction status with blockchain hash
```

## Critical Gap #3: User Wallet Validation

**Issue**: No check if reporter has connected TON wallet before confirmation

**Current Flow**:
1. User reports sighting (doesn't require wallet)
2. Buddy confirms sighting ✅
3. System calculates reward ✅
4. System attempts to send coins → **FAILS** if user has no wallet

**Required**:
- Validate `reporter.ton_wallet_address IS NOT NULL` before creating transaction
- Graceful handling: Store pending reward? Notify user to connect wallet?

## Critical Gap #4: Transaction Status Management

**Location**: No implementation exists
**Required**: Confirmation tracking system

After sending a blockchain transaction, the system needs to:
1. Monitor transaction status (pending → completed/failed)
2. Store blockchain transaction hash
3. Update database transaction record
4. Handle failures and retries

**Options**:
- **Synchronous**: Wait for blockchain confirmation (slow, 5-30 seconds)
- **Asynchronous**: Background job polls blockchain explorer
- **Webhook**: TON indexer service sends callbacks
- **Manual**: Admin dashboard for failed transactions

## Architecture Analysis

### Current Architecture (Marketplace Purchases)

```
User → [Frontend] → TON Connect UI → User's Wallet
                          ↓
                    User Signs Transaction
                          ↓
                    Blockchain Confirms
                          ↓
                    [API] updates database
```

### Required Architecture (Rewards)

```
Buddy Confirms → [API Endpoint] → [Server TON Service]
                                          ↓
                                  Sign with Bank Private Key
                                          ↓
                                  Broadcast to Blockchain
                                          ↓
                                  Monitor Confirmation
                                          ↓
                                  Update Database
```

## Security Considerations

### ⚠️ Private Key Management

The bank wallet private key (`TON_BANK_WALLET_PRIVATE_KEY`) is **highly sensitive**:
- ✅ Stored in environment variables (good)
- ⚠️ Never logged or exposed in responses
- ⚠️ Server-only access (never sent to client)
- ⚠️ Consider hardware wallet or key management service for production

### Transaction Authorization

- ✅ Confirmation endpoint validates buddy authorization
- ✅ Server controls when rewards are sent
- ⚠️ Rate limiting needed to prevent transaction spam
- ⚠️ Balance monitoring to prevent bank wallet depletion

## Required Changes

### 1. Install Server-Side TON SDK

**File**: `package.json`

```bash
pnpm add @ton/ton @ton/core @ton/crypto
```

### 2. Create TON Blockchain Service

**New File**: `src/services/TonBlockchainService.ts`

Must implement:
- `sendRewardTransaction(recipientAddress, amount, sightingId)`
- Transaction signing with bank wallet private key
- Error handling and retry logic
- Transaction hash extraction

### 3. Update Confirmation Endpoint

**File**: `src/app/api/corgi/confirm/[id]/route.ts`

Add:
- User wallet address retrieval
- Transaction record creation
- Blockchain transaction execution
- Status tracking

### 4. Transaction Confirmation System

**Options**:
- New API endpoint for manual confirmation
- Background job to poll transaction status
- Webhook receiver for TON indexer events

### 5. Error Handling

Handle cases:
- User has no connected wallet
- Insufficient bank balance
- Blockchain transaction failure
- Network connectivity issues
- Transaction timeout

## Testing Considerations

### Test Scenarios

1. **Happy Path**: User with connected wallet gets reward
2. **No Wallet**: User without wallet confirmed - handle gracefully
3. **Insufficient Balance**: Bank wallet empty - prevent transaction
4. **Transaction Failure**: Blockchain rejects - update status, notify admin
5. **Duplicate Confirmation**: Same sighting confirmed twice - prevent double reward

### Test Data Requirements

- Bank wallet with test TON coins
- Test user accounts with/without connected wallets
- Mock blockchain responses for failure scenarios

## Comparison: Rewards vs Purchases

| Aspect | Marketplace Purchases | Corgi Rewards |
|--------|----------------------|---------------|
| **Initiator** | User (buyer) | System (automated) |
| **Signing** | Client-side (TON Connect UI) | Server-side (private key) |
| **SDK** | `@tonconnect/ui-react` | `@ton/ton` (needed) |
| **Flow** | User approves in wallet app | Automatic on confirmation |
| **Implementation** | ✅ Complete | ❌ Missing |

## Priority Assessment

### P0 (Critical)
1. Server-side TON SDK integration
2. Transaction signing and broadcasting
3. Update confirmation endpoint to create transactions

### P1 (High)
4. Transaction status tracking
5. User wallet validation
6. Error handling for missing wallets

### P2 (Medium)
7. Background job for transaction monitoring
8. Admin dashboard for failed transactions
9. Rate limiting and security hardening

### P3 (Low)
10. Transaction retry mechanisms
11. Notification system for reward receipt
12. Analytics and monitoring

## References

### Code Locations

- Corgi Service: `src/services/CorgiService.ts`
- Transaction Service: `src/services/TransactionService.ts`
- Bank Service: `src/services/BankService.ts`
- Confirmation API: `src/app/api/corgi/confirm/[id]/route.ts`
- TON Utilities: `src/lib/ton.ts`
- Client TON Provider: `src/components/wallet/TonProvider.tsx`

### External Documentation

- TON SDK: https://github.com/ton-org/ton
- TON Blockchain: https://docs.ton.org/
- TON Connect Protocol: https://docs.ton.org/develop/dapps/ton-connect/

## Conclusion

The corgi coin reward system is **80% complete** but missing the **critical 20%** - the actual blockchain transaction execution. The database models, business logic, and client-side infrastructure are solid, but server-initiated transactions require a fundamentally different approach than the existing client-initiated marketplace purchases.

**Estimated Effort**: 2-3 days for experienced TON developer
- Day 1: Server-side TON SDK setup and transaction signing
- Day 2: API integration and error handling
- Day 3: Testing and transaction monitoring

**Risk Level**: Medium-High
- Requires secure private key management
- Blockchain integration can be complex
- Real money transactions need thorough testing
