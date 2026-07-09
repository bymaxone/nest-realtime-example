/**
 * @fileoverview Resolution probe for @bymax-one/nest-realtime from the web app.
 * @layer test
 *
 * Proves that this ESM consumer loads the browser `./react` hooks and the
 * zero-dependency `./shared` subpath. It complements the api probe, which proves
 * the server `.` subpath under a CommonJS consumer, so between the two every
 * published subpath is exercised in both module systems.
 */

import {
  RealtimeProvider,
  usePresence,
  useRealtime,
  useRealtimeConnection,
} from '@bymax-one/nest-realtime/react';
import {
  ROOM_PREFIXES,
  type RealtimeEvent,
  type TransportMode,
} from '@bymax-one/nest-realtime/shared';
import { describe, expect, it } from 'vitest';

describe('@bymax-one/nest-realtime web subpath resolution', () => {
  it('exposes the realtime hooks and provider through the react subpath', () => {
    // Scenario: every live page imports these hooks and the shared provider from
    // './react'; under native ESM resolution they must all load as functions.
    expect(typeof useRealtime).toBe('function');
    expect(typeof useRealtimeConnection).toBe('function');
    expect(typeof usePresence).toBe('function');
    expect(typeof RealtimeProvider).toBe('function');
  });

  it('exposes shared room prefixes and event types through the shared subpath', () => {
    // Scenario: the web app reads room prefixes and types its events from
    // './shared'. The runtime constant proves value resolution; the typed sinks
    // prove the shared types resolve at compile time.
    expect(ROOM_PREFIXES.TENANT).toBe('tenant');
    const event: RealtimeEvent<{ ok: boolean }> = { id: '1', type: 'demo', data: { ok: true } };
    const mode: TransportMode = 'sse';
    expect(event.data.ok).toBe(true);
    expect(mode).toBe('sse');
  });
});
