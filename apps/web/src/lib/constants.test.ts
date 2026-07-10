/**
 * @fileoverview Unit tests for the environment-derived base URL constants.
 * @layer test
 *
 * The module reads `process.env` at import time, so each scenario resets the
 * module registry and re-imports after adjusting the environment.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

describe('constants', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('defaults to localhost when no env vars are set', async () => {
    // Scenario: local `pnpm dev` without a `.env` file.
    delete process.env['NEXT_PUBLIC_API_URL'];
    delete process.env['NEXT_PUBLIC_WS_URL'];
    const { API_BASE_URL, SSE_EVENTS_URL, WS_URL } = await import('./constants');
    expect(API_BASE_URL).toBe('http://localhost:3001/api');
    expect(SSE_EVENTS_URL).toBe('http://localhost:3001/api/events');
    expect(WS_URL).toBe('ws://localhost:3001/live');
  });

  it('strips a trailing slash from configured env values', async () => {
    // Scenario: an operator's `.env` accidentally includes a trailing slash.
    process.env['NEXT_PUBLIC_API_URL'] = 'https://api.example.com/';
    process.env['NEXT_PUBLIC_WS_URL'] = 'wss://api.example.com/live/';
    const { API_BASE_URL, WS_URL } = await import('./constants');
    expect(API_BASE_URL).toBe('https://api.example.com/api');
    expect(WS_URL).toBe('wss://api.example.com/live');
  });
});
