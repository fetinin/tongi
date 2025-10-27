# Research: Mobile-First Onboarding Flow

**Feature**: 005-mobile-first-onboarding
**Date**: 2025-10-26
**Status**: Complete

## Overview

This document captures research findings and technical decisions for implementing the mobile-first onboarding flow. The feature enforces a linear progression (wallet connection → buddy confirmation → main app) and implements state-based routing with server-side validation.

## Technical Decisions

### 1. Client-Side Routing Strategy

**Decision**: Implement client-side onboarding state guard using React hooks and Next.js App Router redirect logic

**Rationale**:
- Telegram Mini Apps require client-side rendering (no SSR support)
- Existing codebase uses Next.js App Router with 'use client' directives
- State validation must occur on every app open (FR-014) which requires client-side coordination
- Next.js useRouter() and redirect patterns already established in codebase

**Implementation Pattern**:
```typescript
// Onboarding guard hook pattern (derived from existing AuthProvider pattern)
const useOnboardingGuard = () => {
  const [onboardingState, setOnboardingState] = useState<OnboardingState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Fetch onboarding status from server
    // Redirect based on state:
    //   - no wallet → /onboarding/welcome
    //   - no buddy → /onboarding/buddy
    //   - complete → allow access to main app
  }, []);

  return { onboardingState, isLoading };
};
```

**Alternatives Considered**:
- Server-side middleware: Rejected due to Telegram SSR limitations
- URL query parameters for state: Rejected due to security concerns (state must be server-validated)

### 2. State Validation API Design

**Decision**: Create unified `/api/onboarding/status` endpoint returning combined wallet + buddy state

**Rationale**:
- Reduces client round trips (single API call vs. two separate calls)
- Consistent with existing API patterns (`/api/wallet/status`, `/api/buddy/status`)
- Server-side validation enforces security principle (Constitution I)
- Simplifies client-side routing logic

**API Response Schema**:
```typescript
{
  success: true,
  onboarding: {
    wallet_connected: boolean,
    buddy_confirmed: boolean,
    current_step: 'welcome' | 'buddy' | 'complete'
  },
  wallet?: {
    address: string | null
  },
  buddy?: {
    id: number,
    status: BuddyPairStatus,
    profile: UserProfile
  }
}
```

**Alternatives Considered**:
- Separate API calls for wallet and buddy status: Rejected due to unnecessary round trips
- Client-side state caching with TTL: Rejected as it violates "re-validate on every app open" requirement

### 3. Database Schema for Onboarding State

**Decision**: Do NOT add new onboarding state table. Derive state from existing `users.ton_wallet_address` and `buddy_pairs` table

**Rationale**:
- User model already has `ton_wallet_address` field (indicates wallet connection)
- BuddyService already provides `getBuddyStatus()` method (indicates buddy confirmation)
- Onboarding state is computed, not stored (follows YAGNI principle)
- Reduces migration complexity and data redundancy

**State Derivation Logic**:
```typescript
function deriveOnboardingState(user: User, buddyStatus: BuddyStatusResult): OnboardingState {
  const walletConnected = !!user.ton_wallet_address;
  const buddyConfirmed = buddyStatus.status === 'confirmed';

  if (!walletConnected) return { current_step: 'welcome', wallet_connected: false, buddy_confirmed: false };
  if (!buddyConfirmed) return { current_step: 'buddy', wallet_connected: true, buddy_confirmed: false };
  return { current_step: 'complete', wallet_connected: true, buddy_confirmed: true };
}
```

**Alternatives Considered**:
- New `onboarding_state` table with explicit state tracking: Rejected as over-engineering (adds complexity without benefit)
- Add `onboarding_completed_at` timestamp to users table: Rejected as state can be derived from existing fields

### 4. Bottom Navigation Implementation

**Decision**: Use `@telegram-apps/telegram-ui` TabsList component for bottom navigation

**Rationale**:
- Telegram UI library already in use (Constitution II - platform integration)
- TabsList component provides mobile-optimized bottom navigation pattern
- Consistent with Telegram platform design language
- Supports icons and active state indication

**Component Pattern**:
```typescript
<TabsList>
  <TabsItem text="Corgi" before={<Icon28DogOutline />} selected={currentTab === 'corgi'} />
  <TabsItem text="Settings" before={<Icon28SettingsOutline />} selected={currentTab === 'settings'} />
</TabsList>
```

**Icon Source**: Telegram UI library provides icon set (`@telegram-apps/telegram-ui/dist/icons`)

**Alternatives Considered**:
- Custom CSS bottom navigation: Rejected to maintain Telegram platform consistency
- Third-party mobile nav library (React Navigation): Rejected as unnecessary dependency

### 5. Component Reuse Strategy

**Decision**: Reuse existing BuddySearch and BuddyRequest components in onboarding flow

**Rationale**:
- Existing components already implement buddy search and request functionality
- DRY principle - avoid duplicating working code
- Onboarding buddy screen needs identical functionality to existing buddy page
- Components are already designed with Telegram UI library

**Integration Pattern**:
```typescript
// src/app/onboarding/buddy/page.tsx
import { BuddySearch } from '@/components/buddy/BuddySearch';
import { BuddyRequest } from '@/components/buddy/BuddyRequest';

// Onboarding-specific wrapper that enforces step completion
function OnboardingBuddyScreen() {
  const { buddyStatus } = useOnboardingGuard();

  return (
    <OnboardingLayout title="Add Your Buddy">
      {!buddyStatus?.pending ? <BuddySearch /> : <BuddyRequest />}
    </OnboardingLayout>
  );
}
```

**Alternatives Considered**:
- Create new onboarding-specific components: Rejected as code duplication
- Modify existing components with onboarding flags: Rejected as it couples concerns

### 6. Network Error Handling Strategy

**Decision**: Implement dedicated error screen with retry button for validation failures (FR-015, FR-016)

**Rationale**:
- Distinguish between network errors (transient) and validation failures (permanent)
- Existing ErrorPage component provides foundation for error UI
- Retry pattern consistent with user expectations for network failures
- Blocks access until successful validation (security requirement)

**Error Classification**:
```typescript
type OnboardingError =
  | { type: 'network', retryable: true }
  | { type: 'validation_failed', retryable: false }
  | { type: 'unauthorized', retryable: false };

// Network error = HTTP 5xx, timeout, connection refused
// Validation failure = HTTP 401, wallet disconnected, buddy removed
```

**Alternatives Considered**:
- Automatic retry with exponential backoff: Rejected as it hides issues from user
- Show partial app access during errors: Rejected as it violates security requirement

### 7. Wallet Unlinking Logic

**Decision**: Implement wallet unlinking in existing `/api/wallet/connect` endpoint via database UNIQUE constraint

**Rationale**:
- Database enforces `UNIQUE(ton_wallet_address)` constraint (likely already exists)
- When user connects wallet already linked to another account, UPDATE previous user's wallet to NULL
- Silent unlinking matches specification (FR-020, no notification required)
- Previous account user discovers disconnection on next re-validation

**SQL Pattern**:
```sql
BEGIN TRANSACTION;
  -- Clear wallet from any previous user
  UPDATE users SET ton_wallet_address = NULL WHERE ton_wallet_address = ?;
  -- Assign wallet to new user
  UPDATE users SET ton_wallet_address = ? WHERE id = ?;
COMMIT;
```

**Alternatives Considered**:
- Reject duplicate wallet connection: Rejected as spec explicitly allows automatic unlinking
- Send notification to previous account: Rejected as spec says "no notification"

### 8. Buddy Request Cancellation

**Decision**: Add `/api/buddy/cancel` endpoint to support pending request cancellation (FR-006)

**Rationale**:
- Spec requires cancel button on pending request display
- Existing buddy API has accept/reject but no cancel endpoint
- Cancel = DELETE pending buddy_pair row (different from reject which marks status)
- Allows user to search for different buddy after cancellation

**API Endpoint**:
```
DELETE /api/buddy/cancel
Request: { userId: number }
Response: { success: true, message: 'Request cancelled' }
```

**Alternatives Considered**:
- Reuse reject endpoint for cancellation: Rejected as semantics differ (reject preserves history, cancel removes)

### 9. Mobile-First CSS Strategy

**Decision**: Use TailwindCSS utility classes with mobile-first breakpoints, minimum width 320px

**Rationale**:
- TailwindCSS 4 already configured in project
- Mobile-first approach aligns with Telegram Mini App platform
- Success criteria SC-004 requires 320px minimum width support
- Telegram UI components already responsive

**Breakpoint Pattern**:
```typescript
<div className="p-4 sm:p-6 max-w-md mx-auto">
  <Button className="w-full touch-manipulation min-h-[44px]">
    Connect Wallet
  </Button>
</div>
```

**Touch-Friendly Guidelines**:
- Minimum touch target: 44px (Apple HIG standard)
- Use `touch-manipulation` CSS for responsive interactions
- Adequate spacing between interactive elements (8-12px)

**Alternatives Considered**:
- Desktop-first with media queries: Rejected as incompatible with mobile-first requirement
- CSS-in-JS styled-components: Rejected as TailwindCSS already established pattern

### 10. Testing Strategy

**Decision**: Implement integration tests using API-only black-box approach with Jest + in-memory SQLite

**Rationale**:
- Constitution IV mandates black-box testing via API endpoints
- Existing test setup uses Jest with better-sqlite3 (can use :memory: mode)
- Tests validate complete user journeys (US1: wallet, US2: buddy, US3: navigation)
- No service function imports - API contracts only

**Test Structure**:
```typescript
// tests/integration/onboarding.test.ts
describe('US1: First-Time Wallet Connection', () => {
  it('should block access to features until wallet connected', async () => {
    // POST /api/auth/validate (create new user)
    // GET /api/onboarding/status → expect wallet_connected: false, current_step: 'welcome'
    // GET /api/corgi/sightings → expect 401 or 403 (blocked)
    // POST /api/wallet/connect
    // GET /api/onboarding/status → expect wallet_connected: true, current_step: 'buddy'
  });
});
```

**Mock Strategy**:
- Mock Telegram Bot API (buddy notifications) using nock
- Mock TON RPC (wallet validation) using nock
- NO mocks for internal services, database, or business logic

**Alternatives Considered**:
- Unit tests for OnboardingService: Rejected as violates Constitution IV (integration tests mandatory)
- E2E tests with Playwright: Deferred as overkill for API validation (could be added later)

## Best Practices

### Telegram Mini App Patterns

1. **Client-Side Rendering**: Always use `'use client'` directive for pages
2. **Theme Integration**: Respect `miniApp.isDark` signal for light/dark mode
3. **Back Button**: Use `useBackButton` hook for Telegram native back button
4. **Loading States**: Show Telegram-styled placeholders during async operations

### State Management

1. **Server as Source of Truth**: Never trust client-side state without server validation
2. **Re-validate on Mount**: Every screen mount should fetch latest state
3. **Optimistic UI**: Show immediate feedback, but revert on server rejection
4. **Error Boundaries**: Wrap async operations with try-catch and user-friendly errors

### Security

1. **Always Validate initData**: Every API endpoint must validate Telegram HMAC signature
2. **Token Expiration**: JWT tokens should have reasonable expiration (24h max)
3. **Wallet Verification**: Verify TON wallet ownership through TON Connect SDK
4. **Rate Limiting**: Consider rate limits on buddy request endpoints (future enhancement)

## Dependencies

### Existing Dependencies (No Changes)
- `@telegram-apps/sdk-react@^3.3.7` - Telegram SDK integration
- `@telegram-apps/telegram-ui@^2.1.9` - UI components
- `@tonconnect/ui-react@^2.3.0` - TON wallet connection
- `next@15.5.3` - Next.js App Router
- `react@18.3.1` - React core
- `better-sqlite3@^12.2.0` - SQLite database
- `tailwindcss@^4` - Utility CSS

### New Dependencies
None - all requirements met with existing dependencies

## Migration Requirements

### Database Migrations

**Migration**: Add buddy request cancellation support (if not already supported)

```sql
-- No schema changes required
-- Existing buddy_pairs table already supports DELETE operation for cancellation
-- Verify: buddy_pairs table allows DELETE without constraints
```

**Migration**: Verify wallet address uniqueness

```sql
-- Ensure ton_wallet_address has UNIQUE constraint
-- If not, add migration:
CREATE UNIQUE INDEX idx_users_ton_wallet_unique ON users(ton_wallet_address) WHERE ton_wallet_address IS NOT NULL;
```

### Data Migration
No data migration required - onboarding state is derived from existing data

## Performance Considerations

### API Response Times
- Target: <500ms for /api/onboarding/status (includes wallet + buddy queries)
- Optimization: Use database indexes on users.id and buddy_pairs user columns
- Success Criteria SC-007: State changes reflect within 3 seconds

### Client-Side Performance
- Target: 60fps UI interactions (Constitution - Performance Goals)
- Lazy load components not needed for current onboarding step
- Optimize re-renders with React.memo for static components

### Mobile Performance
- Target: <3s state validation on app open
- Network conditions: Assume 3G minimum (Telegram's target demographic)
- Bundle size: Minimize JavaScript payload with code splitting

## Risks & Mitigations

### Risk 1: Race Conditions in Re-Authentication
**Risk**: User opens app while auth token expires, causing re-validation failures
**Mitigation**: Existing AuthProvider uses AuthMutex to prevent concurrent re-auth (see AuthProvider.tsx:318)

### Risk 2: Buddy Request State Synchronization
**Risk**: User A sends request to User B, but User B's app shows stale state
**Mitigation**: Implement polling or Server-Sent Events for real-time updates (future enhancement - deferred as not in MVP scope)

### Risk 3: Wallet Unlinking Without User Awareness
**Risk**: User unknowingly loses wallet by connecting it to new account
**Mitigation**: Show confirmation dialog in wallet connect flow: "This wallet is already connected. Connecting here will disconnect it from the other account. Continue?" (UI enhancement - recommended but not required by spec)

## Future Enhancements

1. **Progressive Web App**: Add PWA manifest for standalone mobile experience
2. **Animations**: Add smooth transitions between onboarding steps
3. **Tutorial Tooltips**: Add optional onboarding tutorial (currently out of scope per spec)
4. **Real-Time Updates**: Replace polling with WebSocket/SSE for buddy request notifications
5. **Analytics**: Track onboarding completion rates and drop-off points
6. **Accessibility**: Add ARIA labels and keyboard navigation support

## References

- Feature Specification: [spec.md](./spec.md)
- Project Constitution: [.specify/memory/constitution.md](../../.specify/memory/constitution.md)
- Telegram Mini Apps Docs: https://core.telegram.org/bots/webapps
- TON Connect Docs: https://docs.ton.org/develop/dapps/ton-connect/overview
- Next.js App Router: https://nextjs.org/docs/app
- Telegram UI Components: https://telegram-apps.github.io/telegram-ui/

---

**Research Status**: ✅ Complete
**Next Step**: Phase 1 - Generate data-model.md, contracts/, and quickstart.md
