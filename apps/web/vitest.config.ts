/**
 * @fileoverview Vitest unit configuration for the web workspace package.
 * @layer config
 *
 * The jsdom environment is used because the library's React hooks run in a
 * browser-like context. maxWorkers is capped at 50% of available cores as a
 * memory-safety guard, matching the api's Jest configuration; suites in this
 * workspace never run in parallel with each other. Coverage thresholds are
 * pinned at 100% across every metric; `next.config.mjs` and the App Router
 * `layout.tsx` are excluded (framework wiring with no branch logic of its own,
 * exercised instead by the Next.js build and the Playwright smoke journey).
 */

import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirrors the `@/*` -> `./src/*` alias declared in tsconfig.json; Vite's
    // resolver does not read tsconfig `paths` on its own.
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    maxWorkers: '50%',
    // Clears every mock's call history before each test so shared `vi.fn()` mocks
    // declared at module scope in a test file never leak call counts across cases.
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        // Test setup and the shared realtime hook fakes are test-only support code,
        // exercised through the suites that import them rather than covered directly.
        'src/test/**',
        'src/test-utils/**',
        // Framework wiring with no branch logic of its own, proven by the Next.js
        // build and the Playwright journeys rather than unit coverage. The route
        // layouts exist solely to declare each route's `metadata` and return their
        // children unchanged.
        'src/app/**/layout.tsx',
        // Module-resolution probe with no runtime branches; asserted by its own spec.
        'src/probe/**',
      ],
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
});
