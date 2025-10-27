# Data Model: Mobile-First Onboarding Flow

**Feature**: 005-mobile-first-onboarding
**Date**: 2025-10-26

## Overview

This document defines the data entities and relationships for the mobile-first onboarding flow. The feature primarily uses existing database entities (`users`, `buddy_pairs`) with derived state rather than introducing new tables.

## Core Principle: Derived State

**Important**: Onboarding state is NOT stored in the database. It is computed from existing data:
- Wallet connection status → derived from `users.ton_wallet_address`
- Buddy confirmation status → derived from `buddy_pairs` table query
- Current onboarding step → computed based on the above two states

## Entities

### 1. User (Existing - No Schema Changes)

**Table**: `users`

**Description**: Represents a Telegram user registered in the app. Onboarding uses existing fields without modifications.

**Schema**:
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,                    -- Telegram user ID
  telegram_username TEXT,                    -- @username (nullable)
  first_name TEXT NOT NULL,                  -- First name from Telegram
  ton_wallet_address TEXT UNIQUE,            -- TON wallet address (nullable, UNIQUE enforced)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Ensure wallet uniqueness for automatic unlinking (FR-020)
CREATE UNIQUE INDEX idx_users_ton_wallet_unique
  ON users(ton_wallet_address)
  WHERE ton_wallet_address IS NOT NULL;
```

**Onboarding Relevance**:
- `ton_wallet_address IS NOT NULL` → Wallet connected (onboarding step 1 complete)
- UNIQUE constraint enforces automatic wallet unlinking when reconnecting to new account

**State Derivation**:
```typescript
const isWalletConnected = (user: User) => !!user.ton_wallet_address;
```

---

### 2. BuddyPair (Existing - No Schema Changes)

**Table**: `buddy_pairs`

**Description**: Represents buddy relationship requests and confirmations. Onboarding uses existing table without modifications.

**Schema** (Existing):
```sql
CREATE TABLE buddy_pairs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user1_id INTEGER NOT NULL,                 -- First user in pair
  user2_id INTEGER NOT NULL,                 -- Second user in pair
  status TEXT NOT NULL CHECK(status IN ('pending', 'confirmed', 'rejected')),
  initiated_by INTEGER NOT NULL,             -- User who initiated request
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  confirmed_at DATETIME,                     -- Confirmation timestamp (nullable)
  FOREIGN KEY (user1_id) REFERENCES users(id),
  FOREIGN KEY (user2_id) REFERENCES users(id),
  UNIQUE(user1_id, user2_id)                 -- Prevent duplicate pairs
);
```

**Onboarding Relevance**:
- `status = 'confirmed'` → Buddy confirmed (onboarding step 2 complete)
- `status = 'pending'` → Request sent, show pending UI
- No record → No buddy, show search UI

**State Derivation**:
```typescript
const getBuddyStatus = (userId: number): 'no_buddy' | 'pending' | 'confirmed' | 'rejected' => {
  const pair = db.prepare(`
    SELECT status FROM buddy_pairs
    WHERE (user1_id = ? OR user2_id = ?)
    ORDER BY created_at DESC LIMIT 1
  `).get(userId);

  return pair ? pair.status : 'no_buddy';
};
```

**Cancellation Support** (FR-006):
```sql
-- Cancel pending request = DELETE row
DELETE FROM buddy_pairs
WHERE id = ? AND status = 'pending';
```

---

## Computed Entities (Not Stored)

### 3. OnboardingState (Computed)

**Description**: Derived state representing user's current position in onboarding flow

**TypeScript Interface**:
```typescript
interface OnboardingState {
  wallet_connected: boolean;
  buddy_confirmed: boolean;
  current_step: 'welcome' | 'buddy' | 'complete';
}
```

**Derivation Logic**:
```typescript
function deriveOnboardingState(
  user: User,
  buddyStatus: BuddyStatusResult
): OnboardingState {
  const walletConnected = !!user.ton_wallet_address;
  const buddyConfirmed = buddyStatus.status === 'confirmed';

  let currentStep: 'welcome' | 'buddy' | 'complete';

  if (!walletConnected) {
    currentStep = 'welcome';
  } else if (!buddyConfirmed) {
    currentStep = 'buddy';
  } else {
    currentStep = 'complete';
  }

  return {
    wallet_connected: walletConnected,
    buddy_confirmed: buddyConfirmed,
    current_step: currentStep,
  };
}
```

**Usage**: Returned by `/api/onboarding/status` endpoint for client-side routing

---

### 4. OnboardingStatusResponse (API Response)

**Description**: Complete onboarding status returned to client

**TypeScript Interface**:
```typescript
interface OnboardingStatusResponse {
  success: true;
  onboarding: OnboardingState;
  wallet?: {
    address: string | null;
  };
  buddy?: {
    id: number;
    status: BuddyPairStatus;
    profile: UserProfile;
    createdAt: string;
    confirmedAt: string | null;
  };
}
```

**Example Responses**:

**Step 1: Welcome (no wallet)**
```json
{
  "success": true,
  "onboarding": {
    "wallet_connected": false,
    "buddy_confirmed": false,
    "current_step": "welcome"
  }
}
```

**Step 2: Add Buddy (wallet connected, no buddy)**
```json
{
  "success": true,
  "onboarding": {
    "wallet_connected": true,
    "buddy_confirmed": false,
    "current_step": "buddy"
  },
  "wallet": {
    "address": "EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2"
  }
}
```

**Step 3: Complete (wallet + buddy confirmed)**
```json
{
  "success": true,
  "onboarding": {
    "wallet_connected": true,
    "buddy_confirmed": true,
    "current_step": "complete"
  },
  "wallet": {
    "address": "EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2"
  },
  "buddy": {
    "id": 123,
    "status": "confirmed",
    "profile": {
      "id": 456,
      "displayName": "Alice",
      "username": "alice_corgi",
      "hasWallet": true,
      "memberSince": "2025-10-01T10:00:00Z"
    },
    "createdAt": "2025-10-20T14:30:00Z",
    "confirmedAt": "2025-10-20T15:00:00Z"
  }
}
```

---

## State Transitions

### Onboarding Flow State Machine

```
┌─────────┐
│ Welcome │ (no wallet)
│  Step   │
└────┬────┘
     │ Connect Wallet
     │ POST /api/wallet/connect
     ▼
┌──────────┐
│ Add Buddy│ (wallet connected, no buddy)
│   Step   │
└────┬─────┘
     │ Send Buddy Request
     │ POST /api/buddy/request
     ▼
┌──────────────┐
│Pending State │ (wallet connected, buddy pending)
│  [Same UI]   │
└────┬─────────┘
     │ Buddy Accepts Request (server-side event)
     ▼
┌──────────┐
│ Complete │ (wallet connected, buddy confirmed)
│Main App  │
└──────────┘
```

### Buddy Request State Transitions

```
no_buddy ──[POST /api/buddy/request]──> pending
                                           │
                                           ├──[DELETE /api/buddy/cancel]──> no_buddy
                                           │
                                           ├──[Buddy accepts]──> confirmed
                                           │
                                           └──[Buddy rejects]──> rejected ──> no_buddy (show search again)
```

### Wallet Connection State Transitions

```
no_wallet ──[POST /api/wallet/connect]──> wallet_connected
                                              │
                                              └──[POST /api/wallet/disconnect]──> no_wallet
```

---

## Validation Rules

### Wallet Connection Validation

```typescript
interface WalletConnectionValidation {
  // Wallet address format validation
  isValidTonAddress: (address: string) => boolean; // Regex: /^(EQ|UQ|kQ|0Q)[A-Za-z0-9_-]{46}$/

  // Wallet uniqueness (enforced by database UNIQUE constraint)
  // If wallet already exists:
  //   1. UPDATE previous user SET ton_wallet_address = NULL
  //   2. UPDATE new user SET ton_wallet_address = <wallet>
  //   3. No notification sent (FR-020)
}
```

### Buddy Request Validation

```typescript
interface BuddyRequestValidation {
  // Cannot send request to self
  isSelfRequest: (requesterId: number, recipientId: number) => boolean; // requesterId === recipientId

  // Cannot send request if already have confirmed buddy
  hasConfirmedBuddy: (userId: number) => boolean;

  // Cannot send duplicate request
  hasPendingRequest: (requesterId: number, recipientId: number) => boolean;

  // Recipient must exist and have wallet connected
  isValidRecipient: (recipientId: number) => boolean;
}
```

### Onboarding State Validation (Re-validation on App Open)

```typescript
interface OnboardingRevalidation {
  // FR-014: Re-validate on every app open
  // FR-015: Distinguish network errors from validation failures
  // FR-016: Show error screen with retry for network errors

  validateOnAppOpen: async (userId: number) => {
    try {
      const user = await fetchUser(userId);
      const buddyStatus = await getBuddyStatus(userId);

      return deriveOnboardingState(user, buddyStatus);
    } catch (error) {
      if (isNetworkError(error)) {
        // Show error screen with retry button
        throw new NetworkError('Cannot connect to server. Please retry.');
      } else {
        // Validation failure - redirect to appropriate onboarding step
        // e.g., wallet disconnected → redirect to /onboarding/welcome
        return deriveOnboardingState(/* updated state */);
      }
    }
  };
}
```

---

## Database Indexes (Existing)

**Performance Optimization**: The following indexes should exist (verify in migration):

```sql
-- User lookup by ID (primary key - auto-indexed)
-- Already exists: PRIMARY KEY on users(id)

-- Wallet lookup for uniqueness check
CREATE UNIQUE INDEX idx_users_ton_wallet_unique
  ON users(ton_wallet_address)
  WHERE ton_wallet_address IS NOT NULL;

-- Buddy pair lookup by user ID
CREATE INDEX idx_buddy_pairs_user1 ON buddy_pairs(user1_id);
CREATE INDEX idx_buddy_pairs_user2 ON buddy_pairs(user2_id);

-- Buddy pair status filtering
CREATE INDEX idx_buddy_pairs_status ON buddy_pairs(status);
```

---

## Migration Checklist

### Required Migrations
- [ ] Verify `users.ton_wallet_address` has UNIQUE constraint with WHERE clause
- [ ] Verify `buddy_pairs` indexes exist for user1_id, user2_id, status
- [ ] No new tables required

### Data Migration
- [ ] No data migration required (state is derived)

---

## API Data Flow

### Example: First-Time User Onboarding

```
1. User opens app
   ├─> GET /api/onboarding/status
   └─> Response: { current_step: 'welcome', wallet_connected: false, buddy_confirmed: false }

2. User connects wallet (via TON Connect UI)
   ├─> POST /api/wallet/connect { address: "EQ..." }
   │   ├─> UPDATE users SET ton_wallet_address = "EQ..." WHERE id = ?
   │   └─> Response: { success: true, address: "EQ..." }
   └─> Client redirects to /onboarding/buddy

3. User searches for buddy
   ├─> GET /api/buddy/search?query=alice
   └─> Response: { users: [{ id: 456, displayName: "Alice", ... }] }

4. User sends buddy request
   ├─> POST /api/buddy/request { recipientId: 456 }
   │   ├─> INSERT INTO buddy_pairs (user1_id, user2_id, status, initiated_by) VALUES (?, ?, 'pending', ?)
   │   └─> Response: { success: true, status: 'pending' }
   └─> Client shows pending request UI

5. Buddy accepts request (on their device)
   ├─> POST /api/buddy/accept { requestId: 123 }
   │   └─> UPDATE buddy_pairs SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP WHERE id = 123
   └─> User polls /api/onboarding/status (or receives push notification)

6. User's app detects buddy confirmation
   ├─> GET /api/onboarding/status
   │   └─> Response: { current_step: 'complete', wallet_connected: true, buddy_confirmed: true, buddy: {...} }
   └─> Client redirects to main app (shows bottom navigation)
```

---

## References

- Feature Specification: [spec.md](./spec.md)
- Research Document: [research.md](./research.md)
- User Model: [src/models/User.ts](../../../src/models/User.ts)
- BuddyPair Model: [src/models/BuddyPair.ts](../../../src/models/BuddyPair.ts)
