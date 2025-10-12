/**
 * Custom Jest environment that captures console output and only displays it on test failure.
 * Extends the default Node environment with console buffering capabilities.
 * Inspired by: https://craigmulligan.com/posts/node-suppress-test-logs/
 */

import NodeEnvironment from 'jest-environment-node';
import type {
  EnvironmentContext,
  JestEnvironmentConfig,
} from '@jest/environment';
import type { Circus } from '@jest/types';

interface LogEntry {
  method: 'log' | 'error' | 'warn' | 'info' | 'debug';
  args: unknown[];
}

interface OriginalConsole {
  log: typeof console.log;
  error: typeof console.error;
  warn: typeof console.warn;
  info: typeof console.info;
  debug: typeof console.debug;
}

// Extend the global namespace to include our custom property
declare global {
  // eslint-disable-next-line no-var
  var __ORIGINAL_CONSOLE__: OriginalConsole | undefined;
}

class ConsoleCaptureEnvironment extends NodeEnvironment {
  private buffer: LogEntry[] = [];

  constructor(config: JestEnvironmentConfig, context: EnvironmentContext) {
    super(config, context);
  }

  async setup(): Promise<void> {
    await super.setup();

    // Store original console methods in global context for proper restoration
    this.global.__ORIGINAL_CONSOLE__ = {
      log: this.global.console.log.bind(this.global.console),
      error: this.global.console.error.bind(this.global.console),
      warn: this.global.console.warn.bind(this.global.console),
      info: this.global.console.info.bind(this.global.console),
      debug: this.global.console.debug.bind(this.global.console),
    };

    // Replace console methods in the test environment
    // Using arrow functions - 'this' is lexically bound, no need for 'self'
    this.global.console.log = (...args: unknown[]) => {
      this.buffer.push({ method: 'log', args });
    };
    this.global.console.error = (...args: unknown[]) => {
      this.buffer.push({ method: 'error', args });
    };
    this.global.console.warn = (...args: unknown[]) => {
      this.buffer.push({ method: 'warn', args });
    };
    this.global.console.info = (...args: unknown[]) => {
      this.buffer.push({ method: 'info', args });
    };
    this.global.console.debug = (...args: unknown[]) => {
      this.buffer.push({ method: 'debug', args });
    };
  }

  async handleTestEvent(event: Circus.Event): Promise<void> {
    if (event.name === 'test_start') {
      // Clear buffer at start of each test
      this.buffer = [];
    } else if (event.name === 'test_done') {
      // Check if test failed
      const test = event.test;
      const testFailed = test.errors.length > 0;

      if (testFailed && this.buffer.length > 0) {
        // Output captured logs only if test failed
        const originalConsole = this.global.__ORIGINAL_CONSOLE__ as OriginalConsole;
        originalConsole.log(
          `\n📋 Captured ${this.buffer.length} log entries from failed test:`
        );
        this.buffer.forEach(({ method, args }) => {
          originalConsole[method](...args);
        });
      }

      // Clear buffer for next test
      this.buffer = [];
    } else if (event.name === 'test_skip') {
      // Clear buffer for skipped tests to prevent memory leaks
      this.buffer = [];
    }
  }

  async teardown(): Promise<void> {
    // Restore original console methods explicitly (not relying on global restoreMocks)
    const originalConsole = this.global.__ORIGINAL_CONSOLE__;
    if (originalConsole) {
      this.global.console.log = originalConsole.log;
      this.global.console.error = originalConsole.error;
      this.global.console.warn = originalConsole.warn;
      this.global.console.info = originalConsole.info;
      this.global.console.debug = originalConsole.debug;
      this.global.__ORIGINAL_CONSOLE__ = undefined;
    }

    await super.teardown();
  }
}

export default ConsoleCaptureEnvironment;
