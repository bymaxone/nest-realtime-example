/**
 * @fileoverview Jest unit test configuration for the nest-realtime-example API.
 * @layer config
 *
 * maxWorkers is capped at 50% of available cores as a memory-safety guard: the
 * library under test is consumed via a local link, and every worker process
 * would otherwise load its own copy of the compiled module graph.
 */

/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/test/**/*.spec.ts'],
  maxWorkers: '50%',
  passWithNoTests: true,
};
