/**
 * @fileoverview Vitest unit configuration for the web workspace package.
 * @layer config
 *
 * The jsdom environment is used because the library's React hooks run in a
 * browser-like context. maxWorkers is capped at 50% of available cores as a
 * memory-safety guard, matching the api's Jest configuration; suites in this
 * workspace never run in parallel with each other.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    maxWorkers: '50%',
  },
});
