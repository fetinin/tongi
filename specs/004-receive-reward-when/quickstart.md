# Quickstart: Corgi Reward Distribution System

**Feature**: 004-receive-reward-when
**Branch**: `004-receive-reward-when`
**Prerequisites**: Node.js 18+, pnpm, TON testnet wallet with test coins

## Overview

This guide walks you through setting up and testing the complete Corgi coin Jetton reward distribution system, from database setup to end-to-end reward flow testing.

---

## 1. Environment Setup

### Install Dependencies

```bash
# Install new TON SDK packages
pnpm add @ton/ton @ton/core @ton/crypto

# Verify installation
pnpm list @ton/ton @ton/core @ton/crypto
```

### Configure Environment Variables

Create or update `.env.local`:

```bash
# TON Network Configuration
TON_NETWORK=testnet                              # Use testnet for development
TON_API_KEY=your_tonapi_key_from_tonconsole     # Get from https://tonconsole.com

# Bank Wallet (DO NOT COMMIT TO GIT)
TON_BANK_WALLET_MNEMONIC="word1 word2 word3 ... word24"  # 24-word mnemonic
TON_BANK_WALLET_ADDRESS=EQ...                    # Bank wallet TON address

# Jetton Configuration
JETTON_MASTER_ADDRESS=EQ...                      # Corgi coin Jetton master contract
JETTON_DECIMALS=9                                # Corgi coin decimals (typically 9)

# Monitoring & Webhooks
TON_BANK_MIN_BALANCE=100                         # Alert threshold for TON balance (gas)
JETTON_MIN_BALANCE=10000                         # Alert threshold for Jetton balance
TONAPI_WEBHOOK_SECRET=your_webhook_secret        # For TONAPI webhook verification

# Mock Mode (Development Only)
NEXT_PUBLIC_USE_MOCK_AUTH=true                   # Enable mock Telegram environment
```

### Get Testnet Resources

1. **Create testnet TON wallet**:
   - Use TON Wallet app or @wallet bot
   - Switch to testnet network
   - Save 24-word mnemonic securely

2. **Get test TON coins** (for gas):
   ```
   Send message to @testgiver_ton_bot on Telegram
   Request: "Get test coins for EQ..."
   ```

3. **Deploy or get test Jetton contract**:
   - Option A: Use existing testnet Jetton (if available)
   - Option B: Deploy test Jetton contract
   - Save Jetton master contract address

4. **Register for TONAPI**:
   - Sign up at https://tonconsole.com
   - Get free tier API key (1 RPS)
   - Save API key and webhook secret

---

## 2. Database Setup

### Run Migrations

```bash
# Run new migrations for transactions and pending rewards
pnpm run db:migrate

# Verify tables created
sqlite3 ./data/app.db ".tables"
# Should see: transactions, pending_rewards

# Check transaction table schema
sqlite3 ./data/app.db ".schema transactions"
```

### Seed Bank Wallet (Optional)

```bash
# Create seed script if needed
pnpm run db:seed
```

Or manually:

```sql
-- Insert bank wallet record (if needed)
INSERT INTO bank_wallets (address, balance, jetton_balance, last_checked_at)
VALUES (
  'EQ...',                    -- Your bank wallet address
  100000000000,               -- 100 TON in nanotons
  1000000000000,              -- 1000 Corgi coins in smallest units
  CURRENT_TIMESTAMP
);
```

---

## 3. Implementation Checklist

### Phase 1: Core Blockchain Integration

- [ ] **Install @ton/ton SDK** (already done in step 1)
- [ ] **Create `src/lib/blockchain/ton-client.ts`**:
  - Initialize TonClient with testnet endpoint
  - Wallet contract setup from mnemonic

- [ ] **Create `src/lib/blockchain/jetton-wallet.ts`**:
  - Function to get user's Jetton wallet address from master contract
  - Query `get_wallet_address` method

- [ ] **Create `src/lib/blockchain/jetton-transfer.ts`**:
  - Build Jetton transfer message body (opcode `0xf8a7ea5`)
  - Sign and broadcast transaction
  - Return transaction hash

- [ ] **Create `src/lib/blockchain/balance-monitor.ts`**:
  - Check bank wallet TON balance (for gas)
  - Check bank wallet Jetton balance (for rewards)
  - Alert logic for low balances

### Phase 2: Reward Logic

- [ ] **Create `src/lib/rewards/calculator.ts`**:
  - Implement reward calculation: 1-to-1 mapping (1 corgi = 1 Corgi coin, 2 corgis = 2 Corgi coins, etc.)
  - Unit tests for various corgi counts and boundary cases

- [ ] **Create `src/lib/rewards/distributor.ts`**:
  - Orchestrate reward distribution flow
  - Handle wallet validation
  - Create transactions or pending rewards

- [ ] **Create `src/lib/rewards/retry.ts`**:
  - Exponential backoff retry logic (2s initial, 2x multiplier, 3 max)
  - Error classification (retryable vs non-retryable)

### Phase 3: Database Models

- [ ] **Create `src/lib/database/models/transaction.ts`**:
  - CRUD operations for transactions
  - Status updates and retry tracking

- [ ] **Create `src/lib/database/models/pending-reward.ts`**:
  - CRUD operations for pending rewards
  - Process pending rewards on wallet connect

### Phase 4: API Endpoints

- [ ] **Update `src/app/api/corgi/confirm/route.ts`**:
  - Validate Telegram auth
  - Calculate reward amount
  - Check user wallet existence
  - Create transaction OR pending reward
  - Broadcast Jetton transfer if wallet exists

- [ ] **Create `src/app/api/transactions/route.ts`**:
  - GET: List user's transactions
  - Support filtering by status
  - Pagination support

- [ ] **Create `src/app/api/transactions/[id]/route.ts`**:
  - GET: Get transaction details by ID
  - Include sighting information

- [ ] **Create `src/app/api/pending-rewards/route.ts`** (optional):
  - GET: List user's pending rewards
  - Show total pending amount

- [ ] **Update `src/app/api/wallet/connect/route.ts`**:
  - Process all pending rewards when wallet connects
  - Create transactions for each pending reward
  - Update pending reward status

- [ ] **Create `src/app/api/webhooks/ton-transactions/route.ts`**:
  - Receive TONAPI webhook POST requests
  - Verify webhook signature
  - Update transaction status based on blockchain confirmation

### Phase 5: Monitoring

- [ ] **Create `src/lib/monitoring/transaction-monitor.ts`**:
  - Polling fallback for pending transactions
  - Check transactions older than 2 minutes
  - Run every 60 seconds via cron/setInterval

- [ ] **Create `src/lib/monitoring/webhook-verifier.ts`**:
  - Verify TONAPI webhook signatures
  - Security validation

### Phase 6: Frontend (Optional)

- [ ] **Create `src/components/transactions/TransactionHistory.tsx`**:
  - Display user's transaction list
  - Show status badges (pending, completed, failed)
  - Link to blockchain explorer

- [ ] **Create `src/components/transactions/TransactionStatus.tsx`**:
  - Status badge component
  - Color coding by status

---

## 4. Testing Strategy

### Unit Tests (Complex Logic Only)

```bash
# Create test file
touch tests/unit/reward-calculator.test.ts

# Run tests
pnpm run test tests/unit/reward-calculator.test.ts
```

Test cases for reward calculator:
- 1 corgi → 1 Corgi coin
- 2 corgis → 2 Corgi coins
- 5 corgis → 5 Corgi coins
- 10 corgis → 10 Corgi coins
- 0 corgis → throws error

### Integration Tests (Mandatory per Constitution)

```bash
# Create integration test files
touch tests/integration/jetton-reward-distribution.test.ts
touch tests/integration/transaction-history.test.ts
touch tests/integration/pending-rewards.test.ts
touch tests/integration/bank-monitoring.test.ts

# Run integration tests
pnpm run test tests/integration/
```

**Test User Story 1** (jetton-reward-distribution.test.ts):
1. Create test user with connected TON wallet
2. Create corgi sighting (3 corgis)
3. Buddy confirms sighting
4. Verify transaction created with correct amount (3 Corgi coins)
5. Mock blockchain broadcast
6. Verify transaction status updates

**Test User Story 2** (transaction-history.test.ts):
1. Create multiple transactions for test user
2. Call GET /api/transactions
3. Verify all transactions returned
4. Verify blockchain hash and sighting references

**Test User Story 3** (pending-rewards.test.ts):
1. Create test user WITHOUT wallet
2. Create and confirm sighting
3. Verify pending reward created (not transaction)
4. User connects wallet
5. Verify transaction created from pending reward

**Test User Story 4** (bank-monitoring.test.ts):
1. Mock low TON balance (<100)
2. Attempt reward distribution
3. Verify alert/error for insufficient gas
4. Mock low Jetton balance
5. Verify alert/error for insufficient rewards

### Manual Testing Checklist

- [ ] **Testnet Setup**:
  - Funded bank wallet with test TON
  - Funded bank wallet with test Jettons
  - Verified environment variables

- [ ] **Happy Path**:
  - Create sighting with connected wallet → receive reward
  - Check transaction appears in history
  - Verify blockchain hash on TON explorer
  - Confirm Jetton balance increased in user wallet

- [ ] **Pending Rewards Path**:
  - Create sighting without connected wallet
  - Verify pending reward notification
  - Connect wallet
  - Verify pending rewards auto-processed

- [ ] **Error Handling**:
  - Invalid wallet address → proper error
  - Insufficient bank balance → proper error
  - Duplicate confirmation → ignored (no duplicate reward)
  - Network error during broadcast → retry logic works

---

## 5. Development Workflow

### Start Development Server

```bash
# HTTPS required for Telegram testing
pnpm run dev:https
```

### Test in Telegram

1. **Submit to @BotFather**:
   ```
   Submit URL: https://127.0.0.1:3000
   NOT localhost (use 127.0.0.1)
   ```

2. **Open in Telegram**:
   - Telegram Web: https://web.telegram.org
   - Desktop app (macOS may have issues)

3. **Test Flow**:
   - Report corgi sighting
   - Have buddy confirm
   - Check if reward distributed or pending
   - View transaction history

### Monitor Transactions

```bash
# Check database for pending transactions
sqlite3 ./data/app.db "SELECT * FROM transactions WHERE status='pending';"

# Check pending rewards
sqlite3 ./data/app.db "SELECT * FROM pending_rewards WHERE status='pending';"

# Monitor logs for blockchain interactions
tail -f logs/app.log  # If logging configured
```

### Debug Blockchain Issues

```bash
# Check bank wallet balance
node -e "
const { TonClient, Address } = require('@ton/ton');
const client = new TonClient({ endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC' });
(async () => {
  const balance = await client.getBalance(Address.parse('EQ...'));
  console.log('Balance:', balance / 1e9, 'TON');
})();
"

# Verify Jetton wallet address
node -e "
const { TonClient, Address, beginCell } = require('@ton/ton');
// ... (implement get_wallet_address query)
"
```

---

## 6. Before Committing

### Pre-Commit Checklist

```bash
# 1. Format check (REQUIRED by constitution)
pnpm run format:check

# If fails, run formatter
pnpm run format

# 2. Lint check
pnpm run lint

# Fix lint errors
pnpm run lint --fix

# 3. Type check
pnpm run type-check

# 4. Run tests
pnpm run test

# 5. Validate (combines lint + type-check)
pnpm run validate
```

All checks must pass before committing (constitution requirement).

### Git Workflow

```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "feat: implement Jetton reward distribution for confirmed sightings

- Add @ton/ton SDK integration for server-side Jetton transfers
- Create transaction and pending reward database models
- Implement reward calculation (1-to-1 mapping: 1 corgi = 1 Corgi coin)
- Add API endpoints for transactions and pending rewards
- Add TONAPI webhook for real-time confirmations
- Add exponential backoff retry logic
- Add integration tests for all user stories
"

# Push to feature branch
git push origin 004-receive-reward-when
```

---

## 7. Deployment to Production

### Pre-Deployment Checklist

- [ ] All integration tests passing
- [ ] Tested on TON testnet end-to-end
- [ ] Environment variables configured for production
- [ ] Bank wallet funded with sufficient TON (gas) and Jettons (rewards)
- [ ] TONAPI webhook endpoint publicly accessible
- [ ] Monitoring and alerting configured
- [ ] Backup strategy for database

### Production Environment Variables

```bash
# Switch to mainnet
TON_NETWORK=mainnet
TON_API_KEY=production_tonapi_key
TON_BANK_WALLET_MNEMONIC="production mnemonic 24 words"
JETTON_MASTER_ADDRESS=EQ...  # Production Corgi coin contract

# Disable mock auth
NEXT_PUBLIC_USE_MOCK_AUTH=false
```

### Deploy and Verify

```bash
# Build for production
pnpm run build

# Start production server
pnpm run start

# Or deploy to hosting platform (Vercel, etc.)
```

### Post-Deployment Verification

1. **Smoke Test**:
   - Create test sighting and confirm
   - Verify reward distribution works
   - Check transaction appears in history

2. **Monitor First Hour**:
   - Watch transaction success rate
   - Monitor bank wallet balance
   - Check webhook delivery rate
   - Review error logs

3. **Alert Configuration**:
   - Low TON balance (<100 TON)
   - Low Jetton balance (<10,000 coins)
   - High transaction failure rate (>10%)
   - Stuck transactions (pending >10 min)

---

## 8. Troubleshooting

### Common Issues

**Issue**: "Insufficient gas for transaction"
- **Cause**: Bank wallet TON balance too low
- **Fix**: Fund bank wallet with more TON from faucet (testnet) or exchange (mainnet)

**Issue**: "Cannot find Jetton wallet address"
- **Cause**: User doesn't have Jetton wallet for this token yet
- **Fix**: User needs to receive at least 1 Jetton first to create wallet

**Issue**: "Transaction stuck in 'broadcasting' status"
- **Cause**: Webhook not firing or polling not running
- **Fix**: Check TONAPI webhook subscription, verify polling cron is running

**Issue**: "Invalid seqno" error (exit code 33)
- **Cause**: Sequence number mismatch, previous transaction may have succeeded
- **Fix**: Implement seqno verification before retry (see research.md)

**Issue**: "Webhook signature verification failed"
- **Cause**: Wrong TONAPI_WEBHOOK_SECRET or signature algorithm issue
- **Fix**: Verify secret matches TONAPI dashboard, check signature verification logic

### Debug Commands

```bash
# Check transaction status on blockchain
curl "https://testnet.toncenter.com/api/v2/getTransactions?address=EQ...&limit=10"

# View pending transactions in database
sqlite3 ./data/app.db "
SELECT id, status, created_at, retry_count, last_error
FROM transactions
WHERE status IN ('pending', 'broadcasting')
ORDER BY created_at DESC;
"

# Check TONAPI webhook subscriptions
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://tonapi.io/v2/webhooks"
```

---

## 9. Resources

### Documentation
- [Feature Spec](./spec.md) - Requirements and user stories
- [Research](./research.md) - Technical decisions and Jetton implementation
- [Data Model](./data-model.md) - Database schema and relationships
- [API Contracts](./contracts/) - OpenAPI specifications

### External Resources
- **TON Jetton Transfer**: https://docs.ton.org/v3/guidelines/ton-connect/cookbook/jetton-transfer
- **@ton/ton SDK**: https://github.com/ton-org/ton
- **TONAPI Docs**: https://docs.tonconsole.com
- **TON Explorer (Testnet)**: https://testnet.tonviewer.com
- **TON Explorer (Mainnet)**: https://tonviewer.com
- **Testnet Faucet**: https://t.me/testgiver_ton_bot

### Support
- TON Developers Chat: https://t.me/tondev_eng
- Project Issues: [GitHub Issues](https://github.com/your-repo/issues)
- Constitution: `.specify/memory/constitution.md`

---

## Next Steps

After completing this feature:
1. Create pull request with all changes
2. Request code review from team
3. Deploy to staging for QA testing
4. Monitor metrics in staging for 24 hours
5. Deploy to production
6. Monitor production metrics for first week
7. Iterate based on user feedback and transaction success rates

**Estimated Timeline**: 1-2 weeks for complete implementation and testing
