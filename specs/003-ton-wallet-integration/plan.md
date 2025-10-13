# Implementation Plan: TON Wallet Integration

**Branch**: `003-ton-wallet-integration` | **Date**: 2025-10-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-ton-wallet-integration/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

This feature implements TON wallet integration using TON Connect SDK, enabling users to connect their cryptocurrency wallets to receive Corgi coin rewards. The integration provides wallet connection/disconnection flows, address storage, and session management while leveraging existing TON Connect infrastructure already present in the codebase. The technical approach focuses on completing the partial TON Connect implementation by adding database persistence, API endpoints for wallet management, and comprehensive error handling for the Telegram Mini App environment.

## Technical Context

**Language/Version**: TypeScript 5 with ES2017 target, strict mode enabled
**Primary Dependencies**:
- `@tonconnect/ui-react` v2.3.0 (TON Connect SDK - already installed)
- `@tonconnect/sdk` v3.3.1 (TON blockchain integration - already installed)
- `@telegram-apps/sdk-react` v3.3.7 (Telegram Mini App SDK - already installed)
- `@telegram-apps/telegram-ui` v2.1.9 (UI components - already installed)
- `better-sqlite3` v12.2.0 (database - already installed)
- Next.js 15.5.3 with App Router (framework - already installed)

**Storage**: SQLite 3 database at `./data/app.db` with existing `users.ton_wallet_address TEXT` column (verified)
**Testing**: Jest v30.2.0 with ts-jest v29.4.3, integration tests required for all user stories
**Target Platform**: Telegram Mini App (web-based) accessed via Telegram clients, requires HTTPS for testing
**Project Type**: Web application (Next.js App Router with client-side rendering)
**Performance Goals**:
- Wallet connection completion <30 seconds (user-facing goal)
- <200ms API response time for wallet status checks
- 95% connection success rate

**Constraints**:
- Must work within Telegram Mini App environment (no traditional SSR)
- TON Connect requires HTTPS (`https://127.0.0.1:3000` for development)
- TON Connect manifest must be publicly accessible
- No direct private key handling (all cryptographic operations via TON Connect)
- Single wallet per user (enforced at database level)

**Scale/Scope**:
- 1k-10k initial users (SQLite appropriate for this scale)
- ~5 new components (wallet settings, wallet card, connection modal, disconnect confirmation)
- ~3 new API endpoints (connect, disconnect, status)
- Integration with existing User model (already has `ton_wallet_address` column)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Security-First Development ✅ PASS

- **TON Connect SDK usage**: All wallet operations use `@tonconnect/ui-react` SDK - no direct private key handling
- **Server-side validation**: Wallet address updates will be validated against Telegram initData HMAC before persistence
- **No private key storage**: TON Connect handles all cryptographic operations client-side
- **API endpoint security**: Wallet connect/disconnect endpoints will use existing auth middleware (`src/middleware/auth.ts`)

**Status**: COMPLIANT - This feature follows constitutional security requirements by delegating all wallet operations to TON Connect SDK.

### Telegram Platform Integration ✅ PASS

- **Telegram Mini App environment**: TON Connect explicitly designed for Telegram Mini Apps
- **Mock mode**: Existing development mock mode (`mockTelegramEnv`) will continue to support local development
- **Theme integration**: Wallet UI components use `@telegram-apps/telegram-ui` for theme consistency
- **Production deployment**: Feature includes TON Connect manifest file deployment (required for production)

**Status**: COMPLIANT - Feature leverages TON Connect's native Telegram Mini App support.

### Type Safety & Code Quality ✅ PASS

- **TypeScript strict mode**: All new code will use strict TypeScript (already enforced project-wide)
- **Pre-commit validation**: Must pass `pnpm run format:check` before commits
- **ESLint compliance**: Must pass `pnpm run lint`
- **Type checking**: Must pass `pnpm run type-check`

**Status**: COMPLIANT - Will follow existing project quality gates.

### Testing Strategy & Quality Gates ⚠️ ATTENTION REQUIRED

- **Integration tests required**: All 3 user stories (connect, disconnect, view status) must have integration tests
- **Mock restrictions**: External TON blockchain calls may be mocked; internal app logic must NOT be mocked
- **Red-green-refactor**: Tests must be written before implementation and verified to fail initially
- **Unit tests**: Only required for complex wallet address validation logic in `src/lib/ton.ts` (already exists)

**Current State**: Existing codebase has test infrastructure (`jest.config.js`, `tests/` directory) but test coverage status is unknown.

**Action Required**:
1. Verify existing test setup works
2. Write integration tests for wallet connection flow BEFORE implementing API endpoints
3. Write integration tests for wallet disconnection flow
4. Write integration tests for wallet status persistence

**Status**: CONDITIONAL PASS - Must write integration tests as part of implementation (Phase 2).

### Database Integrity ✅ PASS

- **Migration-based changes**: Database already has `ton_wallet_address TEXT` column in `users` table (verified: `sqlite3 ./data/app.db ".schema users"`)
- **No schema changes needed**: Feature uses existing `users.ton_wallet_address TEXT` column only
- **Transaction safety**: Wallet address updates will use SQLite transactions for atomicity
- **TON Connect validation**: TON Connect SDK guarantees addresses are valid and properly formatted; no additional validation required

**Status**: COMPLIANT - No new migrations required; existing schema supports feature.

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
│   ├── api/
│   │   └── wallet/
│   │       ├── connect/route.ts       # NEW: POST endpoint to persist wallet address
│   │       ├── disconnect/route.ts    # NEW: POST endpoint to clear wallet address
│   │       └── status/route.ts        # NEW: GET endpoint to check wallet connection
│   └── wallet/
│       └── page.tsx                   # NEW: Wallet settings page
├── components/
│   └── wallet/
│       ├── TonProvider.tsx            # EXISTING: TON Connect context (already implemented)
│       ├── WalletSettings.tsx         # NEW: Wallet management UI component
│       ├── WalletCard.tsx             # NEW: Wallet status display card
│       └── index.ts                   # EXISTING: Wallet component exports
├── lib/
│   ├── ton.ts                         # EXISTING: TON utilities (already comprehensive)
│   └── telegram.ts                    # EXISTING: Telegram auth utilities
├── models/
│   └── User.ts                        # EXISTING: User model (already has wallet field)
├── services/
│   └── UserService.ts                 # EXISTING: User service (may need wallet methods)
└── middleware/
    └── auth.ts                        # EXISTING: Telegram auth validation

tests/
├── integration/
│   └── wallet/
│       ├── wallet-connection.test.ts  # NEW: Integration test for wallet connect flow
│       ├── wallet-disconnect.test.ts  # NEW: Integration test for disconnect flow
│       └── wallet-persistence.test.ts # NEW: Integration test for status/persistence
└── unit/
    └── validation.test.ts             # EXISTING: May add wallet address validation tests

public/
└── tonconnect-manifest.json           # NEW: TON Connect manifest file (required)
```

**Structure Decision**: This is a Next.js web application using the App Router pattern. The project follows a clear separation between:
- **API routes** (`src/app/api/`) for server-side operations (wallet address persistence, validation)
- **Page routes** (`src/app/`) for user-facing pages (wallet settings page)
- **Reusable components** (`src/components/`) for UI elements (wallet cards, forms)
- **Business logic** (`src/lib/`, `src/services/`) for utilities and data operations
- **Data models** (`src/models/`) for type definitions

The wallet feature integrates into this existing structure by:
1. Adding new API endpoints under `/api/wallet/`
2. Creating a new wallet settings page at `/wallet`
3. Extending existing `TonProvider` component with new UI components
4. Leveraging existing `User` model and database schema (no changes needed)

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

No constitutional violations detected. All gates pass with one conditional requirement (integration tests must be written during Phase 2 implementation).

---

## Post-Design Constitution Review

*Re-evaluation after Phase 1 design completion (2025-10-13)*

### Security-First Development ✅ PASS (Confirmed)

**Design Verification**:
- API endpoints (`/api/wallet/connect`, `/api/wallet/disconnect`, `/api/wallet/status`) all use `validateTelegramAuth()` middleware
- No private key handling in any component
- Wallet addresses validated using `validateTonAddress()` from `src/lib/ton.ts`
- Database operations use parameterized queries (SQL injection protection)
- Error responses sanitized (no internal details leaked)

**Status**: COMPLIANT - Design maintains security-first principles throughout.

### Telegram Platform Integration ✅ PASS (Confirmed)

**Design Verification**:
- TON Connect manifest (`public/tonconnect-manifest.json`) properly configured for Telegram Mini Apps
- Existing `TonProvider` component handles session management
- UI components use `@telegram-apps/telegram-ui` for theme consistency
- Development workflow documented for HTTPS testing (`pnpm run dev:https`)

**Status**: COMPLIANT - Design leverages Telegram platform features correctly.

### Type Safety & Code Quality ✅ PASS (Confirmed)

**Design Verification**:
- All API endpoints use TypeScript with strict types
- Request/response interfaces defined in `data-model.md`
- OpenAPI specification provides contract validation
- Quickstart guide includes pre-commit checklist with `format:check`, `lint`, `type-check`

**Status**: COMPLIANT - Design enforces type safety at all layers.

### Testing Strategy & Quality Gates ✅ PASS (Conditional)

**Design Verification**:
- Integration test structure defined in `quickstart.md`
- Three test files planned: `wallet-connection.test.ts`, `wallet-disconnect.test.ts`, `wallet-persistence.test.ts`
- No blockchain mocking required (feature doesn't call blockchain RPCs)
- Test examples show database verification without mocking internal logic

**Action Items for Phase 2 (Implementation)**:
1. Write `tests/integration/wallet/wallet-connection.test.ts` BEFORE implementing `/api/wallet/connect`
2. Write `tests/integration/wallet/wallet-disconnect.test.ts` BEFORE implementing `/api/wallet/disconnect`
3. Write `tests/integration/wallet/wallet-persistence.test.ts` BEFORE implementing `/api/wallet/status`
4. Follow red-green-refactor: verify tests fail initially, then implement to make them pass

**Status**: CONDITIONAL PASS - Tests must be written during implementation (Phase 2).

### Database Integrity ✅ PASS (Confirmed)

**Design Verification**:
- No schema changes required (uses existing `users.ton_wallet_address TEXT` column, verified via schema check)
- API endpoints use parameterized SQL queries via `db.prepare()`
- Update operations properly handle NULL values for disconnection
- `updated_at` trigger automatically updates timestamps
- TON Connect SDK validates addresses; application stores SDK-provided values directly

**Status**: COMPLIANT - Design respects database integrity principles.

---

## Final Gate Status

**Overall Assessment**: ✅ ALL GATES PASS

The design phase (Phase 1) is complete and constitutional compliance is verified. The feature is ready to proceed to Phase 2 (Implementation) with the following requirement:

**Phase 2 Requirement**: Integration tests MUST be written before implementing each API endpoint (red-green-refactor cycle).

**No Complexity Violations**: The design introduces no unnecessary complexity and follows established patterns from the existing codebase.
