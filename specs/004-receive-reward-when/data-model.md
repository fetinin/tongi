# Data Model: Complete Corgi Reward Distribution System

**Feature**: 004-receive-reward-when
**Date**: 2025-10-16
**Database**: SQLite 3 (`./data/app.db`)

## Overview

This feature adds two new tables (`transactions` and `pending_rewards`) and extends the existing `corgi_sightings` table to support Jetton reward distribution when buddies confirm corgi sightings.

---

## New Entities

### Transaction

Represents a Corgi coin Jetton transfer from the bank wallet to a user wallet on the TON blockchain.

**Table**: `transactions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique transaction identifier |
| `from_wallet` | TEXT | NOT NULL | Bank wallet TON address (sender) |
| `to_wallet` | TEXT | NOT NULL | User wallet TON address (recipient) |
| `amount` | INTEGER | NOT NULL | Jetton amount in smallest units (amount × 10^decimals) |
| `status` | TEXT | NOT NULL, CHECK(status IN ('pending', 'broadcasting', 'completed', 'failed')) | Transaction status state |
| `transaction_hash` | TEXT | NULL | TON blockchain transaction hash (BOC hash) |
| `sighting_id` | INTEGER | NOT NULL, FOREIGN KEY → corgi_sightings(id) | Reference to originating corgi sighting |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | When transaction record was created |
| `broadcast_at` | DATETIME | NULL | When transaction was sent to blockchain |
| `confirmed_at` | DATETIME | NULL | When blockchain confirmed the transaction |
| `retry_count` | INTEGER | NOT NULL, DEFAULT 0 | Number of retry attempts made |
| `last_retry_at` | DATETIME | NULL | Timestamp of last retry attempt |
| `last_error` | TEXT | NULL | Error message from last failed attempt |
| `failure_reason` | TEXT | NULL | Detailed reason for permanent failure |

**Indexes**:
```sql
CREATE INDEX idx_transactions_status_created ON transactions(status, created_at);
CREATE INDEX idx_transactions_hash_status ON transactions(transaction_hash, status);
CREATE INDEX idx_transactions_to_wallet ON transactions(to_wallet);
CREATE INDEX idx_transactions_sighting ON transactions(sighting_id);
```

**State Machine**:
```
pending (created) → broadcasting (sent to blockchain) → completed (blockchain confirmed)
                                                       ↘ failed (error or timeout)
```

**Validation Rules**:
- `amount` must be > 0
- `from_wallet` and `to_wallet` must be valid TON addresses
- `to_wallet` cannot equal `from_wallet`
- `transaction_hash` must be unique when not NULL
- `status` must transition: pending → broadcasting → (completed|failed)
- `retry_count` cannot exceed 3 (max retries per constitution)

---

### PendingReward

Tracks rewards awaiting wallet connection for users who haven't connected a TON wallet yet.

**Table**: `pending_rewards`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique pending reward identifier |
| `user_id` | INTEGER | NOT NULL, FOREIGN KEY → users(id) | User who earned the reward |
| `sighting_id` | INTEGER | NOT NULL, FOREIGN KEY → corgi_sightings(id) | Reference to confirmed sighting |
| `amount` | INTEGER | NOT NULL | Jetton amount in smallest units |
| `status` | TEXT | NOT NULL, CHECK(status IN ('pending', 'processed', 'cancelled')) | Pending reward status |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | When pending reward was recorded |
| `processed_at` | DATETIME | NULL | When reward was distributed or cancelled |
| `transaction_id` | INTEGER | NULL, FOREIGN KEY → transactions(id) | Reference to created transaction (when processed) |

**Indexes**:
```sql
CREATE INDEX idx_pending_rewards_user_status ON pending_rewards(user_id, status);
CREATE INDEX idx_pending_rewards_sighting ON pending_rewards(sighting_id);
```

**Validation Rules**:
- `amount` must be > 0
- One pending reward per sighting (unique `sighting_id` where `status = 'pending'`)
- Cannot have both `status = 'pending'` and `transaction_id IS NOT NULL`
- When `status = 'processed'`, `transaction_id` must be NOT NULL

---

## Modified Entities

### CorgiSighting (Existing)

Extended to track reward distribution state.

**Table**: `corgi_sightings` (existing columns unchanged, add these)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `reward_status` | TEXT | NULL, CHECK(reward_status IN ('not_applicable', 'pending', 'distributed', 'failed')) | Reward distribution status |
| `reward_distributed_at` | DATETIME | NULL | When reward was successfully distributed |

**New Values**:
- `reward_status = 'not_applicable'`: Sighting not yet confirmed or user already has wallet
- `reward_status = 'pending'`: Confirmed but user has no wallet (pending reward created)
- `reward_status = 'distributed'`: Transaction created and broadcast successfully
- `reward_status = 'failed'`: Reward distribution failed permanently

**Migration** (`004_transactions.sql`):
```sql
ALTER TABLE corgi_sightings ADD COLUMN reward_status TEXT CHECK(reward_status IN ('not_applicable', 'pending', 'distributed', 'failed'));
ALTER TABLE corgi_sightings ADD COLUMN reward_distributed_at DATETIME;
```

---

## Relationships

### Transaction Relationships

1. **Transaction → CorgiSighting** (Many-to-One)
   - Each transaction is triggered by exactly one sighting confirmation
   - `transactions.sighting_id` → `corgi_sightings.id`

2. **Transaction → User** (Many-to-One, implicit)
   - Each transaction has one recipient
   - Linked via `transactions.to_wallet` matching `users.ton_wallet_address`

### PendingReward Relationships

1. **PendingReward → User** (Many-to-One)
   - Each pending reward belongs to one user
   - `pending_rewards.user_id` → `users.id`

2. **PendingReward → CorgiSighting** (One-to-One)
   - Each pending reward is for exactly one sighting
   - `pending_rewards.sighting_id` → `corgi_sightings.id`
   - Unique constraint on `(sighting_id, status)` where `status = 'pending'`

3. **PendingReward → Transaction** (One-to-One, optional)
   - When processed, pending reward creates one transaction
   - `pending_rewards.transaction_id` → `transactions.id`

### Entity Diagram

```
┌─────────────┐
│   User      │
│             │
│ ton_wallet  │◄────────┐
└─────────────┘         │
       ▲                │
       │                │
       │                │
┌──────┴──────────┐     │
│ CorgiSighting   │     │
│                 │     │
│ reward_status   │     │
└─────────────────┘     │
       ▲                │
       │                │
       │                │
┌──────┴──────────┐     │
│ PendingReward   │     │
│                 │─────┘
│ sighting_id     │
│ transaction_id  │────┐
└─────────────────┘    │
                       │
                       ▼
              ┌─────────────────┐
              │  Transaction    │
              │                 │
              │  to_wallet      │
              │  from_wallet    │
              │  sighting_id    │
              │  tx_hash        │
              └─────────────────┘
```

---

## Business Rules

### Reward Distribution Logic

1. **When buddy confirms sighting**:
   - Calculate reward amount using 1-to-1 mapping (1 corgi = 1 Corgi coin, 2 corgis = 2 Corgi coins, etc.)
   - Check if user has connected TON wallet:
     - **If yes**: Create `Transaction` record with `status = 'pending'`, update sighting `reward_status = 'distributed'`
     - **If no**: Create `PendingReward` record, update sighting `reward_status = 'pending'`

2. **When user connects wallet**:
   - Query all `PendingReward` records for user where `status = 'pending'`
   - For each pending reward:
     - Create `Transaction` record with `status = 'pending'`
     - Update `PendingReward`: set `status = 'processed'`, `transaction_id`, `processed_at`
     - Update `CorgiSighting`: set `reward_status = 'distributed'`

3. **Transaction broadcast**:
   - Build Jetton transfer message (TEP-74 opcode `0xf8a7ea5`)
   - Get recipient's Jetton wallet address
   - Sign and broadcast transaction
   - Update `Transaction`: set `status = 'broadcasting'`, `transaction_hash`, `broadcast_at`

4. **Transaction confirmation** (via webhook or polling):
   - Verify blockchain confirmation (exit_code = 0)
   - Update `Transaction`: set `status = 'completed'`, `confirmed_at`
   - Update `CorgiSighting`: set `reward_distributed_at`

5. **Transaction failure**:
   - Update `Transaction`: set `status = 'failed'`, `failure_reason`
   - Update `CorgiSighting`: set `reward_status = 'failed'`
   - If retry count < 3 and error is retryable: retry with exponential backoff

### Duplicate Prevention

- **One transaction per sighting**: Enforced by checking `transactions.sighting_id` before creating new transaction
- **One pending reward per sighting**: Enforced by unique constraint on `(sighting_id, status)` where `status = 'pending'`
- **Idempotent wallet connection**: When processing pending rewards, check if `transaction_id` already set

### Data Integrity

- **Referential Integrity**: All foreign keys use `ON DELETE RESTRICT` to prevent orphaned records
- **Status Consistency**: Transaction status can only advance (pending → broadcasting → completed/failed)
- **Amount Validation**: Amount must match reward calculation formula for sighting's corgi_count
- **Timestamp Ordering**: `broadcast_at` ≥ `created_at`, `confirmed_at` ≥ `broadcast_at`

---

## Queries

### Common Queries

**Get user's transaction history**:
```sql
SELECT
  t.id,
  t.amount / 1e9 AS amount_in_coins,
  t.status,
  t.transaction_hash,
  t.created_at,
  t.confirmed_at,
  cs.corgi_count,
  cs.confirmed_at AS sighting_confirmed_at
FROM transactions t
JOIN corgi_sightings cs ON t.sighting_id = cs.id
WHERE t.to_wallet = ?
ORDER BY t.created_at DESC;
```

**Get pending rewards for user**:
```sql
SELECT
  pr.id,
  pr.amount / 1e9 AS amount_in_coins,
  cs.corgi_count,
  cs.confirmed_at AS sighting_date,
  pr.created_at
FROM pending_rewards pr
JOIN corgi_sightings cs ON pr.sighting_id = cs.id
WHERE pr.user_id = ? AND pr.status = 'pending'
ORDER BY pr.created_at ASC;
```

**Get total pending rewards for user**:
```sql
SELECT
  COUNT(*) AS count,
  SUM(amount) / 1e9 AS total_coins
FROM pending_rewards
WHERE user_id = ? AND status = 'pending';
```

**Get transactions pending confirmation** (for polling):
```sql
SELECT
  t.id,
  t.transaction_hash,
  t.to_wallet,
  t.created_at,
  t.retry_count
FROM transactions t
WHERE t.status IN ('pending', 'broadcasting')
  AND t.created_at > datetime('now', '-1 day')
ORDER BY t.created_at ASC
LIMIT 100;
```

**Get failed transactions needing retry**:
```sql
SELECT
  t.id,
  t.transaction_hash,
  t.retry_count,
  t.last_error
FROM transactions t
WHERE t.status = 'failed'
  AND t.retry_count < 3
  AND t.last_retry_at < datetime('now', '-' || (2 << t.retry_count) || ' seconds')
ORDER BY t.retry_count ASC, t.last_retry_at ASC
LIMIT 10;
```

**Get bank wallet transaction metrics**:
```sql
SELECT
  status,
  COUNT(*) AS count,
  SUM(amount) / 1e9 AS total_coins,
  AVG(amount) / 1e9 AS avg_coins
FROM transactions
WHERE created_at >= datetime('now', '-1 day')
GROUP BY status;
```

---

## Migrations

### Migration 004: Transactions Table

**File**: `src/lib/database/migrations/004_transactions.sql`

```sql
-- Add reward tracking to corgi_sightings
ALTER TABLE corgi_sightings ADD COLUMN reward_status TEXT CHECK(reward_status IN ('not_applicable', 'pending', 'distributed', 'failed'));
ALTER TABLE corgi_sightings ADD COLUMN reward_distributed_at DATETIME;

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_wallet TEXT NOT NULL,
  to_wallet TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount > 0),
  status TEXT NOT NULL CHECK(status IN ('pending', 'broadcasting', 'completed', 'failed')),
  transaction_hash TEXT NULL UNIQUE,
  sighting_id INTEGER NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  broadcast_at DATETIME NULL,
  confirmed_at DATETIME NULL,
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK(retry_count <= 3),
  last_retry_at DATETIME NULL,
  last_error TEXT NULL,
  failure_reason TEXT NULL,
  FOREIGN KEY (sighting_id) REFERENCES corgi_sightings(id) ON DELETE RESTRICT,
  CHECK(from_wallet != to_wallet),
  CHECK(broadcast_at IS NULL OR broadcast_at >= created_at),
  CHECK(confirmed_at IS NULL OR confirmed_at >= broadcast_at)
);

-- Indexes for performance
CREATE INDEX idx_transactions_status_created ON transactions(status, created_at);
CREATE INDEX idx_transactions_hash_status ON transactions(transaction_hash, status) WHERE transaction_hash IS NOT NULL;
CREATE INDEX idx_transactions_to_wallet ON transactions(to_wallet);
CREATE INDEX idx_transactions_sighting ON transactions(sighting_id);
```

### Migration 005: Pending Rewards Table

**File**: `src/lib/database/migrations/005_pending_rewards.sql`

```sql
CREATE TABLE IF NOT EXISTS pending_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  sighting_id INTEGER NOT NULL,
  amount INTEGER NOT NULL CHECK(amount > 0),
  status TEXT NOT NULL CHECK(status IN ('pending', 'processed', 'cancelled')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME NULL,
  transaction_id INTEGER NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (sighting_id) REFERENCES corgi_sightings(id) ON DELETE RESTRICT,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE RESTRICT,
  CHECK(status != 'pending' OR transaction_id IS NULL),
  CHECK(status != 'processed' OR transaction_id IS NOT NULL)
);

-- Unique constraint: one pending reward per sighting
CREATE UNIQUE INDEX idx_pending_rewards_sighting_pending ON pending_rewards(sighting_id) WHERE status = 'pending';

-- Indexes for performance
CREATE INDEX idx_pending_rewards_user_status ON pending_rewards(user_id, status);
CREATE INDEX idx_pending_rewards_sighting ON pending_rewards(sighting_id);
```

---

## TypeScript Models

### Transaction Model

**File**: `src/lib/database/models/transaction.ts`

```typescript
export interface Transaction {
  id: number;
  from_wallet: string;          // Bank wallet TON address
  to_wallet: string;             // User wallet TON address
  amount: bigint;                // Jetton amount in smallest units
  status: 'pending' | 'broadcasting' | 'completed' | 'failed';
  transaction_hash: string | null;
  sighting_id: number;
  created_at: Date;
  broadcast_at: Date | null;
  confirmed_at: Date | null;
  retry_count: number;
  last_retry_at: Date | null;
  last_error: string | null;
  failure_reason: string | null;
}

export interface CreateTransactionInput {
  from_wallet: string;
  to_wallet: string;
  amount: bigint;
  sighting_id: number;
}

export interface UpdateTransactionStatusInput {
  id: number;
  status: Transaction['status'];
  transaction_hash?: string;
  broadcast_at?: Date;
  confirmed_at?: Date;
  failure_reason?: string;
}
```

### PendingReward Model

**File**: `src/lib/database/models/pending-reward.ts`

```typescript
export interface PendingReward {
  id: number;
  user_id: number;
  sighting_id: number;
  amount: bigint;                // Jetton amount in smallest units
  status: 'pending' | 'processed' | 'cancelled';
  created_at: Date;
  processed_at: Date | null;
  transaction_id: number | null;
}

export interface CreatePendingRewardInput {
  user_id: number;
  sighting_id: number;
  amount: bigint;
}

export interface ProcessPendingRewardInput {
  id: number;
  transaction_id: number;
  processed_at: Date;
}
```

---

## Test Data

### Sample Transactions

```sql
-- Successful transaction
INSERT INTO transactions (from_wallet, to_wallet, amount, status, transaction_hash, sighting_id, created_at, broadcast_at, confirmed_at)
VALUES ('EQBank...', 'EQUser123...', 2000000000, 'completed', 'abc123def456...', 1, '2025-10-16 10:00:00', '2025-10-16 10:00:05', '2025-10-16 10:00:15');

-- Pending transaction
INSERT INTO transactions (from_wallet, to_wallet, amount, status, sighting_id, created_at)
VALUES ('EQBank...', 'EQUser456...', 6000000000, 'pending', 2, '2025-10-16 11:00:00');

-- Failed transaction with retries
INSERT INTO transactions (from_wallet, to_wallet, amount, status, sighting_id, created_at, retry_count, last_retry_at, failure_reason)
VALUES ('EQBank...', 'EQUser789...', 1000000000, 'failed', 3, '2025-10-16 09:00:00', 3, '2025-10-16 09:00:30', 'Insufficient gas for transaction');
```

### Sample Pending Rewards

```sql
-- Pending reward waiting for wallet connection
INSERT INTO pending_rewards (user_id, sighting_id, amount, status, created_at)
VALUES (42, 5, 4000000000, 'pending', '2025-10-16 12:00:00');

-- Processed pending reward
INSERT INTO pending_rewards (user_id, sighting_id, amount, status, created_at, processed_at, transaction_id)
VALUES (42, 6, 2000000000, 'processed', '2025-10-16 13:00:00', '2025-10-16 14:00:00', 15);
```

---

## Performance Considerations

### Indexing Strategy
- Primary lookups by `status` and `created_at` for polling pending transactions
- Wallet address lookups for user transaction history
- Sighting ID lookups to prevent duplicates

### Query Optimization
- Limit polling queries to last 24 hours of transactions
- Use partial indexes for active statuses only
- Batch pending reward processing when wallet connects

### Scaling
- Current schema supports 1k-10k users with hundreds daily transactions
- SQLite appropriate for this scale with proper indexing
- Future: Consider partitioning transactions table by date if >1M records

---

## Security & Privacy

### Data Sensitivity
- **Public**: Transaction hashes (verifiable on blockchain)
- **Semi-Public**: Wallet addresses (pseudonymous)
- **Private**: Retry errors, failure reasons (may contain debugging info)

### Access Control
- Users can only view their own transactions and pending rewards
- Admin dashboard for system-wide transaction monitoring
- Rate limiting on transaction endpoints

### Audit Trail
- All transaction attempts logged with timestamps
- Retry count and error messages preserved for debugging
- Immutable transaction history (no deletions, only status updates)
