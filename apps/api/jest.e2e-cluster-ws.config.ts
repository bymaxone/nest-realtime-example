/**
 * @fileoverview Jest configuration for the WebSocket multi-instance cluster suite.
 * @layer config
 *
 * The WebSocket cluster suite drives a `cluster` compose stack booted in WebSocket
 * mode (`REALTIME_TRANSPORT=websocket`), so both instances serve Socket.IO and the
 * Redis adapter fans messages across them. It is the heaviest WebSocket suite and
 * MUST run alone: bring the WebSocket stack up first
 * (`REALTIME_TRANSPORT=websocket docker compose --profile cluster up -d --build`),
 * run this suite, then tear it down (`docker compose --profile cluster down`); the
 * root `test:e2e:cluster:ws` script wires that sequence.
 *
 * `maxWorkers: 1` keeps every spec on one worker (memory-safe), the shared
 * `global-setup` fails fast when the stack is not up, and `forceExit` guarantees
 * termination even if a Socket.IO keep-alive outlives the run.
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
  testMatch: ['<rootDir>/test/e2e-cluster/ws-cluster.e2e-spec.ts'],
  globalSetup: '<rootDir>/test/e2e-cluster/global-setup.ts',
  maxWorkers: 1,
  forceExit: true,
  testTimeout: 30000,
};

export default config;
