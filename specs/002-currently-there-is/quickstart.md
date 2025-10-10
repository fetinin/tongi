# Quickstart: Buddy Request Accept/Reject Actions

**Feature**: 002-currently-there-is
**Branch**: `002-currently-there-is`
**Date**: 2025-10-09

## Overview

This guide helps you implement the buddy request accept/reject functionality from scratch. Follow these steps in order for a smooth implementation process.

## Prerequisites

Before starting, ensure:
- ✅ You're on branch `002-currently-there-is`
- ✅ Dependencies installed: `pnpm install`
- ✅ Development server can run: `pnpm run dev:https`
- ✅ You've read `spec.md`, `research.md`, and `data-model.md`

## Implementation Checklist

### Phase 1: Service Layer (Foundation)

**File**: `src/services/BuddyService.ts`

- [ ] **Step 1.1**: Add `rejectBuddyRequest` method
  - Location: After `confirmBuddyRequest()` method (line ~514)
  - Pattern: Copy structure from `confirmBuddyRequest`, modify for reject logic
  - Key differences:
    - Set status to 'dissolved' (not 'active')
    - Do NOT set confirmed_at
    - Call `notifyBuddyRejected` instead of `notifyBuddyConfirmed`

```typescript
/**
 * Reject a pending buddy request (set status to dissolved)
 */
public async rejectBuddyRequest(
  buddyPairId: number,
  rejectingUserId: number
): Promise<BuddyPairWithProfile> {
  // Implementation follows confirmBuddyRequest pattern
  // See research.md for detailed logic
}
```

**File**: `src/services/NotificationService.ts`

- [ ] **Step 1.2**: Add `notifyBuddyRejected` method
  - Location: After `notifyBuddyConfirmed()` method (line ~82)
  - Message format: `"❌ Buddy request: {rejecterName} declined your buddy request."`

```typescript
public async notifyBuddyRejected(
  initiatorUserId: number,
  rejecterName: string
): Promise<void> {
  const message = `❌ Buddy request: ${rejecterName} declined your buddy request.`;
  await this.sendMessage(initiatorUserId, message).catch(() => {});
}
```

**Verification**:
```bash
# Type check should pass
pnpm run type-check
```

---

### Phase 2: API Routes

**File**: `src/app/api/buddy/accept/route.ts` (NEW FILE)

- [ ] **Step 2.1**: Create accept endpoint
  - Copy pattern from `src/app/api/buddy/request/route.ts`
  - Validate initData server-side
  - Extract buddyPairId from request body
  - Call `buddyService.confirmBuddyRequest(buddyPairId, userId)`
  - Return BuddyPairWithProfile response

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { validate } from '@tma.js/init-data-node';
import { buddyService } from '@/services/BuddyService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { initData, buddyPairId } = body;

    // Validate Telegram authentication
    const validation = validate(
      initData,
      process.env.TELEGRAM_BOT_TOKEN!
    );

    if (!validation.validatedData) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = validation.validatedData.user.id;

    // Call service to accept request
    const result = await buddyService.confirmBuddyRequest(
      buddyPairId,
      userId
    );

    return NextResponse.json(result);
  } catch (error) {
    // Error handling (see research.md for full pattern)
  }
}
```

**File**: `src/app/api/buddy/reject/route.ts` (NEW FILE)

- [ ] **Step 2.2**: Create reject endpoint
  - Same pattern as accept, but call `buddyService.rejectBuddyRequest()`

**Verification**:
```bash
# Start dev server
pnpm run dev:https

# Test accept endpoint (replace initData and buddyPairId)
curl -X POST https://localhost:3000/api/buddy/accept \
  -H "Content-Type: application/json" \
  -d '{"initData":"...","buddyPairId":1}'

# Test reject endpoint
curl -X POST https://localhost:3000/api/buddy/reject \
  -H "Content-Type: application/json" \
  -d '{"initData":"...","buddyPairId":2}'
```

---

### Phase 3: UI Component Updates

**File**: `src/components/buddy/BuddyStatus.tsx`

- [ ] **Step 3.1**: Add state for processing
  - Location: Near other useState declarations (around line 56-58)

```typescript
const [isProcessing, setIsProcessing] = useState(false);
const [actionError, setActionError] = useState<string | null>(null);
```

- [ ] **Step 3.2**: Add accept handler
  - Location: After `handleDissolveBuddy` function (around line 114)

```typescript
const handleAccept = useCallback(async () => {
  if (!buddyStatus || buddyStatus.status === 'no_buddy') return;
  if (buddyStatus.status !== 'pending') return;

  setIsProcessing(true);
  setActionError(null);

  try {
    const response = await fetch('/api/buddy/accept', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        initData: window.Telegram?.WebApp?.initData,
        buddyPairId: buddyStatus.id,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to accept request');
    }

    // Refresh buddy status
    await fetchBuddyStatus();
  } catch (err) {
    setActionError(
      err instanceof Error ? err.message : 'Failed to accept request'
    );
  } finally {
    setIsProcessing(false);
  }
}, [buddyStatus, fetchBuddyStatus]);
```

- [ ] **Step 3.3**: Add reject handler
  - Same pattern as accept, but call `/api/buddy/reject`

- [ ] **Step 3.4**: Add action buttons UI
  - Location: Inside the buddy relationship section, after the wallet status cell (around line 283)
  - Condition: Only show if `status === 'pending'` AND `user?.id !== buddyStatus.initiatedBy`

```tsx
{/* Accept/Reject Actions - Only show for pending requests where user is recipient */}
{buddyStatus.status === 'pending' &&
  user?.id !== buddyStatus.initiatedBy && (
    <>
      {actionError && (
        <Cell>
          <div className="text-red-500 text-sm">{actionError}</div>
        </Cell>
      )}
      <Cell>
        <div className="flex gap-2">
          <Button
            mode="primary"
            size="m"
            onClick={handleAccept}
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Accept'}
          </Button>
          <Button
            mode="outline"
            size="m"
            onClick={handleReject}
            disabled={isProcessing}
          >
            Reject
          </Button>
        </div>
      </Cell>
    </>
  )}
```

**Verification**:
```bash
# Type check
pnpm run type-check

# Start dev server
pnpm run dev:https

# Open in Telegram (follow CLAUDE.md instructions)
# Navigate to buddy status screen
# Verify buttons appear for pending requests (recipient only)
```

---

### Phase 4: Optional Enhancements

- [ ] **Step 4.1**: Add haptic feedback (optional)
  - Import `useHapticFeedback` from `@telegram-apps/sdk-react`
  - Call `haptic.impactOccurred('medium')` at start of handlers

```typescript
import { useHapticFeedback } from '@telegram-apps/sdk-react';

// Inside component
const haptic = useHapticFeedback();

const handleAccept = useCallback(async () => {
  haptic.impactOccurred('medium');
  // ... rest of handler
}, [haptic, ...]);
```

- [ ] **Step 4.2**: Add confirmation dialog for reject (P3 priority, see spec.md)
  - Use Telegram UI Modal component
  - Prompt: "Are you sure you want to reject this buddy request?"
  - Buttons: "Cancel" and "Reject"

---

### Phase 5: Testing

**Unit Tests**: `tests/services/BuddyService.test.ts` (NEW FILE)

- [ ] **Step 5.1**: Test `rejectBuddyRequest` success case
- [ ] **Step 5.2**: Test validation errors (initiator tries to reject)
- [ ] **Step 5.3**: Test invalid status (already active/dissolved)
- [ ] **Step 5.4**: Test buddy pair not found

**API Tests**: `tests/api/buddy/accept.test.ts`, `reject.test.ts` (NEW FILES)

- [ ] **Step 5.5**: Test authentication validation
- [ ] **Step 5.6**: Test request body validation
- [ ] **Step 5.7**: Test successful responses
- [ ] **Step 5.8**: Test error handling

**Component Tests**: `tests/components/BuddyStatus.test.tsx` (NEW FILE)

- [ ] **Step 5.9**: Test buttons shown only to recipient
- [ ] **Step 5.10**: Test buttons hidden for initiator
- [ ] **Step 5.11**: Test disabled state during processing
- [ ] **Step 5.12**: Test error display

**Run Tests**:
```bash
pnpm test
```

---

### Phase 6: Integration Testing

- [ ] **Step 6.1**: Seed test data
  - Create two test users in database
  - Create pending buddy pair with user1 as initiator

```sql
-- In sqlite3 or seed script
INSERT INTO users (id, telegram_username, first_name)
VALUES (111111, 'alice', 'Alice'), (222222, 'bob', 'Bob');

INSERT INTO buddy_pairs (user1_id, user2_id, initiated_by, status)
VALUES (111111, 222222, 111111, 'pending');
```

- [ ] **Step 6.2**: Test accept flow
  1. Log in as Bob (user 222222)
  2. Navigate to buddy status screen
  3. Verify "Accept" and "Reject" buttons visible
  4. Tap "Accept"
  5. Verify status changes to "Active Buddy"
  6. Verify Alice receives notification

- [ ] **Step 6.3**: Test reject flow
  1. Create new pending request (Alice → Bob)
  2. Log in as Bob
  3. Tap "Reject"
  4. Verify screen shows "No Buddy Yet"
  5. Verify Alice receives rejection notification

- [ ] **Step 6.4**: Test initiator view
  1. Log in as Alice (initiator)
  2. Verify no action buttons shown
  3. Verify "Request Sent" badge displayed

- [ ] **Step 6.5**: Test error cases
  - Network timeout (disable internet, tap button)
  - Invalid request (delete buddy pair, tap button)
  - Concurrent modification (accept from two devices simultaneously)

---

## Quick Reference

### File Locations

```
src/
├── services/
│   ├── BuddyService.ts          # Add rejectBuddyRequest()
│   └── NotificationService.ts   # Add notifyBuddyRejected()
├── app/api/buddy/
│   ├── accept/route.ts          # NEW: Accept endpoint
│   └── reject/route.ts          # NEW: Reject endpoint
└── components/buddy/
    └── BuddyStatus.tsx          # Add accept/reject UI

tests/
├── services/
│   └── BuddyService.test.ts     # NEW: Service tests
├── api/buddy/
│   ├── accept.test.ts           # NEW: Accept API tests
│   └── reject.test.ts           # NEW: Reject API tests
└── components/
    └── BuddyStatus.test.tsx     # NEW: Component tests
```

### Key Commands

```bash
# Development
pnpm run dev:https              # Start HTTPS dev server
pnpm run type-check             # Check TypeScript
pnpm run lint                   # Check code style
pnpm run validate               # Run both type-check and lint

# Testing
pnpm test                       # Run all tests
pnpm test:watch                 # Watch mode
pnpm test:coverage              # Coverage report

# Database
pnpm run db:migrate             # Run migrations (none needed)
sqlite3 data/app.db             # Open database
```

### Common Issues

**Issue**: Buttons not showing
- **Check**: User is recipient, not initiator (`user.id !== buddyStatus.initiatedBy`)
- **Check**: Status is 'pending' (`buddyStatus.status === 'pending'`)

**Issue**: 401 Unauthorized
- **Check**: Telegram bot token set (`TELEGRAM_BOT_TOKEN` in `.env.local`)
- **Check**: Using HTTPS dev server (`pnpm run dev:https`)
- **Check**: initData passed correctly (`window.Telegram?.WebApp?.initData`)

**Issue**: 404 Buddy Not Found
- **Check**: buddyPairId exists in database
- **Check**: Status is 'pending' (not already processed)

**Issue**: Cannot accept own request
- **Expected**: Validation working correctly
- **Solution**: Send request from different user account

---

## Success Criteria

Before marking this feature complete, verify:

- ✅ Accept button works for recipients, changes status to 'active'
- ✅ Reject button works for recipients, changes status to 'dissolved'
- ✅ Initiators see "Request Sent" with no action buttons
- ✅ Notifications sent to initiator on accept and reject
- ✅ UI updates immediately after successful action
- ✅ Error messages display clearly on failures
- ✅ All tests pass (`pnpm test`)
- ✅ Type checking passes (`pnpm run type-check`)
- ✅ Code style passes (`pnpm run lint`)

---

## Next Steps

After completing this implementation:

1. **Code Review**: Submit PR for review using `/speckit.tasks` generated task list
2. **QA Testing**: Manual testing in Telegram client (Web + Mobile)
3. **Performance Testing**: Verify <2s completion time for actions
4. **Documentation**: Update any user-facing docs if needed
5. **Deployment**: Merge to main and deploy to production

---

## Support & Resources

- **Spec**: See `spec.md` for requirements and user stories
- **Research**: See `research.md` for technical decisions
- **Data Model**: See `data-model.md` for database details
- **API Contracts**: See `contracts/` for OpenAPI specs
- **CLAUDE.md**: Project-level development guidelines

**Questions?** Review the spec documents or consult with the team.
