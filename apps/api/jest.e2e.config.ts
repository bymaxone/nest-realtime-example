/**
 * @fileoverview Jest end-to-end configuration for the api workspace package.
 * @layer config
 *
 * The e2e suites boot a live Nest application and hold long-lived SSE
 * connections, so they run apart from the unit suite and never collect coverage.
 * maxWorkers is capped at 50% of available cores as the same memory-safety guard
 * the unit config uses: the linked library graph is reloaded per worker.
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
  maxWorkers: '50%',
  testTimeout: 30000,
};

export default config;
