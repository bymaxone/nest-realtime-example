/**
 * @fileoverview Jest end-to-end configuration for the api workspace package.
 * @layer config
 *
 * The e2e suites boot a live Nest application and hold long-lived SSE
 * connections, so they run apart from the unit suite and never collect coverage.
 *
 * Suites run one at a time (`maxWorkers: 1`) for two reasons: the linked library
 * graph is reloaded per worker, so a single worker is the memory-safest choice;
 * and several suites share one Redis (the revocation set keyed by demo user), so
 * running them concurrently would let one suite's revoke race another's
 * revalidation. `forceExit` guarantees the run terminates even if a lingering
 * keep-alive (an SSE heartbeat or a Redis socket) outlives `app.close()`.
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
  testMatch: ['<rootDir>/test/e2e/**/*.e2e-spec.ts'],
  maxWorkers: 1,
  forceExit: true,
  testTimeout: 30000,
};

export default config;
