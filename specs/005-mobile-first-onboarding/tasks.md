# Tasks: Mobile-First Onboarding Flow

**Input**: Design documents from `/specs/005-mobile-first-onboarding/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Integration tests are included for all user stories per Constitution IV. Tests follow black-box approach via API endpoints only.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single Next.js project: `src/`, `tests/` at repository root
- Client-side rendered Telegram Mini App

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and database verification

- [X] T001 Verify database schema for wallet UNIQUE constraint in data/app.db using `sqlite3 data/app.db "PRAGMA index_list('users');"`
- [X] T002 Create migration script (if needed) to add UNIQUE constraint to users.ton_wallet_address in src/lib/database/migrations.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 [P] Create OnboardingState TypeScript interface in src/types/onboarding.ts
- [X] T004 [P] Create OnboardingStatusResponse TypeScript interface in src/types/onboarding.ts
- [X] T005 [P] Create OnboardingService with deriveOnboardingState function in src/services/OnboardingService.ts
- [X] T006 [P] Create WalletService (if not exists) with wallet status validation in src/services/WalletService.ts
- [X] T007 Implement GET /api/onboarding/status endpoint with HMAC validation in src/app/api/onboarding/status/route.ts
- [X] T008 [P] Create useOnboardingGuard hook for client-side routing in src/hooks/useOnboardingGuard.ts
- [X] T009 [P] Create OnboardingLayout component for onboarding screen wrapper in src/components/onboarding/OnboardingLayout.tsx
- [X] T010 [P] Create error handling component for network errors in src/components/onboarding/OnboardingError.tsx

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - First-Time Wallet Connection (Priority: P1) 🎯 MVP

**Goal**: Implement wallet connection requirement - users must connect TON wallet before accessing any features

**Independent Test**: Can be fully tested by registering a new user and verifying that only the wallet connection prompt is shown, with no access to other features

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T011 [P] [US1] Integration test for blocking access until wallet connected in tests/integration/wallet-connection-onboarding.test.ts
- [x] T012 [P] [US1] Integration test for redirect to buddy screen after wallet connection in tests/integration/wallet-connection-onboarding.test.ts

### Implementation for User Story 1

- [x] T013 [US1] Create WelcomeScreen component with wallet connection prompt in src/components/onboarding/WelcomeScreen.tsx
- [x] T014 [US1] Create /onboarding/welcome page with WelcomeScreen component in src/app/onboarding/welcome/page.tsx
- [x] T015 [US1] Enhance POST /api/wallet/connect with automatic wallet unlinking logic in src/app/api/wallet/connect/route.ts
- [x] T016 [US1] Modify root page (src/app/page.tsx) to use useOnboardingGuard and redirect to /onboarding/welcome if wallet not connected
- [x] T017 [US1] Add wallet connection success handler to redirect to /onboarding/buddy in src/components/onboarding/WelcomeScreen.tsx
- [x] T018 [US1] Verify integration tests pass for US1

**Checkpoint**: At this point, User Story 1 should be fully functional - new users see welcome screen, connect wallet, get redirected to buddy screen

---

## Phase 4: User Story 2 - Buddy Request and Confirmation (Priority: P2)

**Goal**: Implement buddy search, request, pending status, and confirmation flow required before main app access

**Independent Test**: Can be tested by creating a user with a connected wallet and verifying the search, request, pending, and acceptance/rejection flows work correctly

### Tests for User Story 2

- [x] T019 [P] [US2] Integration test for buddy search and request flow in tests/integration/buddy-onboarding.test.ts
- [x] T020 [P] [US2] Integration test for pending request cancellation in tests/integration/buddy-onboarding.test.ts
- [x] T021 [P] [US2] Integration test for buddy acceptance redirect to main app in tests/integration/buddy-onboarding.test.ts
- [x] T022 [P] [US2] Integration test for buddy rejection returns to search in tests/integration/buddy-onboarding.test.ts

### Implementation for User Story 2

- [x] T023 [US2] Create DELETE /api/buddy/cancel endpoint for pending request cancellation in src/app/api/buddy/cancel/route.ts
- [x] T024 [P] [US2] Create BuddySearchScreen component that wraps existing BuddySearch in src/components/onboarding/BuddySearchScreen.tsx
- [x] T025 [P] [US2] Create PendingRequestDisplay component with cancel button in src/components/onboarding/PendingRequestDisplay.tsx
- [x] T026 [US2] Create /onboarding/buddy page with search/pending conditional logic in src/app/onboarding/buddy/page.tsx
- [x] T027 [US2] Update useOnboardingGuard to redirect to /onboarding/buddy if wallet connected but no buddy in src/hooks/useOnboardingGuard.ts
- [x] T028 [US2] Add buddy confirmation detection and redirect to main app in src/app/onboarding/buddy/page.tsx
- [x] T029 [US2] Verify integration tests pass for US2

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - users can connect wallet, search for buddy, send/cancel requests, and complete onboarding when buddy accepts

---

## Phase 5: User Story 3 - Main App Navigation (Priority: P3)

**Goal**: Implement bottom navigation bar with Corgi Sighting and Settings screens for fully onboarded users

**Independent Test**: Can be tested by creating a fully onboarded user (wallet + buddy) and verifying navigation between Corgi Sighting and Settings screens works correctly

### Tests for User Story 3

- [x] T030 [P] [US3] Integration test for main app access after onboarding complete in tests/integration/onboarding.test.ts
- [x] T031 [P] [US3] Integration test for bottom navigation between screens in tests/integration/onboarding.test.ts
- [x] T032 [P] [US3] Integration test for re-validation error handling with retry in tests/integration/onboarding.test.ts

### Implementation for User Story 3

- [x] T033 [P] [US3] Create BottomNavigation component with dog and settings icons in src/components/layout/BottomNavigation.tsx
- [x] T034 [P] [US3] Create MainLayout component that wraps content with bottom navigation in src/components/layout/MainLayout.tsx
- [x] T035 [US3] Create /settings page with wallet and buddy management options in src/app/settings/page.tsx
- [ ] T036 [US3] Update /corgi/page.tsx to use MainLayout wrapper
- [ ] T037 [US3] Update root page (src/app/page.tsx) to show main app with bottom navigation when onboarding complete
- [ ] T038 [US3] Move existing wallet management UI to /settings/wallet page in src/app/settings/wallet/page.tsx
- [ ] T039 [US3] Move existing buddy management UI to /settings/buddy page in src/app/settings/buddy/page.tsx
- [x] T040 [US3] Update useOnboardingGuard to handle re-validation errors with retry UI in src/hooks/useOnboardingGuard.ts (changed current_step from 'complete' to 'main')
- [x] T041 [US3] Add network error detection logic to distinguish from validation failures in src/hooks/useOnboardingGuard.ts (already implemented)
- [ ] T042 [US3] Verify integration tests pass for US3

**Checkpoint**: All user stories should now be independently functional - complete onboarding flow from welcome → buddy → main app works end-to-end

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T043 [P] Add mobile-first CSS optimization (min-width 320px, touch targets 44px+) across all onboarding components
- [ ] T044 [P] Add loading states and placeholders using Telegram UI components
- [ ] T045 [P] Verify Telegram theme integration (miniApp.isDark signal) for all new components
- [ ] T046 [P] Add i18n support using next-intl for all onboarding screen text
- [ ] T047 [P] Add validation for minimum screen width (320px) in MainLayout
- [ ] T048 Run format check: pnpm run format:check
- [ ] T049 Run validation: pnpm run validate (lint + type-check)
- [ ] T050 Run all tests: pnpm run test
- [ ] T051 Manual testing using quickstart.md scenarios in Telegram Web/Desktop
- [ ] T052 Performance validation: onboarding status check <500ms, app open validation <3s
- [ ] T053 [P] Update CLAUDE.md with new routes and components (if needed)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Uses existing BuddySearch component, independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Uses existing corgi/wallet/buddy pages, independently testable

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Components/services can be built in parallel where marked [P]
- Integration points (pages) depend on components being ready
- Story complete and tests passing before moving to next priority

### Parallel Opportunities

- **Phase 1**: Both setup tasks (T001-T002) can run sequentially (database operations)
- **Phase 2**: All foundational tasks marked [P] (T003-T010) can run in parallel
- **Phase 3-5**: Once Foundational completes, all three user stories can be worked on in parallel by different developers
- **Within US1**: T011-T012 tests can run together, T013-T014 components can run together
- **Within US2**: T019-T022 tests can run together, T024-T025 components can run together
- **Within US3**: T030-T032 tests can run together, T033-T034, T036-T039, T043-T047 can run together
- **Phase 6**: All polish tasks marked [P] (T043-T047) can run in parallel

---

## Parallel Example: Foundational Phase

```bash
# Launch all foundational tasks together:
Task: "Create OnboardingState TypeScript interface in src/types/onboarding.ts"
Task: "Create OnboardingStatusResponse TypeScript interface in src/types/onboarding.ts"
Task: "Create OnboardingService with deriveOnboardingState function in src/services/OnboardingService.ts"
Task: "Create WalletService (if not exists) with wallet status validation in src/services/WalletService.ts"
Task: "Create useOnboardingGuard hook for client-side routing in src/hooks/useOnboardingGuard.ts"
Task: "Create OnboardingLayout component for onboarding screen wrapper in src/components/onboarding/OnboardingLayout.tsx"
Task: "Create error handling component for network errors in src/components/onboarding/OnboardingError.tsx"
```

## Parallel Example: User Story 1 Tests

```bash
# Launch all tests for User Story 1 together:
Task: "Integration test for blocking access until wallet connected in tests/integration/wallet-connection.test.ts"
Task: "Integration test for redirect to buddy screen after wallet connection in tests/integration/wallet-connection.test.ts"
```

## Parallel Example: Multiple User Stories (Team Strategy)

```bash
# After Foundational phase completes, if you have 3 developers:
Developer A: Complete all of Phase 3 (User Story 1)
Developer B: Complete all of Phase 4 (User Story 2)
Developer C: Complete all of Phase 5 (User Story 3)

# Stories integrate independently and don't block each other
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup → Database verified
2. Complete Phase 2: Foundational → Core onboarding infrastructure ready
3. Complete Phase 3: User Story 1 → Wallet connection requirement works
4. **STOP and VALIDATE**: Test wallet connection flow independently
5. Deploy/demo if ready → Users can connect wallet

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP: wallet requirement!)
3. Add User Story 2 → Test independently → Deploy/Demo (buddy requirement added!)
4. Add User Story 3 → Test independently → Deploy/Demo (full onboarding with navigation!)
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With 3 developers:

1. Team completes Setup + Foundational together (critical path)
2. Once Foundational is done:
   - Developer A: User Story 1 (wallet connection)
   - Developer B: User Story 2 (buddy requests)
   - Developer C: User Story 3 (main navigation)
3. Stories complete and integrate independently
4. Team converges for Polish phase

---

## Notes

- All integration tests follow black-box approach via API endpoints only (Constitution IV)
- No service function imports in tests - API contracts only
- Tests use in-memory SQLite database (`:memory:` mode)
- Only external APIs mocked (Telegram Bot API, TON RPC)
- Wallet unlinking implemented via database UNIQUE constraint + transaction
- Onboarding state derived from existing database fields (no new tables)
- All new components use `@telegram-apps/telegram-ui` for platform consistency
- Mobile-first design: 320px minimum width, 44px minimum touch targets
- HTTPS required for Telegram testing: use `pnpm run dev:https`
- Mock mode for local dev: set `NEXT_PUBLIC_USE_MOCK_AUTH=true` in `.env.local`
- Re-validation occurs on every app open (FR-014)
- Network errors show retry UI, validation failures redirect to appropriate onboarding step (FR-015, FR-016)

---

## Task Count Summary

- **Total tasks**: 53
- **Phase 1 (Setup)**: 2 tasks
- **Phase 2 (Foundational)**: 8 tasks (BLOCKS all stories)
- **Phase 3 (US1 - Wallet)**: 8 tasks (2 tests + 6 implementation)
- **Phase 4 (US2 - Buddy)**: 11 tasks (4 tests + 7 implementation)
- **Phase 5 (US3 - Navigation)**: 13 tasks (3 tests + 10 implementation)
- **Phase 6 (Polish)**: 11 tasks

**Parallel opportunities**: 25+ tasks can run in parallel with proper team coordination

**MVP scope**: Phase 1 + Phase 2 + Phase 3 = 18 tasks (wallet connection requirement only)

**Full feature**: All 53 tasks = Complete onboarding flow with navigation
