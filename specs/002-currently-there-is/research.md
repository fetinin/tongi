# Research: Buddy Request Accept/Reject Actions

**Feature**: 002-currently-there-is
**Date**: 2025-10-09
**Status**: Complete

## Overview

This document captures technical research and design decisions for implementing accept/reject functionality for buddy requests in the Telegram Mini App.

## 1. Existing Architecture Analysis

### Database Schema (RESOLVED)
**Question**: What is the current buddy_pairs table schema and what status transitions are supported?

**Finding**: From examining `src/services/BuddyService.ts` and existing code:
- Table: `buddy_pairs` with columns: `id`, `user1_id`, `user2_id`, `initiated_by`, `status`, `created_at`, `confirmed_at`
- User IDs are normalized (lower ID → user1_id, higher ID → user2_id)
- Supported statuses: `pending`, `active`, `dissolved`
- Current transitions implemented: create → pending, confirmBuddyRequest → active, dissolveBuddyRelationship → dissolved

**Decision**: Use existing schema without modifications. Add new service methods for accept (uses existing confirmBuddyRequest) and reject (new rejectBuddyRequest method similar to dissolveBuddyRelationship pattern).

**Rationale**: Schema already supports needed states. No database migration required.

---

### Service Layer Patterns (RESOLVED)
**Question**: What is the established pattern for service methods, transactions, and error handling?

**Finding**: BuddyService already has `confirmBuddyRequest()` method (lines 413-514 in BuddyService.ts) that:
1. Validates the confirming user is the recipient (not the initiator)
2. Checks relationship status is pending
3. Uses `withTransaction()` for atomic updates
4. Updates status to 'active' and sets confirmed_at timestamp
5. Sends notification via NotificationService
6. Throws typed errors (BuddyValidationError, BuddyConflictError, BuddyNotFoundError)

**Decision**:
- **Accept**: Use existing `confirmBuddyRequest()` - no new service method needed
- **Reject**: Create new `rejectBuddyRequest(buddyPairId, rejectingUserId)` following same validation pattern but setting status to 'dissolved'

**Rationale**: Reuse proven patterns, maintain consistency with existing code. Accept functionality already exists (it was called "confirm" in the original implementation).

**Alternatives Considered**: Create separate accept/reject methods with new names - rejected because confirmBuddyRequest already implements accept logic correctly.

---

### API Endpoint Conventions (RESOLVED)
**Question**: What is the REST API pattern for buddy operations?

**Finding**: Existing endpoints in `src/app/api/buddy/`:
- `/api/buddy/request` - POST to create buddy request
- `/api/buddy/status` - GET to retrieve current buddy status
- `/api/buddy/search` - GET to search for users

Pattern observed:
- Use Next.js App Router route handlers
- Validate Telegram initData server-side using `@tma.js/init-data-node`
- Return JSON responses with appropriate HTTP status codes
- Handle errors with try/catch and return error objects

**Decision**: Create new API routes:
- `/api/buddy/accept` - POST with body `{ buddyPairId: number }`
- `/api/buddy/reject` - POST with body `{ buddyPairId: number }`

**Rationale**: Follows RESTful conventions, separates concerns, allows different validation logic per action.

**Alternatives Considered**: Single `/api/buddy/respond` endpoint with action parameter - rejected for clarity and type safety.

---

### UI Component Architecture (RESOLVED)
**Question**: How should accept/reject buttons be integrated into BuddyStatus component?

**Finding**: From `src/components/buddy/BuddyStatus.tsx` (lines 239-320):
- Component already displays different UI based on status (pending vs active)
- Uses `@telegram-apps/telegram-ui` Button component
- Shows badge indicating "Request Sent" vs "Pending Your Response" based on `initiatedBy`
- Has action buttons section for active buddies (line 286-303)

**Decision**: Add conditional action buttons section for pending status when user is recipient:
```tsx
{buddyStatus.status === 'pending' && user?.id !== buddyStatus.initiatedBy && (
  <Cell>
    <div className="flex gap-2">
      <Button mode="primary" onClick={handleAccept} disabled={isProcessing}>
        Accept
      </Button>
      <Button mode="outline" onClick={handleReject} disabled={isProcessing}>
        Reject
      </Button>
    </div>
  </Cell>
)}
```

**Rationale**: Maintains existing component structure, uses established UI patterns, follows Telegram UI design system.

---

### Notification Service Integration (RESOLVED)
**Question**: How should notifications be sent when requests are accepted/rejected?

**Finding**: From `src/services/NotificationService.ts`:
- Existing method `notifyBuddyConfirmed(initiatorUserId, confirmerName)` (line 79-82)
- Pattern: best-effort, non-blocking, fails gracefully with `.catch(() => {})`
- Bot token configured via `TELEGRAM_BOT_TOKEN` environment variable

**Decision**:
- **Accept**: Use existing `notifyBuddyConfirmed()`
- **Reject**: Add new `notifyBuddyRejected(initiatorUserId, rejecterName)` method

Message format:
```typescript
public async notifyBuddyRejected(initiatorUserId: number, rejecterName: string): Promise<void> {
  const message = `❌ Buddy request: ${rejecterName} declined your buddy request.`;
  await this.sendMessage(initiatorUserId, message).catch(() => {});
}
```

**Rationale**: Follows established notification patterns, provides clear user feedback, handles bot failures gracefully.

---

## 2. Technology Stack

### TypeScript & React Patterns (RESOLVED)
**Question**: What TypeScript and React patterns are used for state management and async operations?

**Finding**:
- React 18.3.1 with hooks (useState, useEffect, useCallback)
- TypeScript strict mode enabled
- State management via React context (AuthProvider) for authentication
- Async operations use try/catch with loading states
- Component interfaces define props with JSDoc comments

**Decision**: Use React hooks pattern for button handlers:
```typescript
const [isProcessing, setIsProcessing] = useState(false);

const handleAccept = useCallback(async () => {
  setIsProcessing(true);
  try {
    const response = await fetch('/api/buddy/accept', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ buddyPairId: buddyStatus.id })
    });
    if (!response.ok) throw new Error('Failed to accept');
    await fetchBuddyStatus(); // Refresh status
  } catch (err) {
    setError(err.message);
  } finally {
    setIsProcessing(false);
  }
}, [token, buddyStatus, fetchBuddyStatus]);
```

**Rationale**: Consistent with existing BuddyStatus component patterns, prevents duplicate submissions, provides loading feedback.

---

### Telegram SDK Integration (RESOLVED)
**Question**: Are there any Telegram SDK considerations for button interactions?

**Finding**:
- Uses `@telegram-apps/sdk-react` for Telegram Mini Apps features
- Components are client-side only ('use client' directive)
- No special SDK integration needed for basic buttons
- Haptic feedback available via `useHapticFeedback()` hook

**Decision**: Add optional haptic feedback on button press for better UX:
```typescript
import { useHapticFeedback } from '@telegram-apps/sdk-react';

const haptic = useHapticFeedback();

const handleAccept = useCallback(async () => {
  haptic.impactOccurred('medium');
  // ... rest of handler
}, [haptic, ...]);
```

**Rationale**: Enhances user experience with native-feeling interactions. Optional, won't break functionality if SDK unavailable.

**Alternatives Considered**: No haptic feedback - rejected because it's a simple enhancement that significantly improves UX.

---

## 3. Testing Strategy

### Test Coverage Requirements (RESOLVED)
**Question**: What types of tests are needed and what framework should be used?

**Finding**:
- Jest 30.1.3 configured with ts-jest
- Test commands: `pnpm test`, `pnpm test:watch`, `pnpm test:coverage`
- No existing test files found for buddy features (needs to be created)

**Decision**: Create three test layers:

1. **Service Layer Tests** (`tests/services/BuddyService.test.ts`):
   - Test rejectBuddyRequest validates user is recipient
   - Test rejectBuddyRequest sets status to dissolved
   - Test rejectBuddyRequest throws error if initiator tries to reject
   - Test rejectBuddyRequest throws error if already active/dissolved

2. **API Route Tests** (`tests/api/buddy/accept.test.ts`, `reject.test.ts`):
   - Test authentication validation
   - Test request body validation
   - Test successful response format
   - Test error handling

3. **Component Tests** (`tests/components/BuddyStatus.test.tsx`):
   - Test accept/reject buttons only shown to recipient
   - Test buttons disabled during processing
   - Test error display on failure
   - Test UI updates after successful action

**Rationale**: Comprehensive coverage at all layers ensures reliability. Unit tests for logic, integration tests for API, component tests for UX.

---

## 4. Error Handling & Edge Cases

### Race Conditions (RESOLVED)
**Question**: How to handle concurrent accept/reject attempts?

**Finding**:
- BuddyService uses `withTransaction()` wrapper for atomic operations
- Database will enforce constraints
- Service layer validates status is 'pending' before allowing changes

**Decision**:
1. Client-side: Disable buttons immediately on click (isProcessing state)
2. API layer: Use existing transaction wrapper
3. Service layer: Re-check status inside transaction before update
4. Return appropriate error if status changed (409 Conflict)

**Rationale**: Multi-layer protection prevents race conditions. Transaction ensures atomicity.

---

### Network Failures (RESOLVED)
**Question**: How should the UI handle network timeouts or 500 errors?

**Finding**: BuddyStatus component has existing error handling pattern:
- Displays error message in state
- Provides "Retry" button
- Preserves previous data during error state

**Decision**: Follow same pattern:
```typescript
catch (err) {
  setError(err instanceof Error ? err.message : 'Failed to process request');
  // Don't clear buddyStatus - keep showing current state
}
```

Display error in a dismissible alert or toast above the buddy status.

**Rationale**: Consistent with existing UX, allows user to retry without losing context.

---

### Invalid States (RESOLVED)
**Question**: What happens if buddy pair is deleted or user account is deleted?

**Finding**:
- UserService throws `UserNotFoundError` if user doesn't exist
- BuddyService throws `BuddyNotFoundError` if pair doesn't exist
- Both extend base error class with HTTP status codes

**Decision**:
- Handle 404 errors specifically in UI
- For deleted buddy pair: Show "This request is no longer valid"
- For deleted user account: Show "User not found"
- Both cases: Hide action buttons, provide "Back" or "Find New Buddy" option

**Rationale**: Graceful degradation, clear messaging helps user understand state.

---

## 5. Performance Considerations

### API Response Time (RESOLVED)
**Question**: Can we meet the <200ms API response goal?

**Finding**:
- SQLite with prepared statements (existing in BuddyService)
- Single database query + update in transaction
- Notification sent asynchronously (non-blocking)

**Decision**:
- Use existing prepared statement pattern
- Keep notification as best-effort async
- No additional optimizations needed

**Expected Performance**: ~10-50ms for database operations, well under 200ms target.

**Rationale**: Existing architecture already optimized, no bottlenecks identified.

---

### UI Responsiveness (RESOLVED)
**Question**: How to ensure <2 second completion time including UI update?

**Finding**:
- BuddyStatus already has `fetchBuddyStatus()` method
- Auto-refresh configured with 30s interval
- Manual refresh after actions

**Decision**:
1. Call API endpoint (~200ms)
2. On success, immediately call fetchBuddyStatus() to refresh UI
3. Show loading spinner during process
4. Total time: <500ms expected

**Rationale**: Immediate feedback loop ensures fast perceived performance.

---

## 6. Security Considerations

### Authorization (RESOLVED)
**Question**: How to ensure only the request recipient can accept/reject?

**Finding**:
- Telegram initData validated server-side in all API routes
- User ID extracted from validated initData
- BuddyService.confirmBuddyRequest already validates user is not initiator

**Decision**:
API route validation:
```typescript
// 1. Validate Telegram initData (existing pattern)
const validation = validate(initData, telegramBotToken);
if (!validation.validatedData) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// 2. Extract user ID
const userId = validation.validatedData.user.id;

// 3. Service validates user is recipient (existing in confirmBuddyRequest)
```

**Rationale**: Defense in depth - validation at API layer and service layer. Reuses proven auth pattern.

---

## Summary of Technical Decisions

| Component | Decision | Rationale |
|-----------|----------|-----------|
| **Database** | Use existing schema, no changes | Status transitions already supported |
| **Service Layer** | Reuse confirmBuddyRequest for accept, add rejectBuddyRequest | Consistency with existing patterns |
| **API Endpoints** | POST /api/buddy/accept and /api/buddy/reject | RESTful, type-safe, clear intent |
| **UI Components** | Add conditional buttons to BuddyStatus.tsx | Minimal changes, existing patterns |
| **Notifications** | Add notifyBuddyRejected to NotificationService | Follows established notification pattern |
| **State Management** | React hooks with isProcessing flag | Prevents duplicate submissions |
| **Error Handling** | Multi-layer validation, graceful degradation | Robust against edge cases |
| **Testing** | Service + API + Component tests | Comprehensive coverage |
| **Performance** | Prepared statements, async notifications | Meets <200ms API, <2s total goals |
| **Security** | Server-side initData validation + service-layer checks | Defense in depth |

## Open Questions

None - all clarifications resolved through code examination and architectural analysis.
