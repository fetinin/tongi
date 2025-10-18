-- Migration 005: Add pending rewards tracking for users without wallets
-- This migration creates the pending_rewards table for handling deferred reward distribution

CREATE TABLE IF NOT EXISTS pending_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  sighting_id INTEGER NOT NULL,
  amount INTEGER NOT NULL CHECK(amount > 0),
  status TEXT NOT NULL CHECK(status IN ('pending', 'processed', 'cancelled')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME NULL,
  transaction_id INTEGER NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (sighting_id) REFERENCES corgi_sightings(id) ON DELETE RESTRICT,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE RESTRICT,
  CHECK(status != 'pending' OR transaction_id IS NULL),
  CHECK(status != 'processed' OR transaction_id IS NOT NULL)
);

-- Unique constraint: one pending reward per sighting (when pending)
CREATE UNIQUE INDEX idx_pending_rewards_sighting_pending ON pending_rewards(sighting_id) WHERE status = 'pending';

-- Indexes for performance
CREATE INDEX idx_pending_rewards_user_status ON pending_rewards(user_id, status);
CREATE INDEX idx_pending_rewards_sighting ON pending_rewards(sighting_id);
