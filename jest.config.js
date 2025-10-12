/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: '<rootDir>/tests/helpers/console-capture-environment.ts',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@public/(.*)$': '<rootDir>/public/$1',
  },
  clearMocks: true,
  restoreMocks: true,
  // Run tests sequentially to avoid database locking with in-memory SQLite
  maxWorkers: 1,
};

module.exports = config;
