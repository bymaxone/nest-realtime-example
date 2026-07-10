/**
 * @fileoverview Playwright configuration for the web smoke and page journeys.
 * @layer config
 *
 * `webServer` boots the whole SSE stack the journeys drive: the api from source
 * (ts-node) on 3001 and the web app (`next dev`) on 3000, each gated on its own
 * health/readiness URL. A Redis must already be listening (the local
 * `docker compose up -d redis`, or the CI `redis` service) because tickets,
 * presence and revocation are Redis-backed. Runs serially on a single worker so
 * the two long-lived servers are never contended by parallel pages;
 * `reuseExistingServer` lets a developer point the run at an already-running stack.
 */

import { defineConfig } from '@playwright/test';

/** The api and web ports the journeys and the booted servers agree on. */
const API_PORT = 3001;
const WEB_PORT = 3000;

/** Redis connection the api uses for tickets, presence and revocation. */
const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env['PLAYWRIGHT_BASE_URL'] ?? `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'pnpm --filter @nest-realtime-example/api exec node -r ts-node/register src/main.ts',
      url: `http://127.0.0.1:${API_PORT}/health`,
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
      env: {
        PORT: String(API_PORT),
        INSTANCE_NAME: 'app-a',
        REALTIME_TRANSPORT: 'sse',
        PUBSUB_DRIVER: 'memory',
        OFFLINE_QUEUE_ENABLED: 'false',
        REDIS_URL,
        WEB_ORIGIN: `http://localhost:${WEB_PORT}`,
      },
    },
    {
      command: 'pnpm --filter @nest-realtime-example/web run dev',
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}`,
        NEXT_PUBLIC_WS_URL: `ws://localhost:${API_PORT}/live`,
      },
    },
  ],
});
