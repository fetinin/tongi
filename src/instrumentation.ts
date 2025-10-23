/**
 * Next.js Instrumentation Hook
 *
 * This file runs once when the Next.js server instance starts.
 * It initializes server-side resources like the TON blockchain client.
 *
 * CRITICAL: If TON client initialization fails, the application will not start.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only initialize on Node.js runtime (not Edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeTONClient } = await import('@/lib/blockchain/ton-client');
    // CRITICAL: Let errors propagate to prevent server startup if TON client fails
    await initializeTONClient();
  }
}
