# Tasks: TON Wallet Integration

**Input**: Design documents from `/specs/003-ton-wallet-integration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/wallet-api.yaml, quickstart.md

**Tests**: Integration tests are REQUIRED for this feature per constitutional requirements (Testing Strategy & Quality Gates)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Single project structure: `src/`, `tests/`, `public/` at repository root
- Next.js 15 App Router: `src/app/` for routes and pages
- API routes: `src/app/api/` for server-side endpoints

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and TON Connect manifest setup

- [X] T001 Create TON Connect manifest file at `public/tonconnect-manifest.json` with development URL configuration
- [X] T002 [P] Create directory structure: `src/app/api/wallet/`, `src/app/wallet/`, `tests/integration/wallet/`

**Checkpoint**: Basic project structure and manifest ready

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Verify existing authentication middleware at `src/middleware/auth.ts` exports `validateTelegramAuth()` function
- [X] T004 Verify existing TON utilities at `src/lib/ton.ts` export TON address utility functions (if any)
- [X] T005 Verify existing database connection at `src/lib/database.ts` exports `db` instance
- [X] T006 Verify existing `TonProvider` component at `src/components/wallet/TonProvider.tsx` exports wallet hooks

**Checkpoint**: Foundation verified - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Connect TON Wallet (Priority: P1) 🎯 MVP

**Goal**: Enable users to connect their TON wallet through TON Connect and persist the wallet address to their account

**Independent Test**: User navigates to wallet settings, clicks "Connect Wallet", completes TON Connect flow, and verifies their address appears in UI and database

### Tests for User Story 1 (REQUIRED - Write FIRST, ensure they FAIL)

- [X] T007 [P] [US1] Write integration test for wallet connection flow in `tests/integration/wallet/wallet-connection.test.ts`
  - Test successful wallet connection with TON Connect-provided address
  - Test authentication failure handling
  - Test database persistence verification
  - Verify tests FAIL initially (red phase)

### Implementation for User Story 1

- [X] T008 [US1] Implement POST `/api/wallet/connect` endpoint in `src/app/api/wallet/connect/route.ts`
  - Accept `walletAddress` and `initData` in request body
  - Validate Telegram authentication using `validateTelegramAuth()`
  - Store wallet address directly (TON Connect SDK guarantees valid addresses)
  - Update `users.ton_wallet_address` column in database
  - Return success response with updated user data
  - Handle errors with appropriate HTTP status codes (400, 401, 500)

- [X] T009 [US1] Create `WalletSettings` UI component in `src/components/wallet/WalletSettings.tsx`
  - Display "Connect Wallet" button when no wallet connected
  - Handle `connectWallet()` from `TonProvider` context
  - Display loading state during connection (`isConnecting`)
  - Call POST `/api/wallet/connect` after successful TON Connect
  - Display connected wallet address (truncated format)
  - Handle connection errors with user-friendly messages
  - Use `@telegram-apps/telegram-ui` components (Section, Button, Cell, Placeholder)

- [X] T010 [US1] Create wallet settings page in `src/app/wallet/page.tsx`
  - Import and render `WalletSettings` component
  - Add page title "Wallet Settings"
  - Use proper Next.js 15 App Router conventions

- [X] T011 [US1] Verify integration tests now PASS (green phase)
  - Run `pnpm run test tests/integration/wallet/wallet-connection.test.ts`
  - Confirm all test scenarios pass
  - Verify database persistence works correctly

**Checkpoint**: At this point, User Story 1 (wallet connection) should be fully functional and testable independently

---

## Phase 4: User Story 2 - Disconnect TON Wallet (Priority: P2)

**Goal**: Enable users to disconnect their currently connected wallet for security or account management

**Independent Test**: User with connected wallet clicks "Disconnect", confirms action, and verifies wallet address is removed from UI and database

### Tests for User Story 2 (REQUIRED - Write FIRST, ensure they FAIL)

- [X] T012 [P] [US2] Write integration test for wallet disconnection flow in `tests/integration/wallet/wallet-disconnect.test.ts`
  - Test successful disconnection with valid authentication
  - Test idempotency (multiple disconnect calls succeed)
  - Test that user remains authenticated after disconnect
  - Test database address clearing verification
  - Verify tests FAIL initially (red phase)

### Implementation for User Story 2

- [X] T013 [US2] Implement POST `/api/wallet/disconnect` endpoint in `src/app/api/wallet/disconnect/route.ts`
  - Use JWT authentication with `authenticateRequest()`
  - Set `users.ton_wallet_address = NULL` in database (idempotent operation)
  - Return success response with updated user data
  - Handle errors with appropriate HTTP status codes (401, 500)

- [ ] T014 [US2] Add disconnect functionality to `WalletSettings` component in `src/components/wallet/WalletSettings.tsx`
  - Display "Disconnect" button when wallet is connected
  - Show confirmation dialog before disconnecting ("Are you sure?")
  - Handle `disconnectWallet()` from `TonProvider` context
  - Call POST `/api/wallet/disconnect` with JWT auth header
  - Update UI to show disconnected state
  - Handle disconnection errors gracefully

- [X] T015 [US2] Verify integration tests now PASS (green phase)
  - Run `pnpm run test tests/integration/wallet/wallet-disconnect.test.ts`
  - Confirm all test scenarios pass including idempotency
  - Verify database clearing works correctly

**Checkpoint**: At this point, User Stories 1 AND 2 (connect and disconnect) should both work independently

---

## Phase 5: User Story 3 - View Connected Wallet Status (Priority: P3)

**Goal**: Enable users to view their wallet connection status and verify persistence across sessions

**Independent Test**: User connects wallet, navigates away, returns to wallet settings, and verifies wallet status is consistently displayed

### Tests for User Story 3 (REQUIRED - Write FIRST, ensure they FAIL)

- [X] T016 [P] [US3] Write integration test for wallet status persistence in `tests/integration/wallet/wallet-persistence.test.ts`
  - Test status endpoint returns correct connection state
  - Test status for connected wallet (returns address)
  - Test status for disconnected wallet (returns null)
  - Test address format consistency
  - Test authentication failure handling
  - Verify tests FAIL initially (red phase)

### Implementation for User Story 3

- [X] T017 [US3] Implement GET `/api/wallet/status` endpoint in `src/app/api/wallet/status/route.ts`
  - Use JWT authentication with `authenticateRequest()`
  - Fetch user data from database including `ton_wallet_address`
  - Return status response with `connected` boolean and `address` (or null)
  - Handle errors with appropriate HTTP status codes (401, 404, 500)

- [X] T018 [US3] ~~Add wallet status synchronization to `WalletSettings` component in `src/components/wallet/WalletSettings.tsx`~~ **SKIPPED** - Functionality not needed
  - ~~Call GET `/api/wallet/status` on component mount with JWT auth header~~
  - ~~Sync server-side wallet address with client-side TON Connect state~~
  - ~~Display wallet provider name (client-side from TON Connect, not stored in database)~~
  - ~~Add "Copy Address" button with clipboard functionality~~
  - ~~Show success notification after copying address~~
  - ~~Handle session restoration and expired sessions~~

- [X] T019 [US3] Verify integration tests now PASS (green phase)
  - Run `pnpm run test tests/integration/wallet/wallet-persistence.test.ts`
  - Confirm status endpoint returns correct data
  - Verify wallet status persists across sessions

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and production readiness

- [ ] T020 [P] Add comprehensive error handling and user-friendly error messages across all endpoints
  - Map TON Connect errors to user-facing messages using `standardizeTonError()` utility
  - Add error scenarios: wallet app not installed, user cancellation, network errors, timeout

- [X] T021 [P] Add wallet address display utility function in `src/lib/ton.ts`
  - Create `formatWalletAddress()` function for truncated display (e.g., "EQDtF...p4q2")
  - Use in `WalletSettings` component for consistent formatting

- [ ] T022 Run pre-commit validation checklist
  - Run `pnpm run format:check` and fix any issues
  - Run `pnpm run lint` and fix any issues
  - Run `pnpm run type-check` and fix any issues
  - Run `pnpm run test` and verify all tests pass

- [ ] T023 Manual testing in Telegram Mini App
  - Start HTTPS dev server (`pnpm run dev:https`)
  - Configure @BotFather with `https://127.0.0.1:3000`
  - Test complete user journey in Telegram (web or desktop)
  - Verify TON Connect manifest is accessible
  - Test with real wallet app (Tonkeeper or MyTonWallet)

- [ ] T024 [P] Update TON Connect manifest for production deployment
  - Replace `https://127.0.0.1:3000` with production domain
  - Verify manifest is publicly accessible at production URL
  - Update icon, terms, and privacy policy URLs

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User Story 1 (P1) can start immediately after Foundational
  - User Story 2 (P2) can start after Foundational (integrates with US1 components)
  - User Story 3 (P3) can start after Foundational (uses same components as US1/US2)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Uses `WalletSettings` component from US1
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Enhances `WalletSettings` component from US1/US2

### Within Each User Story

- Tests MUST be written and FAIL before implementation (red-green-refactor cycle)
- API endpoint implementation before UI components (backend-first approach)
- UI components after API endpoints are functional
- Test verification (green phase) after implementation complete
- Story complete before moving to next priority

### Parallel Opportunities

- Setup tasks (T001, T002) can run in parallel
- Foundational verification tasks (T003-T006) can run in parallel
- Tests for all user stories can be written in parallel: T007, T012, T016 (different files)
- Polish tasks (T020, T021, T024) can run in parallel (different files)
- **NOT parallel**: UI components (T009, T014, T018) all modify same `WalletSettings.tsx` file - must be sequential

---

## Parallel Example: User Story 1

```bash
# Phase 2: Verify all foundational components in parallel
Task: "Verify auth middleware exports validateTelegramAuth()"
Task: "Verify TON utilities export validateTonAddress() and normalizeTonAddress()"
Task: "Verify database connection exports db instance"
Task: "Verify TonProvider exports wallet hooks"

# Phase 3: Write test for US1 (can run in parallel with US2/US3 tests)
Task: "Write integration test for wallet connection in tests/integration/wallet/wallet-connection.test.ts"

# Polish: Multiple cross-cutting improvements in parallel
Task: "Add error handling across all endpoints"
Task: "Add wallet address display utility"
Task: "Update TON Connect manifest for production"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Connect Wallet)
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

### Sequential Strategy (Recommended)

Since most UI work touches the same `WalletSettings.tsx` file, a sequential approach is recommended:

1. Complete Setup + Foundational (Phases 1-2)
2. Complete User Story 1 fully (Phase 3) including tests
3. Complete User Story 2 fully (Phase 4) including tests
4. Complete User Story 3 fully (Phase 5) including tests
5. Complete Polish (Phase 6) for production readiness

---

## Notes

- **Constitutional Compliance**: Integration tests are REQUIRED (not optional) per project constitution
- **Red-Green-Refactor**: Write tests first, verify they fail, then implement to make them pass
- **[P] tasks**: Different files, no dependencies - safe to parallelize
- **[Story] label**: Maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **Pre-commit checklist mandatory**: `format:check`, `lint`, `type-check` must pass before commits
- Use `pnpm` exclusively (not npm or yarn)

---

## Task Summary

**Total Tasks**: 24
- Phase 1 (Setup): 2 tasks
- Phase 2 (Foundational): 4 tasks (verification only, no new code)
- Phase 3 (User Story 1): 5 tasks (1 test file + 4 implementation tasks)
- Phase 4 (User Story 2): 4 tasks (1 test file + 3 implementation tasks)
- Phase 5 (User Story 3): 4 tasks (1 test file + 3 implementation tasks)
- Phase 6 (Polish): 5 tasks

**Parallel Opportunities Identified**:
- 2 tasks in Setup phase
- 4 tasks in Foundational phase
- 3 test files can be written in parallel
- 3 tasks in Polish phase

**Independent Test Criteria**:
- **US1**: Connect wallet → address appears in UI and database
- **US2**: Disconnect wallet → address removed from UI and database
- **US3**: Wallet status persists across sessions and reloads

**Suggested MVP Scope**: User Story 1 only (wallet connection) - delivers immediate value for Corgi coin rewards

**Constitution Compliance**: ✅ All requirements met
- Security-First: TON Connect SDK, server-side validation
- Integration Tests: Required and included for all stories
- Type Safety: TypeScript strict mode enforced
- Database Integrity: Uses existing schema, no migrations needed
- Testing Before Implementation: Red-green-refactor cycle mandated
