/**
 * @fileoverview Jest unit configuration for the api workspace package.
 * @layer config
 *
 * maxWorkers is capped at 50% of available cores as a memory-safety guard: the
 * library under test is consumed via a local link, so every worker would
 * otherwise load its own copy of the compiled module graph.
 *
 * Coverage is collected on every run and pinned to 100% so any shipped source
 * file stays fully exercised. The package entry point is excluded because it is
 * the process bootstrap, which is proven by end-to-end runs against a live
 * server rather than by unit coverage.
 */

import type { Config } from 'jest';

const config: Config = {
  rootDir: '.',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/test/**/*.spec.ts'],
  maxWorkers: '50%',
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts'],
  coverageThreshold: {
    global: { branches: 100, functions: 100, lines: 100, statements: 100 },
  },
};

export default config;
