# Implementation Plan: Mobile-First Onboarding Flow

**Branch**: `005-mobile-first-onboarding` | **Date**: 2025-10-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-mobile-first-onboarding/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement a mobile-first, linear onboarding flow that enforces wallet connection → buddy confirmation → main app access. The flow uses state-based routing to ensure users cannot skip onboarding steps, implements persistent state validation on every app open, and reorganizes the app navigation into a bottom-tab layout (Corgi Sighting + Settings) once onboarding is complete. Technical approach focuses on client-side routing with server-side state validation APIs, leveraging existing TON Connect and buddy relationship infrastructure.

## Technical Context

**Language/Version**: TypeScript 5 with ES2017 target, strict mode enabled
**Primary Dependencies**: Next.js 15 (App Router), React 18.3, @telegram-apps/sdk-react, @tonconnect/ui-react, TailwindCSS 4
**Storage**: SQLite 3 (`./data/app.db`) via better-sqlite3; Telegram SecureStorage/DeviceStorage for client state
**Testing**: Jest 30 with ts-jest for TypeScript support, black-box integration tests via API endpoints
**Target Platform**: Telegram Mini App (web-based, client-side rendered), optimized for mobile (320px+ width), primary testing via Telegram Web/Desktop
**Project Type**: Web application (Telegram Mini App) - single Next.js project with client-side rendering
**Performance Goals**: <3s state validation on app open, <2min first-time onboarding completion, 60fps UI interactions
**Constraints**: Client-side rendering only (no SSR due to Telegram), mock mode for dev, HTTPS required for Telegram testing, state persistence across sessions
**Scale/Scope**: 3 new screens (Welcome/Add Buddy/Main Navigation), 5+ new API endpoints for state validation, ~1k-10k initial users

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Security-First Development
- ✅ **Server-side validation**: All onboarding state validation APIs (`/api/onboarding/status`, `/api/wallet/status`, `/api/buddy/status`) MUST validate Telegram initData via HMAC before returning state
- ✅ **TON Connect SDK**: Wallet connection continues using existing `@tonconnect/ui-react` integration, no direct key handling
- ✅ **No credential exposure**: Onboarding state stored in database, not in client-side storage (except UI preferences)

### II. Telegram Platform Integration
- ✅ **Telegram SDK usage**: Uses existing `@telegram-apps/sdk-react` initialization in `Root` component
- ✅ **Mock mode support**: Development continues to use `mockTelegramEnv` for local testing without Telegram
- ✅ **Theme integration**: All new UI components use Telegram UI library (`@telegram-apps/telegram-ui`) for theme consistency
- ✅ **i18n**: Onboarding screen text uses existing `next-intl` setup

### III. Type Safety & Code Quality
- ✅ **TypeScript strict mode**: All new components, services, and API routes use strict TypeScript
- ✅ **Pre-commit validation**: Changes MUST pass `pnpm run format:check` and `pnpm run validate` (lint + type-check)
- ✅ **ESLint compliance**: All code follows Next.js ESLint rules

### IV. Testing Strategy & Quality Gates
- ✅ **Integration tests required**: All 3 user stories (US1: wallet, US2: buddy, US3: navigation) MUST have integration tests via API endpoints
- ✅ **Black-box testing**: Tests call `/api/onboarding/*` endpoints, NOT service functions directly
- ✅ **No excessive mocking**: Only external APIs mocked (Telegram Bot API for buddy notifications, TON RPC for wallet validation)
- ⚠️ **Red-green-refactor**: Tests written BEFORE implementation (except for research phase)

### V. Database Integrity
- ✅ **Migration-based changes**: No new tables required - onboarding state is derived from existing `users.ton_wallet_address` and `buddy_pairs` table
- ✅ **Schema verification**: Migration verifies UNIQUE constraint on `users.ton_wallet_address` (required for automatic wallet unlinking per FR-020)
- ✅ **Index optimization**: Existing indexes on `buddy_pairs(user1_id, user2_id, status)` verified for performance
- ✅ **Reversible migrations**: No destructive changes; migration only adds UNIQUE constraint if missing (reversible via DROP INDEX)

**GATE STATUS**: ✅ PASS - All constitutional requirements met

**Post-Design Re-Evaluation**:
- All design decisions align with constitutional principles
- No new dependencies added
- Derived state approach simplifies database schema (follows YAGNI principle)
- Black-box testing strategy confirmed via API contracts
- Performance goals achievable with existing infrastructure

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── app/                          # Next.js 15 App Router
│   ├── onboarding/              # NEW: Onboarding flow pages
│   │   ├── welcome/page.tsx     # NEW: Welcome screen (wallet prompt)
│   │   └── buddy/page.tsx       # NEW: Add buddy screen
│   ├── page.tsx                 # MODIFIED: Root route with onboarding redirect logic
│   ├── corgi/page.tsx           # EXISTING: Moved to main navigation
│   ├── wallet/page.tsx          # EXISTING: Moved to settings
│   ├── buddy/page.tsx           # EXISTING: Moved to settings
│   └── api/
│       ├── onboarding/          # NEW: Onboarding state validation
│       │   └── status/route.ts  # NEW: Combined validation endpoint
│       ├── wallet/              # EXISTING: Wallet APIs
│       │   ├── status/route.ts  # MODIFIED: Enhanced for onboarding
│       │   ├── connect/route.ts # EXISTING
│       │   └── disconnect/route.ts # EXISTING
│       └── buddy/               # EXISTING: Buddy APIs
│           ├── status/route.ts  # MODIFIED: Enhanced for onboarding
│           ├── request/route.ts # EXISTING
│           ├── accept/route.ts  # EXISTING
│           ├── reject/route.ts  # EXISTING
│           └── search/route.ts  # EXISTING
├── components/
│   ├── onboarding/              # NEW: Onboarding UI components
│   │   ├── WelcomeScreen.tsx    # NEW: Wallet connection prompt
│   │   ├── BuddySearchScreen.tsx # NEW: Buddy search/request UI
│   │   └── OnboardingGuard.tsx  # NEW: Route guard component
│   ├── layout/                  # NEW: App layout components
│   │   ├── BottomNavigation.tsx # NEW: Main navigation bar
│   │   └── MainLayout.tsx       # NEW: Layout wrapper with navigation
│   ├── wallet/                  # EXISTING: Wallet components
│   │   └── WalletSettings.tsx   # EXISTING: Moved to settings
│   └── buddy/                   # EXISTING: Buddy components
│       ├── BuddySearch.tsx      # EXISTING: Reused in onboarding
│       ├── BuddyRequest.tsx     # EXISTING: Reused in onboarding
│       └── BuddyStatus.tsx      # EXISTING: Moved to settings
├── services/
│   ├── OnboardingService.ts     # NEW: Onboarding state management
│   ├── UserService.ts           # EXISTING: May need modifications
│   ├── BuddyService.ts          # EXISTING
│   └── WalletService.ts         # NEW: Wallet state service (if not exists)
├── models/
│   └── User.ts                  # MODIFIED: Add onboarding state fields
└── lib/
    └── database/
        └── migrations.ts        # MODIFIED: Add onboarding migration

tests/
├── integration/
│   ├── onboarding.test.ts       # NEW: US1, US2, US3 tests
│   ├── wallet-connection.test.ts # NEW: Wallet onboarding tests
│   └── buddy-onboarding.test.ts  # NEW: Buddy onboarding tests
└── unit/
    └── [only if complex validation logic emerges]
```

**Structure Decision**: Single Next.js project (web application pattern) with client-side rendering. New onboarding flow organized under `src/app/onboarding/` with supporting components in `src/components/onboarding/`. Main navigation components added to `src/components/layout/`. Existing buddy and wallet components reused where possible, with some moved to settings area. API routes enhanced under `src/app/api/` to support state validation.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

N/A - No constitutional violations. All requirements met within existing architectural patterns.
