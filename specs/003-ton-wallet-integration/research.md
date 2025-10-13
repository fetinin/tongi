# Research: TON Wallet Integration

**Feature**: 003-ton-wallet-integration
**Date**: 2025-10-13
**Status**: Complete

## Overview

This document consolidates research findings for implementing TON wallet integration using TON Connect SDK within the Telegram Mini App environment. The feature focuses on wallet connection/disconnection and address persistence - actual blockchain transactions are out of scope.

## Research Areas

### 1. TON Connect Manifest Configuration

**Decision**: Create `public/tonconnect-manifest.json` with required fields for Telegram Mini App integration

**Rationale**: TON Connect requires a publicly accessible manifest file that describes the app to wallet providers. This enables wallets to display proper app information during connection requests.

**Required Fields**:
```json
{
  "url": "https://your-domain.com",
  "name": "Tongi (Corgi Buddy)",
  "iconUrl": "https://your-domain.com/icon.png",
  "termsOfUseUrl": "https://your-domain.com/terms",
  "privacyPolicyUrl": "https://your-domain.com/privacy"
}
```

**Implementation Notes**:
- Manifest must be served from `public/tonconnect-manifest.json`
- Next.js automatically serves files from `public/` directory at root URL
- For development, use `https://127.0.0.1:3000/tonconnect-manifest.json`
- For production, use actual deployed domain

**Alternatives Considered**:
- Dynamic manifest generation via API endpoint - rejected due to TON Connect caching requirements and complexity
- Hosting manifest on separate CDN - rejected to keep deployment simple

---

### 2. TON Connect Session Management

**Decision**: Leverage `@tonconnect/ui-react`'s built-in session persistence with no additional implementation

**Rationale**: The TON Connect UI SDK automatically handles session persistence using browser localStorage. The `TonProvider` component (already implemented) uses React hooks that automatically restore sessions on app reload.

**Existing Implementation**:
- `useTonConnectUI()` hook manages TON Connect state
- `useTonWallet()` hook provides current wallet connection
- `useTonAddress()` hook retrieves addresses (both raw and user-friendly formats)
- Session restoration happens automatically when component mounts

**Implementation Notes**:
- No additional session management code needed
- Wallet connection persists across page reloads automatically
- Server-side persistence (database) is separate and handled by API endpoints
- If TON Connect session expires, user must reconnect (SDK handles this)

**Alternatives Considered**:
- Custom session storage in SQLite - rejected because TON Connect SDK handles client-side persistence
- Server-side session tokens - rejected as unnecessary complexity; TON Connect manages its own sessions

---

### 3. Telegram Mini App Redirect Configuration

**Decision**: Use default TON Connect redirect behavior with Telegram Mini App URL scheme

**Rationale**: TON Connect SDK automatically handles Telegram Mini App redirects. When wallet apps complete the connection, they redirect back to the Mini App using Telegram's URL scheme.

**Implementation Notes**:
- No special redirect configuration needed for Telegram Mini Apps
- TON Connect SDK detects Telegram environment and uses appropriate redirect URLs
- For development with `https://127.0.0.1:3000`, ensure Telegram Bot settings use this exact URL
- Wallet apps (Tonkeeper, MyTonWallet) handle the redirect back to Telegram automatically

**Testing Configuration**:
1. Run dev server: `pnpm run dev:https`
2. Accept browser certificate for `https://127.0.0.1:3000`
3. Configure @BotFather with `https://127.0.0.1:3000` (use `127.0.0.1`, NOT `localhost`)
4. Test in Telegram Web or desktop client

**Alternatives Considered**:
- Custom redirect URL parameter - rejected because TON Connect handles this automatically
- Deep link configuration - rejected as unnecessary for Telegram Mini Apps

---

### 4. Error Handling Patterns

**Decision**: Use standardized error messages for common TON Connect failure scenarios

**Rationale**: TON Connect can fail for various reasons (user cancellation, network issues, wallet app problems). Providing clear, actionable error messages improves user experience.

**Error Categories & Messages**:

| Error Type | Detection Pattern | User-Facing Message |
|------------|------------------|---------------------|
| User Cancellation | `error.message.includes('user rejected')` | "Wallet connection cancelled" |
| Wallet Not Installed | `error.message.includes('not found')` | "Please install a TON wallet app (Tonkeeper or MyTonWallet)" |
| Network Error | `error.message.includes('network')` | "Network connection error. Please try again." |
| Timeout | `error.message.includes('timeout')` | "Connection timeout. Please try again." |
| Unknown | Default case | "Failed to connect wallet. Please try again." |

**Implementation Notes**:
- Existing `src/lib/ton.ts` already has `standardizeTonError()` utility function
- `TonProvider` component displays errors via `connectionError` state
- API endpoints should return appropriate HTTP status codes (400 for user errors, 500 for server errors)

**Alternatives Considered**:
- Generic error messages for all failures - rejected due to poor user experience
- Detailed technical error messages - rejected to avoid confusing non-technical users

---

### 5. Wallet Address Validation

**Decision**: Trust TON Connect SDK for address validation; perform only basic format checks before database persistence

**Rationale**: TON Connect SDK provides already-validated wallet addresses. The SDK ensures addresses are properly formatted and correspond to actual wallets. Additional validation is unnecessary and could introduce bugs.

**Validation Strategy**:
1. **Client-side**: TON Connect SDK validates addresses before providing them
2. **Server-side**: Basic format check using existing `validateTonAddress()` utility (in `src/lib/ton.ts`)
3. **Database**: Store user-friendly address format (not raw format)

**Existing Validation Function** (from `src/lib/ton.ts`):
```typescript
export function validateTonAddress(address: string): boolean {
  // Checks for:
  // - Raw format: 64 hex characters
  // - User-friendly format: base64 with checksum
  // - EQ/UQ prefixed addresses
}
```

**Implementation Notes**:
- No blockchain RPC calls needed to validate addresses
- No checksum verification beyond TON Connect SDK's built-in validation
- Store normalized address format for consistency: `normalizeTonAddress()` utility already exists

**Alternatives Considered**:
- Blockchain verification (query address on-chain) - rejected as unnecessary; TON Connect guarantees valid addresses
- Checksum re-verification - rejected as redundant; TON Connect SDK handles this
- Network-specific validation (testnet vs mainnet) - rejected as overly restrictive during development

---

### 6. Testing Strategy for TON Connect

**Decision**: Integration tests focus on API endpoints and database persistence; no blockchain mocking required

**Rationale**: This feature does not perform blockchain transactions. Testing focuses on:
1. API endpoint behavior (auth, validation, persistence)
2. Database operations (storing/clearing wallet addresses)
3. User flow completion (connect → persist → disconnect → clear)

**Test Scope**:

**Integration Tests** (required):
- `wallet-connection.test.ts`: Test POST `/api/wallet/connect` endpoint
  - Verify wallet address persisted to database
  - Verify Telegram auth validation
  - Verify duplicate connection handling
- `wallet-disconnect.test.ts`: Test POST `/api/wallet/disconnect` endpoint
  - Verify wallet address cleared from database
  - Verify user remains authenticated
- `wallet-persistence.test.ts`: Test GET `/api/wallet/status` endpoint
  - Verify status returns correct connection state
  - Verify address format consistency

**Unit Tests** (optional):
- Address format validation in `src/lib/ton.ts` (already has comprehensive utilities)

**No Mocking Needed**:
- No blockchain RPC calls in this feature
- No TON Connect SDK mocking needed (integration tests hit real API endpoints)
- Database uses real SQLite instance (test database)

**Implementation Notes**:
- Use existing Jest test infrastructure
- Create test database for integration tests (`./data/test.db`)
- Use existing `src/middleware/auth.ts` for Telegram auth in tests
- Follow red-green-refactor: write failing tests first

**Alternatives Considered**:
- Mock TON Connect SDK hooks - rejected because feature doesn't require blockchain interaction
- E2E tests with wallet apps - rejected as too complex for initial implementation; manual testing sufficient

---

## Summary of Decisions

| Research Area | Decision | Key Implementation |
|--------------|----------|-------------------|
| TON Connect Manifest | Static JSON in `public/` directory | `public/tonconnect-manifest.json` |
| Session Management | Use SDK's built-in persistence | No additional code needed |
| Telegram Redirects | Use SDK's automatic handling | No configuration needed |
| Error Handling | Standardized user-facing messages | Use existing `standardizeTonError()` |
| Address Validation | Trust SDK + basic format check | Use existing `validateTonAddress()` |
| Testing Strategy | Integration tests for API/DB | No blockchain mocking |

## Open Questions

None. All technical clarifications have been resolved.

## Next Steps

Proceed to Phase 1:
1. Generate data-model.md (database schema and entities)
2. Generate API contracts in `/contracts/` directory
3. Generate quickstart.md (developer getting-started guide)
4. Update agent context
