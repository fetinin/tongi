# Quickstart: Mobile-First Onboarding Flow

**Feature**: 005-mobile-first-onboarding
**Branch**: `005-mobile-first-onboarding`
**Target Completion**: TBD

## Overview

This quickstart guide helps developers understand and implement the mobile-first onboarding flow feature. The feature enforces a linear progression (wallet → buddy → main app) with state-based routing and server-side validation.

## Prerequisites

Before starting development, ensure you have:

- [x] Node.js 20+ installed
- [x] pnpm installed (`npm install -g pnpm`)
- [x] Repository cloned and dependencies installed (`pnpm install`)
- [x] Database initialized (`pnpm run db:migrate`)
- [x] Development environment configured (`.env.local` with `NEXT_PUBLIC_USE_MOCK_AUTH=true`)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    User Opens App                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
          ┌───────────────────────┐
          │ AuthProvider          │ (Existing)
          │ - Validates Telegram  │
          │ - Issues JWT token    │
          └───────────┬───────────┘
                      │
                      ▼
          ┌───────────────────────┐
          │ OnboardingGuard       │ (NEW)
          │ GET /api/onboarding/  │
          │       status          │
          └───────────┬───────────┘
                      │
         ┌────────────┴────────────┐
         │                         │
         ▼                         ▼
  wallet_connected=false    wallet_connected=true
  buddy_confirmed=false     buddy_confirmed=false
         │                         │
         ▼                         ▼
  ┌─────────────┐          ┌──────────────┐
  │   Welcome   │          │  Add Buddy   │
  │   Screen    │          │    Screen    │
  │ (Connect    │          │ (Search/     │
  │  Wallet)    │          │  Request)    │
  └──────┬──────┘          └──────┬───────┘
         │                         │
         └────────────┬────────────┘
                      │
                      ▼
            wallet_connected=true
            buddy_confirmed=true
                      │
                      ▼
          ┌───────────────────────┐
          │   Main App            │
          │ ┌─────────────────┐   │
          │ │ Bottom Nav      │   │
          │ ├─────────────────┤   │
          │ │ 🐕 Corgi  │ ⚙️    │   │
          │ └─────────────────┘   │
          └───────────────────────┘
```

## Key Components

### 1. Onboarding State Guard (NEW)

**Location**: `src/hooks/useOnboardingGuard.ts`

```typescript
export function useOnboardingGuard() {
  const [onboardingState, setOnboardingState] = useState<OnboardingState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { authenticatedFetch } = useAuth();

  useEffect(() => {
    async function checkOnboardingStatus() {
      try {
        const response = await authenticatedFetch('/api/onboarding/status');
        const data = await response.json();

        setOnboardingState(data.onboarding);

        // Redirect based on current step
        if (window.location.pathname === '/') {
          if (data.onboarding.current_step === 'welcome') {
            router.push('/onboarding/welcome');
          } else if (data.onboarding.current_step === 'buddy') {
            router.push('/onboarding/buddy');
          }
          // If complete, stay on main page
        }
      } catch (error) {
        // Handle network errors vs validation errors
        handleOnboardingError(error);
      } finally {
        setIsLoading(false);
      }
    }

    checkOnboardingStatus();
  }, []);

  return { onboardingState, isLoading };
}
```

### 2. Onboarding Status API (NEW)

**Location**: `src/app/api/onboarding/status/route.ts`

```typescript
export async function GET(request: NextRequest) {
  // 1. Authenticate request (validate Telegram initData)
  const authResult = authenticateRequest(request);
  if (!authResult.success) {
    return NextResponse.json({ success: false, error: 'Auth failed' }, { status: 401 });
  }

  const userId = authResult.user!.id;

  // 2. Fetch user and buddy status
  const user = await userService.getUser(userId);
  const buddyStatus = await buddyService.getBuddyStatus(userId);

  // 3. Derive onboarding state
  const onboardingState = deriveOnboardingState(user, buddyStatus);

  // 4. Return response
  return NextResponse.json({
    success: true,
    onboarding: onboardingState,
    wallet: user.ton_wallet_address ? { address: user.ton_wallet_address } : undefined,
    buddy: buddyStatus.status === 'confirmed' ? { ...buddyStatus } : undefined,
  });
}
```

### 3. Welcome Screen (NEW)

**Location**: `src/app/onboarding/welcome/page.tsx`

```typescript
'use client';

export default function WelcomePage() {
  const { user } = useAuth();
  const [tonConnectUI] = useTonConnectUI();

  async function handleConnectWallet() {
    // TON Connect UI handles wallet connection
    await tonConnectUI.connectWallet();
    // On success, useEffect in AuthProvider updates wallet address via API
    // Then redirect to /onboarding/buddy
  }

  return (
    <Placeholder
      header="Welcome to Corgi Buddy!"
      description="Connect your TON wallet to start earning Corgi coins"
      action={
        <Button onClick={handleConnectWallet}>
          Connect Wallet
        </Button>
      }
    >
      <div className="text-6xl">🐕</div>
    </Placeholder>
  );
}
```

### 4. Add Buddy Screen (NEW)

**Location**: `src/app/onboarding/buddy/page.tsx`

```typescript
'use client';

import { BuddySearch } from '@/components/buddy/BuddySearch';
import { BuddyRequest } from '@/components/buddy/BuddyRequest';

export default function AddBuddyPage() {
  const { authenticatedFetch } = useAuth();
  const [buddyStatus, setBuddyStatus] = useState<BuddyStatusResult | null>(null);

  useEffect(() => {
    fetchBuddyStatus();
  }, []);

  async function fetchBuddyStatus() {
    const response = await authenticatedFetch('/api/buddy/status');
    const data = await response.json();
    setBuddyStatus(data);
  }

  async function handleCancelRequest() {
    await authenticatedFetch('/api/buddy/cancel', { method: 'DELETE' });
    fetchBuddyStatus(); // Refresh status
  }

  return (
    <div>
      <h1>Add Your Buddy</h1>
      {buddyStatus?.status === 'pending' ? (
        <div>
          <p>Request Pending</p>
          <Button onClick={handleCancelRequest}>Cancel Request</Button>
        </div>
      ) : (
        <BuddySearch onRequestSent={fetchBuddyStatus} />
      )}
    </div>
  );
}
```

### 5. Bottom Navigation (NEW)

**Location**: `src/components/layout/BottomNavigation.tsx`

```typescript
'use client';

import { TabsList, TabsItem } from '@telegram-apps/telegram-ui';
import { usePathname, useRouter } from 'next/navigation';

export function BottomNavigation() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <TabsList>
      <TabsItem
        text="Corgi"
        before={<Icon28DogOutline />}
        selected={pathname === '/corgi'}
        onClick={() => router.push('/corgi')}
      />
      <TabsItem
        text="Settings"
        before={<Icon28SettingsOutline />}
        selected={pathname === '/settings'}
        onClick={() => router.push('/settings')}
      />
    </TabsList>
  );
}
```

## Development Workflow

### Step 1: Setup Development Environment

```bash
# Clone repository
git clone <repo-url>
cd tongi

# Install dependencies
pnpm install

# Initialize database
pnpm run db:migrate

# Configure mock auth for local development
echo "NEXT_PUBLIC_USE_MOCK_AUTH=true" >> .env.local

# Start dev server
pnpm run dev
```

### Step 2: Implement Database Changes (if needed)

```bash
# Check if wallet UNIQUE constraint exists
sqlite3 data/app.db "PRAGMA index_list('users');"

# If not, create migration
# File: scripts/migrations/add_wallet_unique_constraint.ts
```

### Step 3: Implement Backend (API Routes)

**Order of implementation:**
1. `/api/onboarding/status` - Core state validation endpoint
2. `/api/buddy/cancel` - Cancel buddy request endpoint
3. Enhance `/api/wallet/connect` - Add automatic unlinking logic

**Testing approach:**
```bash
# Write integration tests FIRST (red-green-refactor)
touch tests/integration/onboarding.test.ts

# Run tests (they should fail initially)
pnpm run test tests/integration/onboarding.test.ts

# Implement endpoints
# ...

# Run tests again (they should pass)
pnpm run test tests/integration/onboarding.test.ts
```

### Step 4: Implement Frontend (UI Components)

**Order of implementation:**
1. `useOnboardingGuard` hook - Fetch and redirect logic
2. `OnboardingLayout` component - Shared layout for onboarding screens
3. `WelcomeScreen` - Wallet connection prompt
4. `AddBuddyScreen` - Buddy search/request UI
5. `BottomNavigation` - Main app navigation
6. Modify `src/app/page.tsx` - Add onboarding guard

### Step 5: Manual Testing

```bash
# Run HTTPS dev server (required for Telegram testing)
pnpm run dev:https

# Test in browser
open https://127.0.0.1:3000

# Test flow:
# 1. Clear localStorage (simulate new user)
# 2. Should redirect to /onboarding/welcome
# 3. Connect wallet (use TON Connect test wallet)
# 4. Should redirect to /onboarding/buddy
# 5. Search and send buddy request
# 6. (On another device) Accept buddy request
# 7. Should redirect to main app with bottom navigation
```

### Step 6: Telegram Integration Testing

```bash
# Submit dev URL to @BotFather
# URL: https://127.0.0.1:3000 (NOT localhost - use 127.0.0.1)

# Open Telegram Web or Desktop client
# Navigate to your bot
# Open Mini App
# Test complete onboarding flow
```

### Step 7: Pre-Commit Validation

```bash
# REQUIRED before committing
pnpm run format:check
pnpm run validate  # lint + type-check
pnpm run test

# If all pass, commit
git add .
git commit -m "feat: implement mobile-first onboarding flow"
```

## Testing Strategy

### Integration Tests (MANDATORY)

**Location**: `tests/integration/onboarding.test.ts`

```typescript
describe('US1: First-Time Wallet Connection', () => {
  it('should block access until wallet connected', async () => {
    // Arrange: Create new user
    const authResponse = await fetch('/api/auth/validate', {
      method: 'POST',
      body: JSON.stringify({ initData: mockInitData }),
    });
    const { token } = await authResponse.json();

    // Act: Check onboarding status
    const statusResponse = await fetch('/api/onboarding/status', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const statusData = await statusResponse.json();

    // Assert: Should be on welcome step
    expect(statusData.onboarding.current_step).toBe('welcome');
    expect(statusData.onboarding.wallet_connected).toBe(false);

    // Act: Try to access Corgi sightings (should be blocked)
    const corgiResponse = await fetch('/api/corgi/sightings', {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Assert: Should be blocked (401 or 403)
    expect(corgiResponse.status).toBeGreaterThanOrEqual(401);
  });

  it('should redirect to buddy step after wallet connection', async () => {
    // ... connect wallet ...
    // ... check onboarding status ...
    // ... expect current_step === 'buddy' ...
  });
});
```

### Unit Tests (ONLY IF NEEDED)

Unit tests are only required for complex validation logic. Simple CRUD and state derivation is covered by integration tests.

Example (if complex validation emerges):
```typescript
describe('OnboardingStateDerivation', () => {
  it('should derive correct state for all combinations', () => {
    // Test complex state transition logic
  });
});
```

## Common Issues & Solutions

### Issue 1: Wallet connection not persisting

**Symptom**: User connects wallet but onboarding status still shows `wallet_connected: false`

**Solution**: Check AuthProvider's wallet update logic. Ensure `updateWalletAddress` is called on TON Connect status change.

### Issue 2: Infinite redirect loop

**Symptom**: Page keeps redirecting between onboarding screens

**Solution**: Check `useOnboardingGuard` redirect logic. Ensure it only redirects from `/` path, not from onboarding paths.

### Issue 3: Buddy status not updating in real-time

**Symptom**: User's buddy accepts request, but app doesn't show buddy confirmation

**Solution**: Implement polling or add "Refresh" button. Real-time updates via WebSocket are future enhancement.

### Issue 4: Tests failing with "Cannot find module '@/...'

**Symptom**: Jest tests fail with module resolution errors

**Solution**: Ensure `tsconfig.json` paths are configured in `jest.config.js`:

```javascript
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/src/$1',
}
```

## Performance Optimization

### Target Metrics
- Onboarding status check: <500ms
- State validation on app open: <3s
- UI interactions: 60fps

### Optimization Techniques
1. Database indexing on `users.id`, `buddy_pairs.user1_id`, `buddy_pairs.user2_id`
2. React.memo for static components
3. Lazy loading for non-critical components
4. Code splitting for onboarding routes

## Next Steps

After completing implementation:

1. **Manual Testing**: Test complete flow in Telegram
2. **Code Review**: Submit PR for team review
3. **QA Testing**: Coordinate with QA for test plan execution
4. **Analytics**: Add tracking for onboarding completion rates
5. **Documentation**: Update user-facing docs with onboarding instructions

## References

- [Feature Specification](./spec.md)
- [Research Document](./research.md)
- [Data Model](./data-model.md)
- [API Contracts](./contracts/onboarding-api.yaml)
- [Project Constitution](../../.specify/memory/constitution.md)
- [Telegram Mini Apps Docs](https://core.telegram.org/bots/webapps)
- [TON Connect Docs](https://docs.ton.org/develop/dapps/ton-connect/overview)

## Questions?

For technical questions or clarifications, refer to:
- Feature spec clarifications section
- Research document decisions
- Project constitution principles
