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
  method: 'log' | 'error' | 'warn' | 'info';
  args: unknown[];
}

class ConsoleCaptureEnvironment extends NodeEnvironment {
  private buffer: LogEntry[] = [];
  private originalConsole: {
    log: typeof console.log;
    error: typeof console.error;
    warn: typeof console.warn;
    info: typeof console.info;
  };

  constructor(config: JestEnvironmentConfig, context: EnvironmentContext) {
    super(config, context);

    // Store original console methods
    this.originalConsole = {
      log: console.log.bind(console),
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      info: console.info.bind(console),
    };
  }

  async setup(): Promise<void> {
    await super.setup();

    // Replace console methods in the test environment
    const self = this;
    this.global.console.log = (...args: unknown[]) => {
      self.buffer.push({ method: 'log', args });
    };
    this.global.console.error = (...args: unknown[]) => {
      self.buffer.push({ method: 'error', args });
    };
    this.global.console.warn = (...args: unknown[]) => {
      self.buffer.push({ method: 'warn', args });
    };
    this.global.console.info = (...args: unknown[]) => {
      self.buffer.push({ method: 'info', args });
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
        this.originalConsole.log(
          `\n📋 Captured ${this.buffer.length} log entries from failed test:`
        );
        this.buffer.forEach(({ method, args }) => {
          this.originalConsole[method](...args);
        });
      }

      // Clear buffer for next test
      this.buffer = [];
    }
  }

  async teardown(): Promise<void> {
    // Restore original console
    this.global.console.log = this.originalConsole.log;
    this.global.console.error = this.originalConsole.error;
    this.global.console.warn = this.originalConsole.warn;
    this.global.console.info = this.originalConsole.info;

    await super.teardown();
  }
}

export default ConsoleCaptureEnvironment;
