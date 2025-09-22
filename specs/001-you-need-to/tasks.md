After each task is done. YOU MUST mark it as complete in this file and commit changes in git.

# Tasks: Corgi Buddy TON Cryptocurrency Mini-App

**Input**: Design documents from `/specs/001-you-need-to/`
**Prerequisites**: research.md, data-model.md, contracts/api-spec.yaml, quickstart.md

## Phase 3.1: Setup
- [x] T001 Create project structure per research.md architecture patterns
- [x] T002 Initialize Next.js 15 project with TypeScript and pnpm dependencies
- [x] T003 [P] Configure ESLint, Prettier, and TypeScript strict mode
- [x] T004 [P] Setup SQLite database with schema from data-model.md
- [x] T005 [P] Configure environment variables for Telegram Bot, TON Connect, and database

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Authentication Tests
- [x] T006 [P] Contract test POST /api/auth/validate in tests/api/auth.test.ts
- [x] T007 [P] Integration test Telegram initData validation in tests/integration/auth.test.ts

### Buddy Management Tests
- [x] T008 [P] Contract test GET /api/buddy/search in tests/api/buddy-search.test.ts
- [x] T009 [P] Contract test POST /api/buddy/request in tests/api/buddy-request.test.ts
- [x] T010 [P] Contract test GET /api/buddy/status in tests/api/buddy-status.test.ts
- [x] T011 [P] Integration test buddy pairing flow in tests/integration/buddy-pairing.test.ts

### Corgi Sighting Tests
- [x] T012 [P] Contract test POST /api/corgi/sightings in tests/api/corgi-sightings.test.ts
- [x] T013 [P] Contract test GET /api/corgi/sightings in tests/api/corgi-sightings-get.test.ts
- [x] T014 [P] Contract test GET /api/corgi/confirmations in tests/api/corgi-confirmations.test.ts
- [x] T015 [P] Contract test POST /api/corgi/confirm/[id] in tests/api/corgi-confirm.test.ts
- [x] T016 [P] Integration test corgi sighting confirmation flow in tests/integration/corgi-flow.test.ts

### Wish Management Tests
- [x] T017 [P] Contract test POST /api/wishes in tests/api/wishes-create.test.ts
- [x] T018 [P] Contract test GET /api/wishes in tests/api/wishes-get.test.ts
- [x] T019 [P] Contract test GET /api/wishes/pending in tests/api/wishes-pending.test.ts
- [x] T020 [P] Contract test POST /api/wishes/[id]/respond in tests/api/wishes-respond.test.ts
- [x] T021 [P] Integration test wish creation and approval flow in tests/integration/wish-flow.test.ts

### Marketplace Tests
- [x] T022 [P] Contract test GET /api/marketplace in tests/api/marketplace.test.ts
- [x] T023 [P] Contract test POST /api/marketplace/[id]/purchase in tests/api/marketplace-purchase.test.ts
- [x] T024 [P] Integration test wish purchase flow in tests/integration/marketplace-flow.test.ts

### Transaction Tests
- [x] T025 [P] Contract test GET /api/transactions in tests/api/transactions.test.ts
- [x] T026 [P] Contract test POST /api/transactions/[id]/confirm in tests/api/transactions-confirm.test.ts
- [x] T027 [P] Integration test transaction confirmation flow in tests/integration/transaction-flow.test.ts

### Bank Wallet Tests
- [x] T028 [P] Contract test GET /api/bank/status in tests/api/bank-status.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Database Models
- [x] T029 [P] User model in src/models/User.ts
- [x] T030 [P] BuddyPair model in src/models/BuddyPair.ts
- [x] T031 [P] CorgiSighting model in src/models/CorgiSighting.ts
- [x] T032 [P] Wish model in src/models/Wish.ts
- [x] T033 [P] Transaction model in src/models/Transaction.ts
- [x] T034 [P] BankWallet model in src/models/BankWallet.ts

### Database Setup
- [x] T035 Database migration script in scripts/migrate.ts
- [x] T036 Database seed script in scripts/seed.ts
- [x] T037 Database connection utility in src/lib/database.ts

### Services Layer
- [x] T038 [P] UserService CRUD operations in src/services/UserService.ts
- [x] T039 [P] BuddyService relationship management in src/services/BuddyService.ts
- [x] T040 [P] CorgiService sighting operations in src/services/CorgiService.ts
- [x] T041 [P] WishService wish management in src/services/WishService.ts
- [x] T042 [P] TransactionService TON operations in src/services/TransactionService.ts
- [x] T043 [P] BankService wallet operations in src/services/BankService.ts

### Core Utilities
- [x] T044 [P] Telegram initData validation utility in src/lib/telegram.ts
- [x] T045 [P] TON Connect integration utility in src/lib/ton.ts
- [x] T046 [P] JWT authentication middleware in src/middleware/auth.ts

### API Endpoints - Authentication
- [x] T047 POST /api/auth/validate endpoint in src/app/api/auth/validate/route.ts

### API Endpoints - Buddy Management
- [x] T048 GET /api/buddy/search endpoint in src/app/api/buddy/search/route.ts
- [x] T049 POST /api/buddy/request endpoint in src/app/api/buddy/request/route.ts
- [x] T050 GET /api/buddy/status endpoint in src/app/api/buddy/status/route.ts

### API Endpoints - Corgi Sightings
- [x] T051 POST /api/corgi/sightings endpoint in src/app/api/corgi/sightings/route.ts
- [x] T052 GET /api/corgi/sightings endpoint (same file as T051)
- [x] T053 GET /api/corgi/confirmations endpoint in src/app/api/corgi/confirmations/route.ts
- [x] T054 POST /api/corgi/confirm/[id] endpoint in src/app/api/corgi/confirm/[id]/route.ts

### API Endpoints - Wish Management
- [x] T055 POST /api/wishes endpoint in src/app/api/wishes/route.ts
- [x] T056 GET /api/wishes endpoint (same file as T055)
- [x] T057 GET /api/wishes/pending endpoint in src/app/api/wishes/pending/route.ts
- [x] T058 POST /api/wishes/[id]/respond endpoint in src/app/api/wishes/[id]/respond/route.ts

### API Endpoints - Marketplace
- [x] T059 GET /api/marketplace endpoint in src/app/api/marketplace/route.ts
- [x] T060 POST /api/marketplace/[id]/purchase endpoint in src/app/api/marketplace/[id]/purchase/route.ts

### API Endpoints - Transactions
- [x] T061 GET /api/transactions endpoint in src/app/api/transactions/route.ts
- [x] T062 POST /api/transactions/[id]/confirm endpoint in src/app/api/transactions/[id]/confirm/route.ts

### API Endpoints - Bank Management
- [x] T063 GET /api/bank/status endpoint in src/app/api/bank/status/route.ts

## Phase 3.4: Frontend Components

### Core Components
**IMPORTANT**: All components MUST use @telegram-apps/telegram-ui. Get documentation via context7 by searching for "telegramui".

- [x] T064 [P] Root app wrapper with Telegram SDK using AppRoot from @telegram-apps/telegram-ui in src/components/Root/Root.tsx
- [x] T065 [P] Authentication provider using telegram-ui components in src/components/Auth/AuthProvider.tsx
- [x] T066 [P] TON Connect provider using telegram-ui components in src/components/Wallet/TonProvider.tsx

### Buddy Components
**IMPORTANT**: Use @telegram-apps/telegram-ui components (List, Section, Cell, etc.). Get docs via context7 "telegramui".

- [ ] T067 [P] Buddy search component using telegram-ui List/Cell in src/components/buddy/BuddySearch.tsx
- [ ] T068 [P] Buddy status display using telegram-ui Section/Cell in src/components/buddy/BuddyStatus.tsx
- [ ] T069 [P] Buddy request handler using telegram-ui components in src/components/buddy/BuddyRequest.tsx

### Corgi Components
**IMPORTANT**: Use @telegram-apps/telegram-ui components. Get docs via context7 "telegramui".

- [ ] T070 [P] Corgi sighting form using telegram-ui form components in src/components/corgi/SightingForm.tsx
- [ ] T071 [P] Corgi confirmation interface using telegram-ui List/Section in src/components/corgi/ConfirmationList.tsx
- [ ] T072 [P] Sighting history display using telegram-ui List/Cell in src/components/corgi/SightingHistory.tsx

### Wish Components
**IMPORTANT**: Use @telegram-apps/telegram-ui components. Get docs via context7 "telegramui".

- [ ] T073 [P] Wish creation form using telegram-ui form components in src/components/wish/WishForm.tsx
- [ ] T074 [P] Wish approval interface using telegram-ui List/Section in src/components/wish/WishApproval.tsx
- [ ] T075 [P] User wish list using telegram-ui List/Cell in src/components/wish/WishList.tsx

### Marketplace Components
**IMPORTANT**: Use @telegram-apps/telegram-ui components. Get docs via context7 "telegramui".

- [ ] T076 [P] Marketplace wish grid using telegram-ui List/Section/Cell in src/components/marketplace/MarketplaceGrid.tsx
- [ ] T077 [P] Wish purchase modal using telegram-ui modal components in src/components/marketplace/PurchaseModal.tsx

### Transaction Components
**IMPORTANT**: Use @telegram-apps/telegram-ui components. Get docs via context7 "telegramui".

- [ ] T078 [P] Transaction history using telegram-ui List/Cell in src/components/transactions/TransactionHistory.tsx
- [ ] T079 [P] Transaction status display using telegram-ui components in src/components/transactions/TransactionStatus.tsx

## Phase 3.5: Page Implementation
**IMPORTANT**: All pages MUST import '@telegram-apps/telegram-ui/dist/styles.css' and use telegram-ui components.

- [ ] T080 Main app page using telegram-ui AppRoot wrapper in src/app/page.tsx
- [ ] T081 Buddy management page using telegram-ui components in src/app/buddy/page.tsx
- [ ] T082 Corgi sighting page using telegram-ui components in src/app/corgi/page.tsx
- [ ] T083 Wish management page using telegram-ui components in src/app/wishes/page.tsx
- [ ] T084 Marketplace page using telegram-ui components in src/app/marketplace/page.tsx
- [ ] T085 Transaction history page using telegram-ui components in src/app/transactions/page.tsx

## Phase 3.6: Integration
- [ ] T086 Connect services to database models
- [ ] T087 Implement Telegram bot notification system
- [ ] T088 Wire up TON Connect transaction flow
- [ ] T089 Add error handling and logging throughout app
- [ ] T090 Configure CORS and security headers

## Phase 3.7: Polish
- [ ] T091 [P] Unit tests for validation utilities in tests/unit/validation.test.ts
- [ ] T092 [P] Unit tests for Telegram utilities in tests/unit/telegram.test.ts
- [ ] T093 [P] Unit tests for TON utilities in tests/unit/ton.test.ts
- [ ] T094 End-to-end tests following quickstart.md scenarios
- [ ] T095 Security audit for HMAC validation and SQL injection
- [ ] T096 Mobile responsiveness and Telegram theme integration
- [ ] T097 Production deployment configuration

## Dependencies

### Critical Path
- Setup (T001-T005) before everything
- Database setup (T035-T037) before services and endpoints
- Tests (T006-T028) before implementation (T029-T098)
- Models (T029-T034) before services (T038-T043)
- Services before endpoints (T047-T063)
- Core utilities (T044-T046) before endpoints
- Frontend providers (T064-T066) before components (T067-T079)
- Components before pages (T080-T085)
- Implementation before integration (T086-T090)
- Everything before polish (T091-T098)

### Parallel Dependencies
- T001 blocks T002, T035
- T035 blocks T029-T034, T038-T043
- T038-T043 block T047-T063
- T044-T046 block T047-T063
- T064-T066 block T067-T079
- T067-T079 block T080-T085

## Parallel Execution Examples

### Phase 3.2 (All Tests) - 23 tasks in parallel:
```
Task: "Contract test POST /api/auth/validate in tests/api/auth.test.ts"
Task: "Integration test Telegram initData validation in tests/integration/auth.test.ts"
Task: "Contract test GET /api/buddy/search in tests/api/buddy-search.test.ts"
Task: "Contract test POST /api/buddy/request in tests/api/buddy-request.test.ts"
[... all test tasks T006-T028]
```

### Phase 3.3a (Models) - 6 tasks in parallel:
```
Task: "User model in src/models/User.ts"
Task: "BuddyPair model in src/models/BuddyPair.ts"
Task: "CorgiSighting model in src/models/CorgiSighting.ts"
Task: "Wish model in src/models/Wish.ts"
Task: "Transaction model in src/models/Transaction.ts"
Task: "BankWallet model in src/models/BankWallet.ts"
```

### Phase 3.3b (Services) - 6 tasks in parallel:
```
Task: "UserService CRUD operations in src/services/UserService.ts"
Task: "BuddyService relationship management in src/services/BuddyService.ts"
Task: "CorgiService sighting operations in src/services/CorgiService.ts"
Task: "WishService wish management in src/services/WishService.ts"
Task: "TransactionService TON operations in src/services/TransactionService.ts"
Task: "BankService wallet operations in src/services/BankService.ts"
```

### Phase 3.4a (Component Groups) - Multiple parallel sets:
```
# Buddy components (3 tasks):
Task: "Buddy search component in src/components/buddy/BuddySearch.tsx"
Task: "Buddy status display in src/components/buddy/BuddyStatus.tsx"
Task: "Buddy request handler in src/components/buddy/BuddyRequest.tsx"

# Corgi components (3 tasks):
Task: "Corgi sighting form in src/components/corgi/SightingForm.tsx"
Task: "Corgi confirmation interface in src/components/corgi/ConfirmationList.tsx"
Task: "Sighting history display in src/components/corgi/SightingHistory.tsx"
```

## Notes
- [P] tasks = different files, no dependencies
- Verify tests fail before implementing (critical for TDD)
- Each API endpoint task specifies exact file path
- Tests must be written first and must fail
- Commit after each major phase completion
- Follow research.md architecture patterns throughout
- Use data-model.md entities for all database operations
- Implement all contracts from api-spec.yaml
- Validate against quickstart.md test scenarios

## Task Validation Checklist
*GATE: Verified before execution*

- [x] All API contracts have corresponding tests (T006-T028)
- [x] All entities have model tasks (T029-T034)
- [x] All services have implementation tasks (T038-T043)
- [x] All endpoints from api-spec.yaml covered (T047-T063)
- [x] Tests come before implementation (Phase 3.2 before 3.3)
- [x] Parallel tasks target different files
- [x] Each task specifies exact file path
- [x] Dependencies properly mapped
- [x] Quickstart scenarios covered in integration tests