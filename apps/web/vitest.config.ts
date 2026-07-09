/**
 * @fileoverview Vitest unit test configuration for the nest-realtime-example web app.
 * @layer config
 *
 * maxWorkers is capped at 50% of available cores as a memory-safety guard, matching
 * the api's Jest configuration; test suites in this workspace never run in parallel
 * with each other.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
    maxWorkers: '50%',
    passWithNoTests: true,
  },
});
