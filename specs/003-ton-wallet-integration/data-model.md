# Data Model: TON Wallet Integration

**Feature**: 003-ton-wallet-integration
**Date**: 2025-10-13
**Status**: Complete

## Overview

This document defines the data structures for TON wallet integration. The feature leverages the existing `users` table schema with the `ton_wallet_address` column, requiring no database migrations.

## Database Schema

### Users Table (Existing)

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY,                          -- Telegram user ID
    telegram_username TEXT UNIQUE,                   -- @username (nullable)
    first_name TEXT NOT NULL,                        -- User's first name
    ton_wallet_address TEXT,                         -- Connected TON wallet address (nullable)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,   -- Registration timestamp
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP    -- Last activity timestamp
);

CREATE TRIGGER update_users_timestamp
    AFTER UPDATE ON users
    BEGIN
        UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
```

**Schema Notes**:
- `ton_wallet_address` is nullable (users start without wallets)
- Address stored in user-friendly format (e.g., `EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2`)
- No additional wallet metadata stored (TON Connect manages session details)
- Single wallet per user enforced by data model (no separate wallet table needed)
- `updated_at` trigger automatically updates timestamp on wallet changes

**No Schema Changes Required**: The existing table structure fully supports this feature.

---

## Core Entities

### User Entity (Existing)

Defined in `src/models/User.ts`:

```typescript
export interface User {
  id: number;                        // Telegram user ID (PRIMARY KEY)
  telegram_username: string | null;  // @username
  first_name: string;                // User's first name
  ton_wallet_address: string | null; // Connected TON wallet address
  created_at: Date;                  // Registration timestamp
  updated_at: Date;                  // Last activity timestamp
}
```

**State Transitions**:
```
REGISTERED (ton_wallet_address = null)
    ↓ [User connects wallet]
WALLET_CONNECTED (ton_wallet_address != null)
    ↓ [User disconnects wallet]
REGISTERED (ton_wallet_address = null)
```

**Validation Rules**:
- `id`: Must be positive integer (Telegram user ID)
- `first_name`: 1-64 characters, required
- `ton_wallet_address`: Valid TON address format or null
  - Raw format: 64 hex characters
  - User-friendly format: Base64 with checksum (e.g., `EQ...`)
  - Validated by TON Connect SDK before persistence

---

## API Request/Response Models

### 1. Connect Wallet Endpoint

**Endpoint**: `POST /api/wallet/connect`

**Request Body**:
```typescript
interface ConnectWalletRequest {
  walletAddress: string;      // User-friendly TON address from TON Connect
  initData: string;           // Telegram initData for auth validation
}
```

**Success Response** (200 OK):
```typescript
interface ConnectWalletResponse {
  success: true;
  user: {
    id: number;
    ton_wallet_address: string;
    updated_at: string;       // ISO 8601 timestamp
  };
}
```

**Error Response** (400 Bad Request):
```typescript
interface ConnectWalletError {
  success: false;
  error: string;              // Human-readable error message
  code: string;               // Error code (e.g., "INVALID_ADDRESS", "AUTH_FAILED")
}
```

**Validation Rules**:
- `walletAddress` must pass `validateTonAddress()` check
- `initData` must pass HMAC signature verification
- Address must not be empty string
- User must be authenticated via Telegram

---

### 2. Disconnect Wallet Endpoint

**Endpoint**: `POST /api/wallet/disconnect`

**Request Body**:
```typescript
interface DisconnectWalletRequest {
  initData: string;           // Telegram initData for auth validation
}
```

**Success Response** (200 OK):
```typescript
interface DisconnectWalletResponse {
  success: true;
  user: {
    id: number;
    ton_wallet_address: null;
    updated_at: string;       // ISO 8601 timestamp
  };
}
```

**Error Response** (400 Bad Request):
```typescript
interface DisconnectWalletError {
  success: false;
  error: string;              // Human-readable error message
  code: string;               // Error code (e.g., "AUTH_FAILED", "NO_WALLET")
}
```

**Validation Rules**:
- `initData` must pass HMAC signature verification
- User must be authenticated via Telegram
- No validation on wallet address (cleared regardless)

---

### 3. Wallet Status Endpoint

**Endpoint**: `GET /api/wallet/status`

**Query Parameters**:
```typescript
interface WalletStatusQuery {
  initData: string;           // Telegram initData for auth validation
}
```

**Success Response** (200 OK):
```typescript
interface WalletStatusResponse {
  success: true;
  connected: boolean;         // Whether wallet is connected
  address: string | null;     // User-friendly address or null
  user: {
    id: number;
    first_name: string;
    updated_at: string;       // ISO 8601 timestamp
  };
}
```

**Error Response** (401 Unauthorized):
```typescript
interface WalletStatusError {
  success: false;
  error: string;              // Human-readable error message
  code: string;               // Error code (e.g., "AUTH_FAILED")
}
```

**Validation Rules**:
- `initData` must pass HMAC signature verification
- User must exist in database
- No side effects (read-only operation)

---

## Client-Side State Management

### TON Connect Context (Existing)

Defined in `src/components/wallet/TonProvider.tsx`:

```typescript
interface TonWalletState {
  isConnected: boolean;         // Wallet connection status
  address: string | null;       // Raw TON address
  friendlyAddress: string | null; // User-friendly address
  isConnecting: boolean;        // Loading state during connection
  connectionError: string | null; // Error message from TON Connect
  connectWallet: () => Promise<void>;        // Initiate wallet connection
  disconnectWallet: () => Promise<void>;     // Disconnect wallet
  sendTransaction: (tx: {...}) => Promise<string>; // Send TON transaction
}
```

**State Synchronization Flow**:
1. **User clicks "Connect Wallet"**:
   - `TonProvider.connectWallet()` → TON Connect modal opens
   - User selects wallet app → approves connection
   - TON Connect SDK updates `wallet` state
   - Client calls `POST /api/wallet/connect` with address
   - Server persists address to database

2. **App reload**:
   - TON Connect SDK restores session from localStorage
   - `TonProvider` detects wallet state automatically
   - Client calls `GET /api/wallet/status` to verify server-side state
   - UI displays consistent wallet status

3. **User clicks "Disconnect Wallet"**:
   - `TonProvider.disconnectWallet()` → TON Connect session ends
   - Client calls `POST /api/wallet/disconnect`
   - Server clears address from database
   - UI updates to show disconnected state

---

## Data Flow Diagrams

### Connect Wallet Flow

```
User → [Connect Button] → TonProvider.connectWallet()
                              ↓
                         TON Connect Modal
                              ↓
                         Wallet App (Tonkeeper, MyTonWallet)
                              ↓
                         User Approves
                              ↓
                         TON Connect SDK updates state
                         (wallet, address available)
                              ↓
                         POST /api/wallet/connect
                         { walletAddress, initData }
                              ↓
                         Auth Middleware validates initData
                              ↓
                         Validate wallet address format
                              ↓
                         UPDATE users SET ton_wallet_address = ?
                              ↓
                         Return { success: true, user: {...} }
                              ↓
                         UI shows "Connected" with address
```

### Disconnect Wallet Flow

```
User → [Disconnect Button] → TonProvider.disconnectWallet()
                                  ↓
                             POST /api/wallet/disconnect
                             { initData }
                                  ↓
                             Auth Middleware validates initData
                                  ↓
                             UPDATE users SET ton_wallet_address = NULL
                                  ↓
                             TON Connect SDK clears session
                                  ↓
                             Return { success: true, user: {...} }
                                  ↓
                             UI shows "Not Connected"
```

---

## Validation Rules Summary

| Field | Rules | Enforced By |
|-------|-------|-------------|
| `walletAddress` | Valid TON address format (raw or user-friendly) | Server: `validateTonAddress()` |
| `initData` | Valid HMAC signature with bot token | Server: auth middleware |
| `ton_wallet_address` | Nullable, TEXT type in SQLite | Database schema |
| User authentication | Must have valid Telegram session | Auth middleware |
| Single wallet | One wallet per user | Data model (column, not separate table) |

---

## Edge Cases & Constraints

### Multiple Connection Attempts
- **Scenario**: User connects wallet A, then connects wallet B without disconnecting
- **Behavior**: Wallet B replaces wallet A (UPDATE operation)
- **Database**: `ton_wallet_address` column overwritten
- **No History**: Previous wallet addresses are not retained

### Concurrent Disconnection
- **Scenario**: User clicks disconnect multiple times rapidly
- **Behavior**: Idempotent operation - all requests succeed
- **Database**: Setting `ton_wallet_address = NULL` multiple times is safe
- **Response**: All requests return success

### Session Mismatch
- **Scenario**: TON Connect session exists client-side, but no address in database
- **Behavior**: Client detects mismatch, prompts user to reconnect
- **Recovery**: User can disconnect (clears client) and reconnect (syncs database)

### Wallet Address Format
- **Scenario**: TON Connect provides raw address, but database stores user-friendly
- **Behavior**: Server normalizes address using `normalizeTonAddress()` utility
- **Database**: Always stores user-friendly format for consistency
- **Display**: UI uses same format from database

---

## Security Considerations

### Server-Side Validation
- **All wallet operations require Telegram initData validation**
- HMAC signature verified against bot token
- Prevents unauthorized wallet address changes
- Enforced by `src/middleware/auth.ts`

### No Private Keys
- **Zero private key storage** - TON Connect handles all cryptography
- Server never receives or processes private keys
- Wallet addresses are public information, safe to store

### Address Tampering
- **Client-provided addresses validated**
- Format check ensures well-formed addresses
- TON Connect SDK guarantees addresses correspond to actual wallets
- No additional on-chain verification needed

---

## Migration Status

**No migrations required** - existing schema supports feature.

Verification:
```bash
sqlite3 ./data/app.db "PRAGMA table_info(users);"
# Confirms ton_wallet_address column exists
```

---

## References

- User Model: `src/models/User.ts`
- TON Utilities: `src/lib/ton.ts`
- Auth Middleware: `src/middleware/auth.ts`
- TonProvider: `src/components/wallet/TonProvider.tsx`
- Database Schema: `scripts/migrate.ts`
