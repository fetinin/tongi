/**
 * Next.js Instrumentation Hook
 *
 * This file runs once when the Next.js server instance starts.
 * It initializes server-side resources like the TON blockchain client.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only initialize on Node.js runtime (not Edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { initializeTONClient } = await import(
        '@/lib/blockchain/ton-client'
      );
      await initializeTONClient();
    } catch (error) {
      console.error(
        '[Instrumentation] Failed to initialize TON client:',
        error
      );
      // Don't re-throw - allow app to start even if TON initialization fails
      // TON operations will fail later with a clear error message
    }
  }
}
