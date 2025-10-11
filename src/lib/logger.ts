/**
 * Lightweight logger utility with environment-aware verbosity.
 * Uses console under the hood to avoid extra deps and works in Next.js edge/runtime.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function getLogLevel(): LogLevel {
  const env = process.env.NODE_ENV;
  if (env === 'production') return 'info';
  return 'debug';
}

function shouldLog(level: LogLevel): boolean {
  const order: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
  };
  return order[level] >= order[getLogLevel()];
}

function format(scope: string | undefined, message: unknown): string {
  const prefix = scope ? `[${scope}]` : '';
  return `${prefix} ${String(message)}`.trim();
}

export const logger = {
  debug(scope: string | undefined, message: unknown, ...args: unknown[]) {
    if (shouldLog('debug')) console.debug(format(scope, message), ...args);
  },
  info(scope: string | undefined, message: unknown, ...args: unknown[]) {
    if (shouldLog('info')) console.info(format(scope, message), ...args);
  },
  warn(scope: string | undefined, message: unknown, ...args: unknown[]) {
    if (shouldLog('warn')) console.warn(format(scope, message), ...args);
  },
  error(scope: string | undefined, message: unknown, ...args: unknown[]) {
    if (shouldLog('error')) console.error(format(scope, message), ...args);
  },
};

export default logger;
