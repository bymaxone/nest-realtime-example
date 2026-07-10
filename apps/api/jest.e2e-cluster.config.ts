/**
 * @fileoverview Jest configuration for the multi-instance cluster e2e suite.
 * @layer config
 *
 * This is the heaviest suite in the repo and MUST run alone. It drives a live
 * `cluster` compose stack (redis + app-a + app-b + nginx) over real HTTP and SSE
 * rather than an in-memory app, so it never runs concurrently with the unit or
 * single-instance e2e suites and never alongside a second compose stack. Bring the
 * stack up first (`docker compose --profile cluster up -d --build`), run this
 * suite, then tear it down (`docker compose --profile cluster down`); the
 * `test:e2e:cluster` script wires that sequence.
 *
 * `maxWorkers: 1` keeps every spec on one worker (memory-safe and free of
 * cross-spec races over the shared Redis), `globalSetup` fails fast with a clear
 * message when the stack is not up, and `forceExit` guarantees termination even if
 * an SSE keep-alive or a Redis socket outlives the run.
 *
 * The WebSocket cluster suite is excluded here: it needs the stack booted in
 * WebSocket mode, so it runs through its own config against a separately-booted
 * stack, keeping this SSE cluster run against the default SSE stack.
 */

import type { Config } from 'jest';

const config: Config = {
  rootDir: '.',
  testEnvironment: 'node',
  setupFiles: ['reflect-metadata'],
  transform: {
    '^.+\\.tsx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
          target: 'es2022',
          keepClassNames: true,
        },
      },
    ],
  },
  testMatch: ['<rootDir>/test/e2e-cluster/**/*.e2e-spec.ts'],
  testPathIgnorePatterns: ['/node_modules/', 'ws-cluster'],
  globalSetup: '<rootDir>/test/e2e-cluster/global-setup.ts',
  maxWorkers: 1,
  forceExit: true,
  testTimeout: 30000,
};

export default config;
