import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { runMigrations } from '../src/lib/database/migrations';

const dbPath = path.join(process.cwd(), 'data', 'app.db');

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

console.log('Initializing database at:', dbPath);
const db = new Database(dbPath);

try {
  // Run shared migrations
  runMigrations(db);

  console.log('✅ Database migration completed successfully');
  console.log(
    'Tables created: users, buddy_pairs, corgi_sightings, wishes, transactions, pending_rewards, bank_wallet'
  );
} catch (error) {
  console.error('❌ Database migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}
