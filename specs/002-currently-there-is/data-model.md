# Data Model: Buddy Request Accept/Reject Actions

**Feature**: 002-currently-there-is
**Date**: 2025-10-09
**Status**: Complete

## Overview

This feature requires **no database schema changes**. All necessary tables and fields already exist in the database. This document describes how existing entities are used for accept/reject functionality.

## Entities

### BuddyPair (Existing - No Changes)

Represents the relationship between two users.

**Table**: `buddy_pairs`

**Fields**:
- `id` (INTEGER, PRIMARY KEY, AUTOINCREMENT) - Unique identifier
- `user1_id` (INTEGER, NOT NULL, FOREIGN KEY → users.id) - First user (lower ID)
- `user2_id` (INTEGER, NOT NULL, FOREIGN KEY → users.id) - Second user (higher ID)
- `initiated_by` (INTEGER, NOT NULL, FOREIGN KEY → users.id) - User who sent the request
- `status` (TEXT, NOT NULL) - Current relationship status: 'pending' | 'active' | 'dissolved'
- `created_at` (TEXT, NOT NULL, DEFAULT CURRENT_TIMESTAMP) - When request was created
- `confirmed_at` (TEXT, NULL) - When request was accepted (NULL for pending/rejected)

**Indexes**:
- PRIMARY KEY on `id`
- UNIQUE constraint on `(user1_id, user2_id)` - prevents duplicate relationships
- Index on `(user1_id, status)` for efficient status queries
- Index on `(user2_id, status)` for efficient status queries

**Constraints**:
- `user1_id < user2_id` (enforced by application logic in BuddyPairUtils.normalizeUserIds)
- `initiated_by` must be either `user1_id` or `user2_id`
- `status` must be one of: 'pending', 'active', 'dissolved'

---

### User (Existing - No Changes)

Represents a Telegram user.

**Table**: `users`

**Fields** (relevant subset):
- `id` (INTEGER, PRIMARY KEY) - Telegram user ID
- `telegram_username` (TEXT, NULLABLE) - Telegram @username
- `first_name` (TEXT, NOT NULL) - User's first name
- `ton_wallet_address` (TEXT, NULLABLE) - Connected TON wallet
- `created_at` (TEXT, NOT NULL, DEFAULT CURRENT_TIMESTAMP)

**Used For**:
- Identifying the initiator and recipient of buddy requests
- Displaying user information in notifications and UI
- Validation that users exist before processing accept/reject

---

## State Transitions

### Accept Flow

**Initial State**: `BuddyPair.status = 'pending'`

**Action**: Recipient accepts the buddy request

**Validation Rules**:
1. ✅ BuddyPair must exist (`id` valid)
2. ✅ Current user must be in the relationship (`user1_id` OR `user2_id` = current user)
3. ✅ Current user must NOT be the initiator (`initiated_by` ≠ current user)
4. ✅ Status must be 'pending' (cannot accept already active or dissolved relationships)

**State Changes**:
- `status`: 'pending' → 'active'
- `confirmed_at`: NULL → current ISO timestamp

**Side Effects**:
- Notification sent to initiator via NotificationService.notifyBuddyConfirmed()
- UI refreshes to show active buddy status

**SQL Operation** (via prepared statement):
```sql
UPDATE buddy_pairs
SET status = 'active', confirmed_at = ?
WHERE id = ?
RETURNING *
```

---

### Reject Flow

**Initial State**: `BuddyPair.status = 'pending'`

**Action**: Recipient rejects the buddy request

**Validation Rules**:
1. ✅ BuddyPair must exist (`id` valid)
2. ✅ Current user must be in the relationship (`user1_id` OR `user2_id` = current user)
3. ✅ Current user must NOT be the initiator (`initiated_by` ≠ current user)
4. ✅ Status must be 'pending' (cannot reject already active or dissolved relationships)

**State Changes**:
- `status`: 'pending' → 'dissolved'
- `confirmed_at`: remains NULL (rejection is not confirmation)

**Side Effects**:
- Notification sent to initiator via NotificationService.notifyBuddyRejected()
- UI refreshes to show "No Buddy Yet" state

**SQL Operation** (via prepared statement):
```sql
UPDATE buddy_pairs
SET status = 'dissolved'
WHERE id = ?
RETURNING *
```

---

## Error Cases & Validation

### Validation Error Scenarios

| Scenario | Validation Rule | Error Type | HTTP Status | User Message |
|----------|----------------|------------|-------------|--------------|
| Buddy pair doesn't exist | `id` not found in database | `BuddyNotFoundError` | 404 | "Buddy request not found" |
| User not in relationship | `user1_id` ≠ userId AND `user2_id` ≠ userId | `BuddyValidationError` | 400 | "You are not part of this buddy request" |
| Initiator trying to accept/reject own request | `initiated_by` = userId | `BuddyConflictError` | 400 | "Cannot accept/reject your own request" |
| Status not pending | `status` ≠ 'pending' | `BuddyConflictError` | 400 | "This request has already been processed" |
| User account deleted | Foreign key reference invalid | `UserNotFoundError` | 404 | "User not found" |
| Concurrent modification | Status changed between read and write | `BuddyConflictError` | 409 | "Request was already processed" |

---

## Data Access Patterns

### Service Layer Methods

#### Accept Request (Existing: `confirmBuddyRequest`)
```typescript
async confirmBuddyRequest(
  buddyPairId: number,
  confirmingUserId: number
): Promise<BuddyPairWithProfile>
```

**Used By**: `/api/buddy/accept` endpoint

**Returns**: Updated BuddyPair with buddy's UserProfile

---

#### Reject Request (New: `rejectBuddyRequest`)
```typescript
async rejectBuddyRequest(
  buddyPairId: number,
  rejectingUserId: number
): Promise<BuddyPairWithProfile>
```

**Used By**: `/api/buddy/reject` endpoint

**Returns**: Updated BuddyPair with buddy's UserProfile (status = 'dissolved')

**Implementation Pattern**: Follows same structure as `confirmBuddyRequest` but sets status to 'dissolved' instead of 'active'

---

### Database Queries

All queries use prepared statements for performance and security.

#### Read Operations
- `getBuddyPairById(id)` - Fetch single buddy pair for validation
- `getUserActiveBuddy(userId)` - Check for active relationships
- `getUserPendingBuddy(userId)` - Check for pending relationships

#### Write Operations
- `updateBuddyPairStatus(status, confirmed_at, id)` - Accept operation (sets 'active' + timestamp)
- `updateBuddyPairStatus(status, NULL, id)` - Reject operation (sets 'dissolved')

---

## TypeScript Types (Existing - No Changes)

### BuddyPairStatus (Enum)
```typescript
enum BuddyPairStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  DISSOLVED = 'dissolved'
}
```

### BuddyPairWithProfile (Interface)
```typescript
interface BuddyPairWithProfile {
  id: number;
  buddy: UserProfile;
  status: BuddyPairStatus;
  createdAt: string;        // ISO 8601 format
  confirmedAt: string | null;
  initiatedBy?: number;
}
```

### BuddyStatusResult (Interface)
```typescript
interface BuddyStatusResult {
  status: 'no_buddy' | BuddyPairStatus;
  message?: string;
  id?: number;
  buddy?: UserProfile;
  createdAt?: string;
  confirmedAt?: string | null;
  initiatedBy?: number;
}
```

Used by UI to determine which buttons to show (recipient vs initiator).

---

## Indexing & Performance

### Existing Indexes (Sufficient)

Current indexes support efficient queries:

1. **Primary Key on `id`**
   - Used by: `getBuddyPairById(id)` for accept/reject validation
   - Performance: O(log n) lookup

2. **Unique Index on `(user1_id, user2_id)`**
   - Prevents duplicate relationships
   - Enforces data integrity

3. **Index on `(user1_id, status)`** and **`(user2_id, status)`**
   - Used by: `getUserPendingBuddy(userId)` to find pending requests
   - Performance: O(log n) with status filter

**Conclusion**: No additional indexes needed. Current schema optimized for accept/reject operations.

---

## Transaction Guarantees

All state-modifying operations use `withTransaction()` wrapper to ensure:

1. **Atomicity**: Status update and timestamp change happen together or not at all
2. **Consistency**: Validation re-run inside transaction to catch concurrent changes
3. **Isolation**: Other transactions see either old or new state, never partial
4. **Durability**: Changes persisted to disk before transaction commits

**Race Condition Protection**:
```typescript
withTransaction(() => {
  // Re-fetch buddy pair to get latest state
  const buddyPair = getBuddyPairById(id);

  // Validate status is still 'pending'
  if (buddyPair.status !== 'pending') {
    throw new BuddyConflictError('Already processed');
  }

  // Perform update
  updateBuddyPairStatus('active', timestamp, id);
});
```

---

## Schema Summary

**Tables Modified**: None (all existing)

**Tables Read**:
- `buddy_pairs` - status checks and updates
- `users` - fetch user profiles for notifications and UI

**Tables Created**: None

**Migrations Required**: None

**Backward Compatibility**: ✅ Fully compatible - uses existing schema

---

## Data Integrity Constraints

### Application-Level (Enforced by BuddyService)
- User ID normalization (lower ID always in user1_id)
- Initiator must be one of the two users in the pair
- Single pending/active buddy per user at a time

### Database-Level (Enforced by SQLite)
- Foreign key constraints ensure users exist
- Unique constraint prevents duplicate relationships
- NOT NULL constraints prevent invalid states

### API-Level (Enforced by route handlers)
- Telegram initData validation
- Request body schema validation
- Authorization checks (user in session matches action performer)

---

## Summary

This feature leverages the existing data model without any schema changes:

- ✅ **No migrations** - uses existing `buddy_pairs` table
- ✅ **No new tables** - reuses User and BuddyPair entities
- ✅ **No new fields** - `status` and `confirmed_at` already support needed states
- ✅ **Efficient queries** - existing indexes support all required lookups
- ✅ **Transaction safety** - existing `withTransaction()` wrapper prevents race conditions

**Next Step**: See `contracts/` directory for API specifications.
