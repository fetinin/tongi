# Implementation Plan: Complete Corgi Reward Distribution System

**Branch**: `004-receive-reward-when` | **Date**: 2025-10-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-receive-reward-when/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Complete the implementation of the corgi reward distribution system. When a buddy confirms a corgi sighting, the system must automatically transfer Corgi coin Jettons from the bank wallet to the reporter's connected TON wallet on the blockchain using TEP-74 Jetton transfer protocol. The system will handle users without wallets by recording pending rewards, provide transaction history with blockchain verification, and ensure secure server-side Jetton transfer signing using the @ton/ton SDK.

**Critical Finding**: Corgi coin Jetton is a token following TON's TEP-74 standard, not native TON. This requires Jetton-specific smart contract interactions using opcode `0xf8a7ea5` and querying Jetton wallet addresses before transfers. See [research.md](./research.md) for detailed implementation requirements.

## Technical Context

**Language/Version**: TypeScript 5 with strict mode, ES2017 target
**Primary Dependencies**: Next.js 15 (App Router), @telegram-apps/sdk-react, @tonconnect/ui-react (v2.3.0+), @ton/ton (v15.4.0+) with @ton/core and @ton/crypto for Jetton transfers, better-sqlite3
**Storage**: SQLite 3 (`./data/app.db`) for transaction records, sighting state, and pending rewards
**Testing**: Jest with ts-jest for TypeScript support, integration tests for user stories (mandatory per constitution)
**Target Platform**: Telegram Mini App (web-based, client-side rendering), server-side API routes for blockchain operations
**Project Type**: Web application (Next.js frontend + API routes backend)
**Performance Goals**: Jetton transfer broadcast within 5 seconds, transaction status updates within 30 seconds of blockchain confirmation
**Constraints**: Bank wallet mnemonic must remain server-side only, no client-side exposure; Jetton transfers require ~0.05 TON gas per transaction; retry logic for failed broadcasts (3 attempts with exponential backoff); must verify both Jetton balance (Corgi coin Jettons) and TON balance (gas fees) before transfers
**Scale/Scope**: 1k-10k users initially, hundreds of daily reward Jetton transactions, SQLite appropriate for this scale

**Environment Variables Required**:
- `TON_NETWORK`: testnet or mainnet
- `TON_BANK_WALLET_MNEMONIC`: 24-word mnemonic phrase for bank wallet
- `JETTON_MASTER_ADDRESS`: Corgi coin Jetton master contract address
- `JETTON_DECIMALS`: Corgi coin decimals (typically 9)
- `TON_API_KEY`: TONAPI key for webhooks and monitoring
- `TONAPI_WEBHOOK_SECRET`: For webhook signature verification
- `CORGI_BANK_TON_MIN_BALANCE`: Minimum TON balance threshold for gas fees (e.g., "1.0")
- `CORGI_BANK_JETTON_MIN_BALANCE`: Minimum Jetton balance threshold for rewards (e.g., "1000")

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Security-First Development ✅

- **Server-side Telegram auth validation**: ✅ Existing pattern established, all reward endpoints will validate initData
- **TON Connect SDK usage**: ✅ Frontend already uses @tonconnect/ui-react for user wallets
- **Bank wallet private key security**: ✅ Will be stored in environment variables, accessed only in API routes
- **No client-side private key exposure**: ✅ All transaction signing happens server-side in API routes

### II. Telegram Platform Integration ✅

- **Function within Telegram environment**: ✅ Uses existing Root component and Telegram SDK initialization
- **Mock mode for development**: ✅ Existing mockTelegramEnv pattern will be used
- **Theme integration**: ✅ No UI changes required, using existing theme system
- **i18n from Telegram locale**: ✅ Existing i18n system already configured

### III. Type Safety & Code Quality ✅

- **TypeScript strict type checking**: ✅ Will run `pnpm run type-check` before commit
- **ESLint validation**: ✅ Will run `pnpm run lint` before commit
- **Prettier formatting**: ✅ Will run `pnpm run format:check` before commit (pre-commit gate)
- **Combined validation**: ✅ Will run `pnpm run validate` before commit

### IV. Testing Strategy & Quality Gates 🚧 NEEDS ATTENTION

- **Integration tests for user stories**: 🔴 REQUIRED - Must write integration tests covering:
  - User Story 1: Successful reward distribution (P1)
  - User Story 2: Transaction transparency (P2)
  - User Story 3: Missing wallet handling (P2)
  - User Story 4: Bank wallet monitoring (P3)
- **Mocking restrictions**: ✅ Will only mock external services (TON blockchain RPC, Telegram Bot API)
- **Unit test scope**: ✅ Will write unit tests only for reward calculation algorithm (simple 1-to-1 mapping)
- **Red-green-refactor cycle**: 🔴 REQUIRED - Must follow TDD for all new functionality

**GATE STATUS**: ⚠️ CONDITIONAL PASS - Feature can proceed to Phase 0 research, but implementation phase MUST NOT begin until integration tests are written per TDD cycle.

### V. Database Integrity ✅

- **Migrations for schema changes**: ✅ Will use `pnpm run db:migrate` for Transaction and PendingReward tables
- **Reversible migrations**: ✅ Will implement down migrations where practical
- **Idempotent seed data**: ✅ Will ensure bank wallet seed is idempotent if created

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
src/
├── app/
│   └── api/
│       ├── corgi/
│       │   └── confirm/route.ts          # Triggers Jetton reward distribution
│       ├── transactions/
│       │   ├── route.ts                   # List user Jetton transactions
│       │   └── [id]/route.ts              # Get transaction details
│       ├── wallet/
│       │   └── connect/route.ts           # Process pending rewards on wallet connect
│       └── webhooks/
│           └── ton-transactions/route.ts  # NEW: TONAPI webhook endpoint
├── components/
│   ├── wallet/
│   │   └── TonProvider.tsx                # Existing TON Connect integration
│   └── transactions/
│       ├── TransactionHistory.tsx         # NEW: Display Jetton transaction list
│       └── TransactionStatus.tsx          # NEW: Show transaction status badge
├── lib/
│   ├── blockchain/
│   │   ├── ton-client.ts                  # NEW: TON SDK client initialization
│   │   ├── jetton-transfer.ts             # NEW: Jetton transfer message builder
│   │   ├── jetton-wallet.ts               # NEW: Get user's Jetton wallet address
│   │   └── balance-monitor.ts             # NEW: Check TON and Jetton balances
│   ├── rewards/
│   │   ├── calculator.ts                  # NEW: Calculate reward amounts (1-to-1 mapping)
│   │   ├── distributor.ts                 # NEW: Orchestrate Jetton reward distribution
│   │   └── retry.ts                       # NEW: Exponential backoff retry logic
│   ├── monitoring/
│   │   ├── transaction-monitor.ts         # NEW: Poll pending transactions
│   │   └── webhook-verifier.ts            # NEW: Verify TONAPI webhook signatures
│   └── database/
│       ├── migrations/
│       │   ├── 004_transactions.sql       # NEW: Transaction table with retry fields
│       │   └── 005_pending_rewards.sql    # NEW: PendingReward table
│       └── models/
│           ├── transaction.ts             # NEW: Transaction model
│           └── pending-reward.ts          # NEW: PendingReward model
└── types/
    ├── blockchain.ts                       # NEW: TON transaction types
    └── jetton.ts                           # NEW: Jetton-specific types

tests/
├── integration/
│   ├── jetton-reward-distribution.test.ts # NEW: User Story 1 (Jetton transfers)
│   ├── transaction-history.test.ts        # NEW: User Story 2 tests
│   ├── pending-rewards.test.ts            # NEW: User Story 3 tests
│   └── bank-monitoring.test.ts            # NEW: User Story 4 (TON + Jetton balance)
└── unit/
    ├── reward-calculator.test.ts          # NEW: Reward calculation (1-to-1 mapping)
    └── retry-logic.test.ts                # NEW: Exponential backoff tests

data/
└── app.db                                  # SQLite database (existing)
```

**Structure Decision**: Web application structure using Next.js App Router. API routes handle server-side Jetton transfer operations using @ton/ton SDK to maintain bank wallet mnemonic security. Jetton-specific modules handle transfer message building, wallet address resolution, and balance monitoring for both TON (gas) and Jettons (rewards). TONAPI webhook endpoint receives real-time transaction confirmations. Frontend components display Jetton transaction history and status. Database models and migrations in lib/database for schema management. Integration tests organized by user story as required by constitution, with unit tests for complex reward calculation and retry logic.

## Post-Design Constitution Re-evaluation

*Re-checked after Phase 1 design completion*

### I. Security-First Development ✅ PASS

- **Server-side Telegram auth**: ✅ All endpoints validate initData (see contracts/reward-distribution-api.yaml)
- **TON Connect SDK**: ✅ User wallets use @tonconnect/ui-react
- **Bank wallet security**: ✅ Mnemonic in env vars, all signing in API routes (see quickstart.md)
- **No client exposure**: ✅ All Jetton transfers in `src/lib/blockchain/` server-side only

### II. Telegram Platform Integration ✅ PASS

- **Telegram functionality**: ✅ No changes to existing Root component
- **Mock mode**: ✅ Uses existing NEXT_PUBLIC_USE_MOCK_AUTH pattern
- **Theme integration**: ✅ No UI changes, existing theme system unchanged
- **i18n**: ✅ No localization changes needed

### III. Type Safety & Code Quality ✅ PASS

- **TypeScript models**: ✅ Full TypeScript interfaces in data-model.md
- **Type safety**: ✅ All models use strict types (bigint for amounts, enum for status)
- **Pre-commit gates**: ✅ Quickstart.md documents required validation steps
- **ESLint/Prettier**: ✅ Must pass before commit per constitution

### IV. Testing Strategy & Quality Gates ✅ PASS (Design Phase)

- **Integration test coverage**: ✅ 4 integration test files planned for 4 user stories
  - tests/integration/jetton-reward-distribution.test.ts (US1)
  - tests/integration/transaction-history.test.ts (US2)
  - tests/integration/pending-rewards.test.ts (US3)
  - tests/integration/bank-monitoring.test.ts (US4)
- **Unit test scope**: ✅ Limited to complex logic (reward calculator, retry logic)
- **Mock restrictions**: ✅ Only external services mocked (TON RPC, TONAPI)
- **TDD cycle**: ⚠️ Implementation phase MUST write tests before code

**Implementation Reminder**: Write integration tests BEFORE implementing each user story (red-green-refactor).

### V. Database Integrity ✅ PASS

- **Migrations**: ✅ Two migrations planned (004_transactions.sql, 005_pending_rewards.sql)
- **Reversibility**: ✅ Down migrations can be implemented (DROP TABLE)
- **Referential integrity**: ✅ All foreign keys defined with ON DELETE RESTRICT

### Final Gate Status: ✅ APPROVED FOR IMPLEMENTATION

All constitution principles satisfied. Proceed to Phase 2 (task generation via /speckit.tasks).

## Complexity Tracking

*No constitutional violations requiring justification*

All design decisions align with core principles. No additional complexity introduced beyond necessary Jetton transfer requirements.
