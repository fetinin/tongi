/**
 * Next.js Instrumentation Hook
 *
 * This file runs once when the Next.js server instance starts.
 * It initializes server-side resources like database migrations and the TON blockchain client.
 *
 * CRITICAL: If migrations or TON client initialization fail, the application will not start.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only initialize on Node.js runtime (not Edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Skip initialization during build if SKIP_DB_INIT is set
    if (process.env.SKIP_DB_INIT !== 'true') {
      // Run database migrations first
      const Database = (await import('better-sqlite3')).default;
      const path = await import('path');
      const fs = await import('fs');
      const { runMigrations } = await import('@/lib/database/migrations');

      const dbPath = path.join(process.cwd(), 'data', 'app.db');

      // Ensure data directory exists
      const dataDir = path.dirname(dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      console.log('Running database migrations at:', dbPath);
      const db = new Database(dbPath);
      runMigrations(db);
      db.close();
    }

    // Initialize TON client
    const { initializeTONClient } = await import('@/lib/blockchain/ton-client');
    // CRITICAL: Let errors propagate to prevent server startup if TON client fails
    await initializeTONClient();
  }
}
