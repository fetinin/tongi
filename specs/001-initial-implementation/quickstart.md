# Quickstart Guide: Corgi Buddy TON Cryptocurrency Mini-App

## Prerequisites

- Node.js 18+ with pnpm package manager
- Telegram account for testing
- TON Connect wallet setup (e.g., Tonkeeper)
- Access to test environment with valid bot token

## Setup Instructions

### 1. Environment Configuration

```bash
# Navigate to the project directory
cd telegram_webapp_example/

# Install dependencies (must use pnpm)
pnpm install

# Install required UI library
pnpm add @telegram-apps/telegram-ui

# Copy environment template
cp .env.local.example .env.local
```

Edit `.env.local` with your configuration:
```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_BOT_USERNAME=your_bot_username

# TON Blockchain Configuration
TON_BANK_WALLET_MNEMONIC="your bank wallet mnemonic phrase"
TON_BANK_WALLET_ADDRESS=your_bank_wallet_address
TON_NETWORK=testnet  # or mainnet for production

# Database Configuration (SQLite)
DATABASE_URL=file:./corgi_buddy.db

# Security Configuration
JWT_SECRET=your_jwt_secret_key
HMAC_SECRET=your_hmac_secret_for_telegram_validation

# Development Configuration
NEXT_PUBLIC_APP_URL=https://127.0.0.1:3000
```

### 2. Database Initialization

```bash
# Run database migration (creates tables)
pnpm run db:migrate

# Seed initial bank wallet (optional)
pnpm run db:seed
```

### 3. Development Server

```bash
# Start HTTPS development server (required for Telegram)
pnpm run dev:https

# Server will be available at https://127.0.0.1:3000
```

### 4. Telegram Bot Configuration

1. Create a bot with [@BotFather](https://t.me/botfather)
2. Set the Mini App URL:
   ```
   /setmenubutton
   Select your bot
   Enter button text: "Open Corgi Buddy"
   Enter Mini App URL: https://127.0.0.1:3000
   ```
3. Enable inline mode (optional):
   ```
   /setinline
   Select your bot
   Enter placeholder: "Share corgi wishes..."
   ```

## User Journey Testing

### 1. First-Time User Experience

**Test User A Registration:**
```bash
# Open bot in Telegram
# Click "Open Corgi Buddy" button
# Expected: App opens, prompts for TON wallet connection
```

**Verification Steps:**
- [ ] App loads within 3 seconds
- [ ] @telegram-apps/telegram-ui styles are properly loaded
- [ ] App is wrapped with AppRoot component from telegram-ui
- [ ] All UI components use telegram-ui library (List, Section, Cell, etc.)
- [ ] Telegram user data is received correctly
- [ ] TON Connect wallet connection works
- [ ] User profile is created in database
- [ ] No buddy relationship exists initially

**Database Check:**
```sql
SELECT * FROM users WHERE telegram_username = 'test_user_a';
-- Should show new user record with TON wallet address
```

### 2. Buddy Pairing Process

**Test User B Registration:**
```bash
# Register second test user
# Both users should be in database
```

**User A Initiates Buddy Request:**
```bash
# In app: Enter User B's Telegram username
# Click "Send Buddy Request"
# Expected: Request sent, User B receives notification
```

**Verification Steps:**
- [ ] Buddy search UI uses telegram-ui List/Cell components
- [ ] Buddy status display uses telegram-ui Section components
- [ ] Buddy pair record created with status 'pending'
- [ ] User B receives Telegram notification via bot
- [ ] User A sees "Request sent" status
- [ ] User B can accept/decline in app using telegram-ui components

**Database Check:**
```sql
SELECT * FROM buddy_pairs WHERE status = 'pending';
-- Should show pending buddy request
```

**User B Accepts Request:**
```bash
# User B opens app
# Sees pending buddy request
# Clicks "Accept"
# Expected: Both users now have active buddy relationship
```

**Verification Steps:**
- [ ] Buddy pair status changes to 'active'
- [ ] Both users see each other as buddies
- [ ] Both users can now create corgi sightings

### 3. Corgi Sighting Flow

**User A Reports Sighting:**
```bash
# User A: Click "Spot Corgi"
# Enter count: 3
# Click "Ask to Confirm"
# Expected: Sighting created, User B gets notification
```

**Verification Steps:**
- [ ] Corgi sighting form uses telegram-ui form components
- [ ] Sighting history displays using telegram-ui List/Cell layout
- [ ] Corgi sighting record created with status 'pending'
- [ ] User B receives confirmation request notification
- [ ] User A sees pending sighting in history
- [ ] User A cannot create another sighting while one is pending

**Database Check:**
```sql
SELECT * FROM corgi_sightings WHERE status = 'pending';
-- Should show the new sighting
```

**User B Confirms Sighting:**
```bash
# User B opens app
# Sees confirmation request
# Clicks "Confirm"
# Expected: Corgi coins transferred to User A
```

**Verification Steps:**
- [ ] Sighting status changes to 'confirmed'
- [ ] Transaction record created for reward
- [ ] Bank wallet balance decreases
- [ ] User A receives Corgi coins in wallet
- [ ] Both users see transaction in history

### 4. Wish Creation and Marketplace

**User A Creates Wish:**
```bash
# User A: Click "Create Wish"
# Enter description: "Help me walk my dog"
# Enter amount: 5.0 Corgi coins
# Click "Send to Buddy"
# Expected: Wish sent to User B for approval
```

**Verification Steps:**
- [ ] Wish creation form uses telegram-ui form components
- [ ] Wish list displays using telegram-ui List/Section layout
- [ ] Wish record created with status 'pending'
- [ ] User B receives wish approval notification
- [ ] User A sees pending wish in their list
- [ ] Wish not yet visible in marketplace

**User B Accepts Wish:**
```bash
# User B opens app
# Sees pending wish approval
# Clicks "Accept"
# Expected: Wish moves to marketplace
```

**Verification Steps:**
- [ ] Wish status changes to 'accepted'
- [ ] Wish appears in public marketplace
- [ ] Any user can now purchase the wish

### 5. Wish Purchase Flow

**Any User Purchases Wish:**
```bash
# Any user opens marketplace
# Sees available wishes
# Clicks "Purchase" on User A's wish
# Expected: TON transaction initiated
```

**Verification Steps:**
- [ ] Marketplace uses telegram-ui List/Section/Cell for wish display
- [ ] Purchase modal uses telegram-ui modal components
- [ ] Purchase transaction created
- [ ] TON wallet opens with transaction details
- [ ] User confirms transaction in wallet
- [ ] Corgi coins transferred from purchaser to User A
- [ ] Wish status changes to 'purchased'

## API Testing

### Authentication Test
```bash
curl -X POST https://127.0.0.1:3000/api/auth/validate \
  -H "Content-Type: application/json" \
  -d '{
    "initData": "user=%7B%22id%22%3A123456789%7D&auth_date=1234567890&hash=test",
    "tonWalletAddress": "UQD-SuoCHsCL2pIZfE8IAKsjc0aDpDUQAoo-ALHl2mje04A-"
  }'

# Expected: 200 OK with user data and JWT token
```

### Buddy Search Test
```bash
curl -X GET "https://127.0.0.1:3000/api/buddy/search?username=test_user" \
  -H "Authorization: Bearer <jwt_token>"

# Expected: 200 OK with user search results
```

### Sighting Creation Test
```bash
curl -X POST https://127.0.0.1:3000/api/corgi/sightings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt_token>" \
  -d '{"corgiCount": 3}'

# Expected: 201 Created with sighting data
```

## Error Scenarios Testing

### Invalid Authentication
```bash
# Test with invalid initData
curl -X POST https://127.0.0.1:3000/api/auth/validate \
  -H "Content-Type: application/json" \
  -d '{"initData": "invalid_data"}'

# Expected: 401 Unauthorized
```

### No Buddy Relationship
```bash
# Test corgi sighting without buddy
curl -X POST https://127.0.0.1:3000/api/corgi/sightings \
  -H "Authorization: Bearer <jwt_token_no_buddy>" \
  -d '{"corgiCount": 1}'

# Expected: 400 Bad Request - "No active buddy relationship"
```

### Insufficient Funds
```bash
# Test wish purchase without enough coins
# (After depleting user's Corgi coin balance)
curl -X POST https://127.0.0.1:3000/api/marketplace/1/purchase \
  -H "Authorization: Bearer <jwt_token>"

# Expected: 400 Bad Request - "Insufficient Corgi coins"
```

## Performance Testing

### Load Test Scenarios
```bash
# Install testing tools
pnpm add -D autocannon

# Test authentication endpoint
npx autocannon -c 10 -d 30 -m POST \
  --body '{"initData":"test"}' \
  --header "Content-Type=application/json" \
  https://127.0.0.1:3000/api/auth/validate

# Expected: >100 req/s with <500ms p95 latency
```

### Database Performance
```sql
-- Test complex queries
EXPLAIN QUERY PLAN
SELECT * FROM wishes w
JOIN users u ON w.creator_id = u.id
WHERE w.status = 'accepted'
ORDER BY w.created_at DESC
LIMIT 20;

-- Should use indexes efficiently
```

## Security Testing

### HMAC Validation Test
```bash
# Test with properly signed Telegram data
# (Use telegram-web-app bot API to generate valid initData)

# Test with tampered data
curl -X POST https://127.0.0.1:3000/api/auth/validate \
  -d '{"initData":"user={\"id\":999999}&auth_date=1234567890&hash=invalid"}'

# Expected: 401 Unauthorized - "Invalid authentication"
```

### SQL Injection Test
```bash
# Test with malicious input
curl -X GET "https://127.0.0.1:3000/api/buddy/search?username='; DROP TABLE users; --" \
  -H "Authorization: Bearer <jwt_token>"

# Expected: Safe handling, no database corruption
```

## Monitoring and Logs

### Application Logs
```bash
# View application logs
tail -f logs/app.log

# Check for errors during testing
grep "ERROR" logs/app.log
```

### Database Monitoring
```sql
-- Check database integrity
PRAGMA integrity_check;

-- Monitor transaction volume
SELECT transaction_type, COUNT(*), SUM(amount)
FROM transactions
WHERE created_at > datetime('now', '-1 hour')
GROUP BY transaction_type;
```

### Bank Wallet Monitoring
```sql
-- Check bank wallet balance
SELECT current_balance, total_distributed
FROM bank_wallet;

-- Alert if balance is low
SELECT CASE
  WHEN current_balance < 100 THEN 'LOW_BALANCE_ALERT'
  ELSE 'OK'
END as status
FROM bank_wallet;
```

## Troubleshooting

### Common Issues

**App doesn't load in Telegram:**
- Verify HTTPS is working (`https://127.0.0.1:3000`)
- Check bot configuration in @BotFather
- Ensure valid SSL certificate for production

**TON Connect fails:**
- Check TON network configuration (testnet vs mainnet)
- Verify wallet app is installed and configured
- Check browser console for connection errors

**Database errors:**
- Verify SQLite file permissions
- Check database schema with `pnpm run db:status`
- Review migration files for syntax errors

**Authentication fails:**
- Verify TELEGRAM_BOT_TOKEN is correct
- Check HMAC validation implementation
- Ensure user data is being passed correctly from Telegram

### Debug Commands
```bash
# Check database status
pnpm run db:status

# Validate environment configuration
pnpm run config:check

# Validate telegram-ui integration
pnpm run test:ui-components

# Run integration tests
pnpm run test:integration

# Check API endpoints
pnpm run test:api
```

## Success Criteria Validation

After completing this quickstart:

- [ ] All UI components use @telegram-apps/telegram-ui library
- [ ] @telegram-apps/telegram-ui/dist/styles.css is properly imported
- [ ] App is wrapped with AppRoot component from telegram-ui
- [ ] Lists use telegram-ui List/Section/Cell components
- [ ] Forms use telegram-ui form components
- [ ] Developers can get telegram-ui docs via context7 "telegramui" search
- [ ] Two users can establish buddy relationships
- [ ] Corgi sightings can be reported and confirmed
- [ ] Corgi coins are distributed correctly upon confirmation
- [ ] Wishes can be created, approved, and purchased
- [ ] TON transactions work end-to-end
- [ ] All API endpoints respond correctly
- [ ] App performs well under load (<500ms p95)
- [ ] Security validation passes all tests
- [ ] Error handling works for edge cases
- [ ] Mobile interface is responsive and usable

## Next Steps

After successful quickstart validation:

1. Deploy to staging environment
2. Conduct user acceptance testing with real users
3. Monitor performance and error rates
4. Implement additional features (push notifications, advanced marketplace)
5. Prepare for production deployment