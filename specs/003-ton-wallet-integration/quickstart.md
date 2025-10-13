# Quickstart: TON Wallet Integration

**Feature**: 003-ton-wallet-integration
**Date**: 2025-10-13

This guide provides step-by-step instructions for implementing and testing TON wallet integration.

## Prerequisites

Before starting, ensure you have:
- [x] Node.js 20+ and pnpm installed
- [x] Project dependencies installed (`pnpm install`)
- [x] Database initialized (`pnpm run db:migrate`)
- [x] TON Connect dependencies already present (check `package.json`)
- [x] Basic understanding of Next.js App Router
- [x] Telegram Bot created via @BotFather (for testing)

## Quick Overview

This feature adds three main components:
1. **API Endpoints** (`/api/wallet/*`) - Server-side wallet address persistence
2. **UI Components** (`src/components/wallet/*`) - Wallet management interface
3. **Wallet Page** (`/wallet`) - Dedicated wallet settings page

**What already exists**:
- ✅ TON Connect SDK integration (`TonProvider`)
- ✅ Database schema (`users.ton_wallet_address`)
- ✅ TON utilities (`src/lib/ton.ts`)
- ✅ Auth middleware (`src/middleware/auth.ts`)

**What needs to be implemented**:
- [ ] API endpoint: `POST /api/wallet/connect`
- [ ] API endpoint: `POST /api/wallet/disconnect`
- [ ] API endpoint: `GET /api/wallet/status`
- [ ] Wallet settings page: `/wallet`
- [ ] UI components: `WalletSettings`, `WalletCard`
- [ ] Integration tests for all endpoints
- [ ] TON Connect manifest file

---

## Step 1: Create TON Connect Manifest

**File**: `public/tonconnect-manifest.json`

```json
{
  "url": "https://127.0.0.1:3000",
  "name": "Tongi (Corgi Buddy)",
  "iconUrl": "https://127.0.0.1:3000/icon.png",
  "termsOfUseUrl": "https://127.0.0.1:3000/terms",
  "privacyPolicyUrl": "https://127.0.0.1:3000/privacy"
}
```

**Why**: TON Connect wallets require this manifest to display app information during connection.

**Testing**:
```bash
pnpm run dev:https
curl -k https://127.0.0.1:3000/tonconnect-manifest.json
# Should return the JSON manifest
```

---

## Step 2: Implement API Endpoints

### 2.1 Connect Wallet Endpoint

**File**: `src/app/api/wallet/connect/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { validateTelegramAuth } from '@/middleware/auth';
import { validateTonAddress, normalizeTonAddress } from '@/lib/ton';
import { db } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { walletAddress, initData } = body;

    // Validate Telegram authentication
    const user = await validateTelegramAuth(initData);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication failed', code: 'AUTH_FAILED' },
        { status: 401 }
      );
    }

    // Validate wallet address
    if (!walletAddress || !validateTonAddress(walletAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid wallet address', code: 'INVALID_ADDRESS' },
        { status: 400 }
      );
    }

    // Normalize address to user-friendly format
    const normalizedAddress = normalizeTonAddress(walletAddress);

    // Update database
    const stmt = db.prepare('UPDATE users SET ton_wallet_address = ? WHERE id = ?');
    stmt.run(normalizedAddress, user.id);

    // Fetch updated user
    const updatedUser = db.prepare('SELECT id, ton_wallet_address, updated_at FROM users WHERE id = ?').get(user.id);

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    console.error('Wallet connect error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to connect wallet', code: 'DATABASE_ERROR' },
      { status: 500 }
    );
  }
}
```

### 2.2 Disconnect Wallet Endpoint

**File**: `src/app/api/wallet/disconnect/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { validateTelegramAuth } from '@/middleware/auth';
import { db } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { initData } = body;

    // Validate Telegram authentication
    const user = await validateTelegramAuth(initData);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication failed', code: 'AUTH_FAILED' },
        { status: 401 }
      );
    }

    // Clear wallet address (idempotent)
    const stmt = db.prepare('UPDATE users SET ton_wallet_address = NULL WHERE id = ?');
    stmt.run(user.id);

    // Fetch updated user
    const updatedUser = db.prepare('SELECT id, ton_wallet_address, updated_at FROM users WHERE id = ?').get(user.id);

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    console.error('Wallet disconnect error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to disconnect wallet', code: 'DATABASE_ERROR' },
      { status: 500 }
    );
  }
}
```

### 2.3 Wallet Status Endpoint

**File**: `src/app/api/wallet/status/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { validateTelegramAuth } from '@/middleware/auth';
import { db } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    // Get initData from query params
    const initData = request.nextUrl.searchParams.get('initData');

    if (!initData) {
      return NextResponse.json(
        { success: false, error: 'Missing initData', code: 'INVALID_INITDATA' },
        { status: 401 }
      );
    }

    // Validate Telegram authentication
    const user = await validateTelegramAuth(initData);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication failed', code: 'AUTH_FAILED' },
        { status: 401 }
      );
    }

    // Fetch user from database
    const dbUser = db.prepare(
      'SELECT id, first_name, ton_wallet_address, updated_at FROM users WHERE id = ?'
    ).get(user.id);

    if (!dbUser) {
      return NextResponse.json(
        { success: false, error: 'User not found', code: 'USER_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      connected: !!dbUser.ton_wallet_address,
      address: dbUser.ton_wallet_address,
      user: {
        id: dbUser.id,
        first_name: dbUser.first_name,
        updated_at: dbUser.updated_at,
      },
    });
  } catch (error) {
    console.error('Wallet status error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve status', code: 'DATABASE_ERROR' },
      { status: 500 }
    );
  }
}
```

---

## Step 3: Create UI Components

### 3.1 Wallet Settings Component

**File**: `src/components/wallet/WalletSettings.tsx`

```typescript
'use client';

import { Section, Placeholder, Button, Cell } from '@telegram-apps/telegram-ui';
import { useTonWalletContext } from './TonProvider';
import { useState } from 'react';

export function WalletSettings() {
  const { isConnected, friendlyAddress, isConnecting, connectWallet, disconnectWallet, connectionError } = useTonWalletContext();
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const handleConnect = async () => {
    await connectWallet();
    // Call API to persist address
    // TODO: Implement API call
  };

  const handleDisconnect = async () => {
    setShowDisconnectConfirm(true);
  };

  const confirmDisconnect = async () => {
    await disconnectWallet();
    setShowDisconnectConfirm(false);
    // Call API to clear address
    // TODO: Implement API call
  };

  if (connectionError) {
    return (
      <Section header="Wallet Connection">
        <Placeholder header="Connection Error" description={connectionError}>
          <Button size="m" onClick={handleConnect}>
            Try Again
          </Button>
        </Placeholder>
      </Section>
    );
  }

  if (!isConnected) {
    return (
      <Section header="TON Wallet">
        <Placeholder
          header="No Wallet Connected"
          description="Connect your TON wallet to receive Corgi coin rewards"
        >
          <Button size="m" onClick={handleConnect} disabled={isConnecting}>
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </Button>
        </Placeholder>
      </Section>
    );
  }

  if (showDisconnectConfirm) {
    return (
      <Section header="Confirm Disconnection">
        <Placeholder
          header="Disconnect Wallet?"
          description="Your wallet will be removed from your account. You can reconnect anytime."
        >
          <Button size="m" mode="destructive" onClick={confirmDisconnect}>
            Yes, Disconnect
          </Button>
          <Button size="m" mode="plain" onClick={() => setShowDisconnectConfirm(false)}>
            Cancel
          </Button>
        </Placeholder>
      </Section>
    );
  }

  return (
    <Section header="TON Wallet">
      <Cell
        subtitle={friendlyAddress ? `${friendlyAddress.slice(0, 8)}...${friendlyAddress.slice(-8)}` : 'Loading...'}
        after={
          <Button size="s" mode="plain" onClick={handleDisconnect}>
            Disconnect
          </Button>
        }
      >
        Connected
      </Cell>
    </Section>
  );
}
```

### 3.2 Wallet Page

**File**: `src/app/wallet/page.tsx`

```typescript
import { WalletSettings } from '@/components/wallet/WalletSettings';

export default function WalletPage() {
  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">Wallet Settings</h1>
      <WalletSettings />
    </main>
  );
}
```

---

## Step 4: Write Integration Tests

### 4.1 Wallet Connection Test

**File**: `tests/integration/wallet/wallet-connection.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { db } from '@/lib/database';

describe('POST /api/wallet/connect', () => {
  const testUserId = 999999;
  const testWalletAddress = 'EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2';

  beforeEach(() => {
    // Create test user
    db.prepare('INSERT INTO users (id, first_name) VALUES (?, ?)').run(testUserId, 'TestUser');
  });

  afterEach(() => {
    // Clean up test user
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
  });

  it('should connect wallet successfully', async () => {
    const response = await fetch('http://localhost:3000/api/wallet/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: testWalletAddress,
        initData: generateMockInitData(testUserId),
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.user.ton_wallet_address).toBe(testWalletAddress);

    // Verify database
    const user = db.prepare('SELECT ton_wallet_address FROM users WHERE id = ?').get(testUserId);
    expect(user.ton_wallet_address).toBe(testWalletAddress);
  });

  it('should reject invalid wallet address', async () => {
    const response = await fetch('http://localhost:3000/api/wallet/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: 'invalid-address',
        initData: generateMockInitData(testUserId),
      }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.code).toBe('INVALID_ADDRESS');
  });
});

function generateMockInitData(userId: number): string {
  // TODO: Implement mock initData generation with valid HMAC
  return 'mock-init-data';
}
```

---

## Step 5: Testing Guide

### Local Development Testing

1. **Start HTTPS dev server**:
   ```bash
   pnpm run dev:https
   ```

2. **Accept certificate warning**:
   - Open `https://127.0.0.1:3000` in browser
   - Accept the self-signed certificate warning

3. **Configure Telegram Bot**:
   - Go to @BotFather
   - Send `/setmenubutton`
   - Set URL to `https://127.0.0.1:3000`
   - **Important**: Use `127.0.0.1`, NOT `localhost`

4. **Test in Telegram**:
   - Open bot in Telegram (web or desktop)
   - Navigate to `/wallet` page
   - Click "Connect Wallet"
   - Select wallet app (Tonkeeper/MyTonWallet)
   - Approve connection
   - Verify address appears in UI

### Automated Testing

1. **Run integration tests**:
   ```bash
   pnpm run test tests/integration/wallet/
   ```

2. **Run all tests with coverage**:
   ```bash
   pnpm run test:coverage
   ```

3. **Verify API endpoints**:
   ```bash
   # Connect
   curl -k -X POST https://127.0.0.1:3000/api/wallet/connect \
     -H "Content-Type: application/json" \
     -d '{"walletAddress":"EQ...", "initData":"..."}'

   # Status
   curl -k "https://127.0.0.1:3000/api/wallet/status?initData=..."

   # Disconnect
   curl -k -X POST https://127.0.0.1:3000/api/wallet/disconnect \
     -H "Content-Type: application/json" \
     -d '{"initData":"..."}'
   ```

---

## Step 6: Pre-Commit Checklist

Before committing your changes:

- [ ] **Format check**: `pnpm run format:check` passes
- [ ] **Type check**: `pnpm run type-check` passes
- [ ] **Lint**: `pnpm run lint` passes
- [ ] **Tests**: `pnpm run test` passes
- [ ] All integration tests pass
- [ ] Manual testing in Telegram completed
- [ ] TON Connect manifest accessible at `/tonconnect-manifest.json`

---

## Common Issues & Solutions

### Issue: "Wallet app not found"
**Solution**: Install Tonkeeper or MyTonWallet on your device

### Issue: "Certificate not trusted" in Telegram
**Solution**: Open `https://127.0.0.1:3000` in browser first, accept certificate, then try in Telegram

### Issue: "initData validation failed"
**Solution**: Ensure `TELEGRAM_BOT_TOKEN` is set in `.env.local`

### Issue: "Database locked"
**Solution**: Close any SQLite connections, restart dev server

### Issue: "TON Connect modal doesn't open"
**Solution**: Check that TON Connect manifest is accessible and properly formatted

---

## Next Steps

After implementing this feature:
1. Deploy to production (update manifest with production URL)
2. Test with real users in Telegram production bot
3. Monitor wallet connection success rates
4. Implement transaction functionality (separate feature)
5. Add wallet balance display (future enhancement)

---

## References

- Feature Spec: `spec.md`
- Data Model: `data-model.md`
- API Contracts: `contracts/wallet-api.yaml`
- Research Findings: `research.md`
- TON Connect Docs: https://docs.ton.org/develop/dapps/ton-connect
- Telegram Mini Apps: https://core.telegram.org/bots/webapps
