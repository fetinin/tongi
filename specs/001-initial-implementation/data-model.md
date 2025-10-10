# Data Model: Corgi Buddy TON Cryptocurrency Mini-App

## Entity Definitions

### **User**
Represents an authenticated Telegram user with TON wallet integration.

**Fields:**
- `id` (PRIMARY KEY): Telegram user ID (bigint)
- `telegram_username`: Telegram @username (string, nullable)
- `first_name`: User's first name from Telegram (string)
- `ton_wallet_address`: Connected TON wallet address (string, nullable)
- `created_at`: Registration timestamp (datetime)
- `updated_at`: Last activity timestamp (datetime)

**Validation Rules:**
- `id` must be valid Telegram user ID (positive integer)
- `telegram_username` must be unique if provided
- `ton_wallet_address` must be valid TON address format when provided
- `first_name` required, 1-64 characters

**State Transitions:**
- `UNREGISTERED` → `REGISTERED` (on first login)
- `REGISTERED` → `WALLET_CONNECTED` (on TON Connect)
- `WALLET_CONNECTED` → `BUDDY_PAIRED` (on buddy establishment)

### **BuddyPair**
Represents the bidirectional relationship between two users.

**Fields:**
- `id` (PRIMARY KEY): Auto-increment ID (integer)
- `user1_id`: First user's Telegram ID (bigint, FOREIGN KEY → User.id)
- `user2_id`: Second user's Telegram ID (bigint, FOREIGN KEY → User.id)
- `initiated_by`: User who initiated the pairing (bigint, FOREIGN KEY → User.id)
- `status`: Pairing status (enum: 'pending', 'active', 'dissolved')
- `created_at`: Pairing initiation timestamp (datetime)
- `confirmed_at`: Pairing confirmation timestamp (datetime, nullable)

**Validation Rules:**
- `user1_id` ≠ `user2_id` (cannot buddy with self)
- Unique constraint on (user1_id, user2_id) where user1_id < user2_id
- Each user can only have one active buddy pair
- `initiated_by` must be either `user1_id` or `user2_id`

**State Transitions:**
- `pending` → `active` (on buddy confirmation)
- `active` → `dissolved` (on buddy dissolution - future feature)

### **CorgiSighting**
Represents a user's report of spotted corgis requiring buddy confirmation.

**Fields:**
- `id` (PRIMARY KEY): Auto-increment ID (integer)
- `reporter_id`: User reporting the sighting (bigint, FOREIGN KEY → User.id)
- `buddy_id`: Buddy who must confirm (bigint, FOREIGN KEY → User.id)
- `corgi_count`: Number of corgis spotted (integer)
- `status`: Confirmation status (enum: 'pending', 'confirmed', 'denied')
- `created_at`: Sighting report timestamp (datetime)
- `responded_at`: Buddy response timestamp (datetime, nullable)

**Validation Rules:**
- `corgi_count` must be positive integer (1-100)
- `reporter_id` ≠ `buddy_id` (cannot confirm own sightings)
- Must have active buddy pair between reporter and buddy
- Only one pending sighting per user at a time

**State Transitions:**
- `pending` → `confirmed` (buddy confirms sighting)
- `pending` → `denied` (buddy denies sighting)
- `confirmed` → (triggers Corgi coin transfer)

### **Wish**
Represents a purchase request with proposed Corgi coin amount.

**Fields:**
- `id` (PRIMARY KEY): Auto-increment ID (integer)
- `creator_id`: User creating the wish (bigint, FOREIGN KEY → User.id)
- `buddy_id`: Buddy who must accept wish (bigint, FOREIGN KEY → User.id)
- `description`: Wish description (string)
- `proposed_amount`: Proposed Corgi coins (decimal)
- `status`: Wish status (enum: 'pending', 'accepted', 'rejected', 'purchased')
- `created_at`: Wish creation timestamp (datetime)
- `accepted_at`: Buddy acceptance timestamp (datetime, nullable)
- `purchased_at`: Purchase completion timestamp (datetime, nullable)
- `purchased_by`: User who purchased the wish (bigint, FOREIGN KEY → User.id, nullable)

**Validation Rules:**
- `description` required, 1-500 characters
- `proposed_amount` must be positive decimal (0.01-1000.00)
- `creator_id` ≠ `buddy_id` (cannot create wish for self)
- Must have active buddy pair between creator and buddy
- Can only purchase accepted wishes

**State Transitions:**
- `pending` → `accepted` (buddy accepts wish)
- `pending` → `rejected` (buddy rejects wish)
- `accepted` → `purchased` (any user purchases wish)

### **Transaction**
Represents TON blockchain transactions for Corgi coin transfers.

**Fields:**
- `id` (PRIMARY KEY): Auto-increment ID (integer)
- `transaction_hash`: TON blockchain transaction hash (string, nullable)
- `from_wallet`: Sender's TON wallet address (string)
- `to_wallet`: Recipient's TON wallet address (string)
- `amount`: Corgi coins transferred (decimal)
- `transaction_type`: Type of transaction (enum: 'reward', 'purchase')
- `related_entity_id`: ID of related entity (integer, nullable)
- `related_entity_type`: Type of related entity (enum: 'corgi_sighting', 'wish', nullable)
- `status`: Transaction status (enum: 'pending', 'completed', 'failed')
- `created_at`: Transaction initiation timestamp (datetime)
- `completed_at`: Transaction completion timestamp (datetime, nullable)

**Validation Rules:**
- `amount` must be positive decimal
- `transaction_hash` must be unique when provided
- `from_wallet` and `to_wallet` must be valid TON addresses
- For `reward` type: `related_entity_type` must be 'corgi_sighting'
- For `purchase` type: `related_entity_type` must be 'wish'

**State Transitions:**
- `pending` → `completed` (blockchain confirms transaction)
- `pending` → `failed` (blockchain rejects transaction)

### **BankWallet**
Represents the system-controlled wallet for Corgi coin distribution.

**Fields:**
- `id` (PRIMARY KEY): Always 1 (singleton)
- `wallet_address`: Bank wallet TON address (string)
- `current_balance`: Current Corgi coin balance (decimal)
- `total_distributed`: Total coins distributed to users (decimal)
- `last_transaction_hash`: Last transaction hash (string, nullable)
- `updated_at`: Last balance update timestamp (datetime)

**Validation Rules:**
- Only one bank wallet record allowed
- `current_balance` must be non-negative
- `total_distributed` must be non-negative
- `wallet_address` must be valid TON address

## Relationships

### **User ↔ BuddyPair**
- One user can have at most one active buddy pair
- Buddy pair connects exactly two users
- Cascade delete: Remove buddy pair when user is deleted

### **BuddyPair → CorgiSighting**
- Each sighting requires an active buddy pair
- Foreign key constraint ensures buddy relationship exists
- Cascade delete: Remove sightings when buddy pair is dissolved

### **BuddyPair → Wish**
- Each wish requires an active buddy pair between creator and acceptor
- Any user can purchase accepted wishes (no buddy constraint)
- Cascade delete: Remove pending/rejected wishes when buddy pair is dissolved

### **CorgiSighting → Transaction**
- Confirmed sightings trigger reward transactions
- One-to-one relationship: one transaction per confirmed sighting
- Cascade delete: Remove transaction when sighting is deleted

### **Wish → Transaction**
- Purchased wishes create purchase transactions
- One-to-one relationship: one transaction per purchase
- Cascade delete: Remove transaction when wish is deleted

## Database Schema (SQLite)

```sql
-- Users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    telegram_username TEXT UNIQUE,
    first_name TEXT NOT NULL,
    ton_wallet_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Buddy pairs table
CREATE TABLE buddy_pairs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user1_id INTEGER NOT NULL,
    user2_id INTEGER NOT NULL,
    initiated_by INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'active', 'dissolved')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    confirmed_at DATETIME,
    FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (initiated_by) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user1_id, user2_id) -- Ensure user1_id < user2_id in application logic
);

-- Corgi sightings table
CREATE TABLE corgi_sightings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_id INTEGER NOT NULL,
    buddy_id INTEGER NOT NULL,
    corgi_count INTEGER NOT NULL CHECK(corgi_count > 0 AND corgi_count <= 100),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'denied')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    responded_at DATETIME,
    FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (buddy_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Wishes table
CREATE TABLE wishes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_id INTEGER NOT NULL,
    buddy_id INTEGER NOT NULL,
    description TEXT NOT NULL CHECK(length(description) <= 500),
    proposed_amount DECIMAL(10,2) NOT NULL CHECK(proposed_amount > 0 AND proposed_amount <= 1000),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected', 'purchased')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    accepted_at DATETIME,
    purchased_at DATETIME,
    purchased_by INTEGER,
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (buddy_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (purchased_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Transactions table
CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_hash TEXT UNIQUE,
    from_wallet TEXT NOT NULL,
    to_wallet TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL CHECK(amount > 0),
    transaction_type TEXT NOT NULL CHECK(transaction_type IN ('reward', 'purchase')),
    related_entity_id INTEGER,
    related_entity_type TEXT CHECK(related_entity_type IN ('corgi_sighting', 'wish')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'failed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
);

-- Bank wallet table (singleton)
CREATE TABLE bank_wallet (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    wallet_address TEXT NOT NULL,
    current_balance DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK(current_balance >= 0),
    total_distributed DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK(total_distributed >= 0),
    last_transaction_hash TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_buddy_pairs_users ON buddy_pairs(user1_id, user2_id);
CREATE INDEX idx_corgi_sightings_reporter ON corgi_sightings(reporter_id);
CREATE INDEX idx_corgi_sightings_buddy ON corgi_sightings(buddy_id);
CREATE INDEX idx_wishes_creator ON wishes(creator_id);
CREATE INDEX idx_wishes_status ON wishes(status);
CREATE INDEX idx_transactions_hash ON transactions(transaction_hash);
CREATE INDEX idx_transactions_related ON transactions(related_entity_type, related_entity_id);

-- Triggers for updated_at fields
CREATE TRIGGER update_users_timestamp
    AFTER UPDATE ON users
    BEGIN
        UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER update_bank_wallet_timestamp
    AFTER UPDATE ON bank_wallet
    BEGIN
        UPDATE bank_wallet SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
```

## Data Access Patterns

### **Buddy Operations**
- Find user's current buddy: `SELECT * FROM buddy_pairs WHERE (user1_id = ? OR user2_id = ?) AND status = 'active'`
- Check if users can be buddies: Verify no existing active pair for either user

### **Corgi Sighting Operations**
- Get pending confirmations for user: `SELECT * FROM corgi_sightings WHERE buddy_id = ? AND status = 'pending'`
- Check user's pending sightings: `SELECT * FROM corgi_sightings WHERE reporter_id = ? AND status = 'pending'`

### **Wish Marketplace**
- Get accepted wishes for purchase: `SELECT * FROM wishes WHERE status = 'accepted' ORDER BY created_at DESC`
- Get user's wishes by status: `SELECT * FROM wishes WHERE creator_id = ? AND status = ?`

### **Transaction History**
- Get user's transaction history: `SELECT * FROM transactions WHERE from_wallet = ? OR to_wallet = ? ORDER BY created_at DESC`
- Get pending transactions: `SELECT * FROM transactions WHERE status = 'pending'`