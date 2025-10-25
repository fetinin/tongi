# Tasks: Complete Corgi Reward Distribution System

**Feature**: 004-receive-reward-when
**Input**: Design documents from `/specs/004-receive-reward-when/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Integration tests and unit tests are REQUIRED per constitution (TDD approach)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and dependency installation

- [x] T001 Install @ton/ton SDK packages: `pnpm add @ton/ton @ton/core @ton/crypto`
- [x] T002 Configure environment variables in `.env.local` (TON_NETWORK, TON_BANK_WALLET_MNEMONIC, JETTON_MASTER_ADDRESS, JETTON_DECIMALS, TON_API_KEY, CORGI_BANK_TON_MIN_BALANCE, CORGI_BANK_JETTON_MIN_BALANCE)
- [x] T003 Verify testnet setup (bank wallet funded with test TON and Jettons, TONAPI key registered) - **SKIPPED - Non MVP**

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create database migration 004_transactions.sql in `src/lib/database/migrations/` with transactions table schema (columns: id, from_wallet, to_wallet, amount, status, transaction_hash, sighting_id, created_at, broadcast_at, confirmed_at, retry_count, last_retry_at, last_error, failure_reason) and indexes
- [x] T005 Create database migration 005_pending_rewards.sql in `src/lib/database/migrations/` with pending_rewards table schema (columns: id, user_id, sighting_id, amount, status, created_at, processed_at, transaction_id) and indexes
- [x] T006 Run database migrations: `pnpm run db:migrate`
- [x] T007 [P] Create TypeScript transaction model interface in `src/lib/database/models/transaction.ts` with Transaction, CreateTransactionInput, UpdateTransactionStatusInput types
- [x] T008 [P] Create TypeScript pending reward model interface in `src/lib/database/models/pending-reward.ts` with PendingReward, CreatePendingRewardInput, ProcessPendingRewardInput types
- [x] T009 [P] Create TON blockchain types in `src/types/blockchain.ts` (transaction status, network config, wallet types)
- [x] T010 [P] Create Jetton-specific types in `src/types/jetton.ts` (Jetton transfer params, wallet address types)
- [x] T011 Create TON client initialization module in `src/lib/blockchain/ton-client.ts` (initialize TonClient with testnet/mainnet endpoint, create WalletContractV4 from mnemonic, export client and wallet contract instances)
- [x] T012 [P] Create reward calculator module in `src/lib/rewards/calculator.ts` with calculateRewardAmount function (1-to-1 mapping: 1 corgi = 1 Corgi coin)
- [x] T013 [P] Create error classification module in `src/lib/rewards/error-classifier.ts` (classify retryable vs non-retryable errors: network errors, exit codes, rate limiting)
- [x] T014 [P] Create exponential backoff retry logic in `src/lib/rewards/retry.ts` (2s initial delay, 2x multiplier, 3 max attempts, ±10% jitter)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Successful Reward Distribution (Priority: P1) 🎯 MVP

**Goal**: When a buddy confirms a corgi sighting, the system automatically transfers Corgi coin Jettons from the bank wallet to the reporter's connected TON wallet on the blockchain.

**Independent Test**: Create test user with connected wallet, report sighting with 3 corgis, buddy confirms, verify transaction created with 3 Corgi coins, mock blockchain broadcast, verify status updates.

### Tests for User Story 1 (Write FIRST, ensure they FAIL before implementation) ⚠️

- [x] T015 [P] [US1] Unit test for reward calculator - **NOT NEEDED** (skipped per user request)
- [x] T016 [P] [US1] Unit test for retry logic - **NOT NEEDED** (skipped per user request)
- [x] T017 [US1] Integration test for Jetton reward distribution - **COMPLETED** (black-box test added to `tests/integration/corgi-flow.test.ts` using nock for HTTP mocking of TON RPC endpoints; tests buddy confirmation triggers transaction creation, correct amount calculation, blockchain broadcast, status updates)

### Implementation for User Story 1

- [x] T018 [US1] Create Jetton wallet query module in `src/lib/blockchain/jetton-wallet.ts` (function to get user's Jetton wallet address from master contract using get_wallet_address method)
- [x] T019 [US1] Create Jetton transfer message builder in `src/lib/blockchain/jetton-transfer.ts` (build transfer body with opcode 0xf8a7ea5, sign and broadcast transaction, return transaction hash and seqno)
- [x] T020 [US1] Create bank wallet balance monitor in `src/lib/blockchain/balance-monitor.ts` (check TON balance for gas against CORGI_BANK_TON_MIN_BALANCE, check Jetton balance for rewards against CORGI_BANK_JETTON_MIN_BALANCE, alert logic for low balances)
- [x] T021 [US1] Create transaction database service in `src/lib/database/models/transaction.ts` (CRUD operations: createTransaction, getTransactionById, getUserTransactions, updateTransactionStatus, getTransactionBySightingId, getPendingTransactions, getFailedTransactionsForRetry)
- [x] T022 [US1] Create reward distributor orchestration module in `src/lib/rewards/distributor.ts` (orchestrate flow: validate user wallet, calculate reward, check balances, create transaction record, broadcast Jetton transfer, handle errors with retry)
- [x] T023 [US1] Update corgi confirmation endpoint in `src/app/api/corgi/confirm/route.ts` (validate Telegram auth, check duplicate confirmation, call reward distributor for users with wallets, update sighting reward_status)
- [x] T024 [US1] Add seqno verification logic in `src/lib/blockchain/jetton-transfer.ts` (check if seqno changed before retry to detect successful broadcast despite error)
- [x] T025 [US1] Add transaction retry handler in `src/lib/rewards/distributor.ts` (implement exponential backoff, error classification, max 3 attempts, update retry_count and last_error)

**Checkpoint**: At this point, User Story 1 should be fully functional - buddies can confirm sightings and Jetton rewards are distributed to users with connected wallets.

---

## Phase 4: User Story 2 - Transaction Transparency and Verification (Priority: P2)

**Goal**: Users can view the status and details of their reward transactions, including pending, completed, and failed states with blockchain verification links.

**Independent Test**: Create transactions in various states (pending, completed, failed), verify users can view transaction details, blockchain hashes, timestamps through transaction history interface.

### Tests for User Story 2 (Write FIRST) ⚠️

- [x] T026 [US2] Integration test for transaction history - **SKIPPED - Non MVP**

### Implementation for User Story 2

- [x] T027 [P] [US2] Create GET /api/transactions endpoint - **SKIPPED - Non MVP**
- [x] T028 [P] [US2] Create GET /api/transactions/[id] endpoint - **SKIPPED - Non MVP**
- [x] T029 [P] [US2] Create TransactionStatus component - **SKIPPED - Non MVP**
- [x] T030 [US2] Create TransactionHistory component - **SKIPPED - Non MVP**

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - rewards distribute AND users can view transaction history.

---

## Phase 5: User Story 3 - Graceful Handling of Missing Wallet (Priority: P2)

**Goal**: When a buddy confirms a sighting for a user without a TON wallet, the system records a pending reward and automatically processes it when the user connects a wallet.

**Independent Test**: Create user without wallet, confirm sighting, verify pending reward created (not transaction), user connects wallet, verify transaction created from pending reward.

### Tests for User Story 3 (Write FIRST) ⚠️

- [x] T031 [US3] Integration test for pending rewards - **SKIPPED - Non MVP**

### Implementation for User Story 3

- [x] T032 [US3] Create pending reward database service - **SKIPPED - Non MVP**
- [x] T033 [US3] Update reward distributor - **SKIPPED - Non MVP**
- [x] T034 [US3] Update corgi confirmation endpoint - **SKIPPED - Non MVP**
- [x] T035 [US3] Create GET /api/pending-rewards endpoint - **SKIPPED - Non MVP**
- [x] T036 [US3] Update POST /api/wallet/connect endpoint - **SKIPPED - Non MVP**
- [x] T037 [US3] Create pending rewards notification component - **SKIPPED - Non MVP**

**Checkpoint**: All three user stories should now work independently - rewards distribute, users see history, and pending rewards are handled gracefully.

---

## Phase 6: User Story 4 - Bank Wallet Monitoring and Safety (Priority: P3)

**Goal**: System administrators can monitor bank wallet balance (TON for gas, Jettons for rewards) and receive alerts when balances fall below safe thresholds to prevent reward distribution failures.

**Independent Test**: Mock low bank wallet balance scenarios, verify administrators receive alerts, system prevents rewards when balance insufficient, appropriate messages shown to users.

### Tests for User Story 4 (Write FIRST) ⚠️

- [x] T038 [US4] Integration test for bank wallet monitoring - **SKIPPED - Non MVP**

### Implementation for User Story 4

- [x] T039 [US4] Enhance balance monitor - **SKIPPED - Non MVP**
- [x] T040 [US4] Create bank wallet status service - **SKIPPED - Non MVP**
- [x] T041 [US4] Update reward distributor - **SKIPPED - Non MVP**
- [x] T042 [US4] Create balance alert handler - **SKIPPED - Non MVP**
- [x] T043 [P] [US4] Create GET /api/admin/bank-wallet endpoint - **SKIPPED - Non MVP**
- [x] T044 [P] [US4] Create bank wallet dashboard component - **SKIPPED - Non MVP**

**Checkpoint**: All four user stories complete - full reward distribution system with monitoring and safety features.

---

## Phase 7: Transaction Monitoring (Cross-Cutting) - SKIPPED

**Purpose**: ~~Real-time transaction confirmation via webhooks + polling fallback~~ **NO LONGER NEEDED - Jetton transfers happen synchronously during corgi confirmation**

**Rationale**: Corgi coin Jetton transfers are now handled synchronously when a buddy confirms a sighting. The transaction is broadcast immediately and status is updated in the same request flow. Webhooks and polling are not necessary for this synchronous approach.

- [ ] ~~T045 [P] Create webhook signature verifier~~ **SKIPPED** - Not needed for synchronous transfers
- [ ] ~~T046 [P] Create POST /api/webhooks/ton-transactions endpoint~~ **SKIPPED** - Not needed for synchronous transfers
- [ ] ~~T047 Create transaction polling monitor~~ **SKIPPED** - Not needed for synchronous transfers
- [ ] ~~T048 Create blockchain status checker~~ **SKIPPED** - Not needed for synchronous transfers
- [ ] ~~T049 Integrate polling monitor into application startup~~ **SKIPPED** - Not needed for synchronous transfers

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T050 [P] Add comprehensive error handling to all API endpoints - **SKIPPED - Non MVP**
- [x] T051 [P] Add rate limiting to confirmation endpoint - **SKIPPED - Non MVP**
- [x] T052 [P] Add audit logging for all bank wallet operations - **SKIPPED - Non MVP**
- [x] T053 [P] Add validation for wallet addresses - **SKIPPED - Non MVP**
- [x] T054 [P] Verify no private key exposure - **SKIPPED - Non MVP**
- [x] T055 Code cleanup and refactoring - **SKIPPED - Non MVP**
- [x] T056 Run pre-commit validation - **SKIPPED - Non MVP**
- [x] T057 Manual testing per quickstart.md - **SKIPPED - Non MVP**
- [x] T058 Update project documentation if needed - **SKIPPED - Non MVP**

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order: US1 (P1) → US2 (P2) → US3 (P2) → US4 (P3)
- **Transaction Monitoring (Phase 7)**: Depends on US1 completion (needs transaction records to monitor)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Uses transaction records from US1 but independently testable
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Extends US1 flow but independently testable
- **User Story 4 (P3)**: Can start after Foundational (Phase 2) - Monitors US1 operations but independently testable

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD per constitution)
- Models before services
- Services before endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities Within User Stories

**Phase 2 (Foundational)**:
- T007 (transaction model), T008 (pending reward model), T009 (blockchain types), T010 (jetton types) can run in parallel
- T012 (calculator), T013 (error classifier), T014 (retry logic) can run in parallel

**Phase 3 (US1)**:
- T015 (calculator test), T016 (retry test) can run in parallel

**Phase 4 (US2)**:
- T027 (transactions endpoint), T028 (transaction detail endpoint), T029 (status component), T030 (history component) can run in parallel

**Phase 6 (US4)**:
- T043 (admin endpoint), T044 (admin dashboard) can run in parallel

**Phase 7 (Monitoring)**:
- T045 (webhook verifier), T046 (webhook endpoint) can run in parallel

**Phase 8 (Polish)**:
- T050 (error handling), T051 (rate limiting), T052 (audit logging), T053 (validation), T054 (private key scan) can run in parallel

---

## Parallel Example: User Story 1 Implementation

```bash
# After writing and verifying tests fail (T015, T016, T017):

# Launch foundational modules in parallel:
Task T018: "Create Jetton wallet query module"
Task T019: "Create Jetton transfer message builder"
Task T020: "Create bank wallet balance monitor"
Task T021: "Create transaction database service"

# Then implement orchestration (depends on above):
Task T022: "Create reward distributor orchestration"

# Then update endpoints (depends on orchestration):
Task T023: "Update corgi confirmation endpoint"

# Then add retry logic:
Task T024: "Add seqno verification logic"
Task T025: "Add transaction retry handler"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T014) - CRITICAL blocking phase
3. Complete Phase 3: User Story 1 (T015-T025)
4. **STOP and VALIDATE**: Test User Story 1 independently on testnet
5. If successful, deploy MVP with just reward distribution

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP! ✅ Rewards work)
3. Add User Story 2 → Test independently → Deploy/Demo (✅ Users see transaction history)
4. Add User Story 3 → Test independently → Deploy/Demo (✅ Pending rewards handled)
5. Add Phase 7 (Monitoring) → Test → Deploy (✅ Real-time confirmations)
6. Add User Story 4 → Test independently → Deploy/Demo (✅ Admin monitoring)
7. Each increment adds value without breaking previous functionality

### Parallel Team Strategy

With 2-3 developers after Foundational phase completes:

1. Team completes Setup + Foundational together (T001-T014)
2. Once Foundational is done (checkpoint reached):
   - **Developer A**: User Story 1 (T015-T025) - Highest priority, MVP
   - **Developer B**: User Story 2 (T026-T030) - Can start in parallel
   - **Developer C**: User Story 3 (T031-T037) - Can start in parallel
3. After US1-3 complete:
   - **Developer A**: Transaction Monitoring (T045-T049) - Needs US1
   - **Developer B**: User Story 4 (T038-T044) - Can run in parallel
4. Team completes Polish together (T050-T058)

---

## Task Count Summary

- **Phase 1 (Setup)**: 3 tasks
- **Phase 2 (Foundational)**: 11 tasks ⚠️ BLOCKING
- **Phase 3 (User Story 1)**: 11 tasks (3 tests + 8 implementation) 🎯 MVP
- **Phase 4 (User Story 2)**: 5 tasks (1 test + 4 implementation)
- **Phase 5 (User Story 3)**: 7 tasks (1 test + 6 implementation)
- **Phase 6 (User Story 4)**: 7 tasks (1 test + 6 implementation)
- **Phase 7 (Monitoring)**: 5 tasks
- **Phase 8 (Polish)**: 9 tasks

**Total**: 58 tasks

**Parallel Opportunities**: 21 tasks marked [P] for parallel execution

**MVP Scope**: Phases 1-3 = 25 tasks for basic reward distribution

---

## Notes

- **[P]** tasks = different files, no dependencies, can run in parallel
- **[Story]** label (US1-US4) maps task to specific user story for traceability
- Each user story is independently completable and testable per constitution
- **TDD Required**: Write tests first, verify they fail, then implement (constitution mandate)
- Commit after each task or logical group of parallel tasks
- Stop at any checkpoint to validate story independently
- Run `pnpm run validate` before committing (lint + type-check)
- Run `pnpm run format:check` before committing (constitution requirement)
- Test on TON testnet before production deployment
- Avoid same-file conflicts by sequencing non-parallel tasks properly
