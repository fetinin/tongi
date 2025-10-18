-- Migration 004: Add transaction tracking for reward distribution
-- This migration extends corgi_sightings with reward status and creates the transactions table

-- Add reward tracking columns to corgi_sightings table
ALTER TABLE corgi_sightings ADD COLUMN reward_status TEXT CHECK(reward_status IN ('not_applicable', 'pending', 'distributed', 'failed'));
ALTER TABLE corgi_sightings ADD COLUMN reward_distributed_at DATETIME;

-- Create transactions table for tracking Jetton transfers
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_wallet TEXT NOT NULL,
  to_wallet TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount > 0),
  status TEXT NOT NULL CHECK(status IN ('pending', 'broadcasting', 'completed', 'failed')),
  transaction_hash TEXT NULL UNIQUE,
  sighting_id INTEGER NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  broadcast_at DATETIME NULL,
  confirmed_at DATETIME NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_retry_at DATETIME NULL,
  last_error TEXT NULL,
  failure_reason TEXT NULL,
  FOREIGN KEY (sighting_id) REFERENCES corgi_sightings(id) ON DELETE RESTRICT,
  CHECK(from_wallet != to_wallet),
  CHECK(broadcast_at IS NULL OR broadcast_at >= created_at),
  CHECK(confirmed_at IS NULL OR confirmed_at >= broadcast_at)
);

-- Indexes for performance
CREATE INDEX idx_transactions_status_created ON transactions(status, created_at);
CREATE INDEX idx_transactions_hash_status ON transactions(transaction_hash, status) WHERE transaction_hash IS NOT NULL;
CREATE INDEX idx_transactions_to_wallet ON transactions(to_wallet);
CREATE INDEX idx_transactions_sighting ON transactions(sighting_id);
