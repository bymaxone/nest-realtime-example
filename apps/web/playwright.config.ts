/**
 * @fileoverview Playwright configuration for the web smoke journey.
 * @layer config
 *
 * Runs against an already-running dev/prod server (`NEXT_PUBLIC_API_URL` and
 * the api must both be up); this config never starts the server itself so it
 * composes cleanly with the docker/redis lifecycle the caller manages.
 */

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
});
