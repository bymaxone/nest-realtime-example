/**
 * @fileoverview Single source of the typed realtime hook fakes for web unit tests.
 * @layer test-support
 *
 * The page and component tests mock `@bymax-one/nest-realtime/react` at the module
 * boundary rather than standing up a live transport. The return shapes of the three
 * hooks the app consumes (`useRealtimeContext`, `useRealtime`, `useRealtimeConnection`)
 * plus `usePresence` are declared once here so no test redeclares them, and the
 * builders default every field so a test states only what its scenario cares about.
 * Each `vi.mock` factory still lives in its own file (Vitest hoists it per module),
 * but the fakes it returns come from this shared source.
 */

import { vi } from 'vitest';

/**
 * One realtime event as the pages read it off a connection. `data` is optional
 * because some pages only read an event's `type` (e.g. a `connection:established`
 * marker used purely to trigger a reload).
 */
export interface FakeRealtimeEvent {
  readonly type: string;
  readonly data?: unknown;
  readonly id?: string;
}

/**
 * Return shape of `useRealtimeContext()`: the shared connection's event log plus
 * the most recent event, which pages use as a reload trigger.
 */
export interface RealtimeContextFake {
  readonly events: readonly FakeRealtimeEvent[];
  readonly lastEvent?: FakeRealtimeEvent;
}

/**
 * Return shape of `useRealtime()`: a live socket surface. Consumers read only the
 * subset they need (the chat page reads `emit`/`events`, the ticket and split
 * panels read `transport`/`lastEvent`), so every field is modelled here once.
 */
export interface RealtimeFake {
  readonly connected: boolean;
  readonly emit: (event: string, data: unknown) => void;
  readonly events: readonly FakeRealtimeEvent[];
  readonly lastEvent?: FakeRealtimeEvent;
  readonly transport: 'sse' | 'websocket';
}

/** Return shape of `useRealtimeConnection()`: connection state plus a reconnect. */
export interface RealtimeConnectionFake {
  readonly connected: boolean;
  readonly reconnect: () => void;
}

/** Return shape of `usePresence()`: the online roster for the caller's tenant. */
export interface PresenceFake {
  readonly onlineUserIds: readonly string[];
  readonly count: number;
}

/**
 * Build a `useRealtimeContext()` fake, defaulting to an empty event log.
 *
 * @param overrides - Fields to override on the default fake.
 * @returns The context fake.
 */
export function makeRealtimeContext(
  overrides: Partial<RealtimeContextFake> = {},
): RealtimeContextFake {
  return { events: [], ...overrides };
}

/**
 * Build a `useRealtime()` fake, defaulting to a disconnected socket with a spy emit.
 *
 * @param overrides - Fields to override on the default fake.
 * @returns The realtime fake.
 */
export function makeRealtime(overrides: Partial<RealtimeFake> = {}): RealtimeFake {
  return { connected: false, emit: vi.fn(), events: [], transport: 'sse', ...overrides };
}

/**
 * Build a `useRealtimeConnection()` fake, defaulting to disconnected with a spy reconnect.
 *
 * @param overrides - Fields to override on the default fake.
 * @returns The connection fake.
 */
export function makeRealtimeConnection(
  overrides: Partial<RealtimeConnectionFake> = {},
): RealtimeConnectionFake {
  return { connected: false, reconnect: vi.fn(), ...overrides };
}

/**
 * Build a `usePresence()` fake, defaulting to an empty roster.
 *
 * @param overrides - Fields to override on the default fake.
 * @returns The presence fake.
 */
export function makePresence(overrides: Partial<PresenceFake> = {}): PresenceFake {
  return { onlineUserIds: [], count: 0, ...overrides };
}

/**
 * Build a `connection:established` event carrying the given connection id, the
 * signal a page waits for before it can join rooms or emit.
 *
 * @param connectionId - The id the established event should carry.
 * @returns The scripted event.
 */
export function establishedEvent(connectionId: string): FakeRealtimeEvent {
  return { type: 'connection:established', data: { connectionId } };
}
