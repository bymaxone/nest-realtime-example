/**
 * Unit tests for ConnectionEventLog.
 *
 * Layer: unit.
 * Goal: connects are recorded oldest-first per user; a disconnect stamps the close
 *       time and reason; the log is bounded; an unknown disconnect is a no-op.
 * Mocks: none; hand-built ConnectionEventMeta values drive the log.
 */

import type { ConnectionEventMeta } from '@bymax-one/nest-realtime';

import { ConnectionEventLog } from '../../src/lifecycle/connection-event-log';

/** Build a connection meta for a user with a specific id and connect time. */
function meta(connectionId: string, userId: string, connectedAt: string): ConnectionEventMeta {
  return {
    connectionId,
    userId,
    tenantId: 'acme',
    transport: 'sse',
    ip: '127.0.0.1',
    userAgent: undefined,
    connectedAt: new Date(connectedAt),
  };
}

describe('ConnectionEventLog', () => {
  /**
   * Connect + timeline order.
   *
   * The timeline must contain only the requested user's connections, oldest first,
   * with unclosed connections carrying null close fields.
   */
  it('records connects oldest-first per user', () => {
    const log = new ConnectionEventLog();
    log.onConnect(meta('c2', 'ana@acme', '2026-07-09T12:00:02.000Z'));
    log.onConnect(meta('c1', 'ana@acme', '2026-07-09T12:00:01.000Z'));
    log.onConnect(meta('g1', 'gil@globex', '2026-07-09T12:00:03.000Z'));

    const timeline = log.timeline('ana@acme');

    expect(timeline.map((entry) => entry.connectionId)).toEqual(['c1', 'c2']);
    expect(timeline[0]).toEqual({
      connectionId: 'c1',
      userId: 'ana@acme',
      connectedAt: '2026-07-09T12:00:01.000Z',
      evictedAt: null,
      reason: null,
    });
  });

  /**
   * Disconnect stamps reason.
   *
   * On disconnect the matching entry must record when and why it closed, which is
   * how an eviction (REALTIME_TOO_MANY_CONNECTIONS) becomes visible.
   */
  it('stamps the close time and reason on disconnect', () => {
    const log = new ConnectionEventLog();
    log.onConnect(meta('c1', 'ana@acme', '2026-07-09T12:00:01.000Z'));

    log.onDisconnect({
      ...meta('c1', 'ana@acme', '2026-07-09T12:00:01.000Z'),
      reason: 'REALTIME_TOO_MANY_CONNECTIONS',
      durationMs: 10,
    });

    const [entry] = log.timeline('ana@acme');
    expect(entry?.reason).toBe('REALTIME_TOO_MANY_CONNECTIONS');
    expect(typeof entry?.evictedAt).toBe('string');
  });

  /**
   * Missing reason.
   *
   * A disconnect with no reason must record null rather than undefined, keeping the
   * timeline shape stable.
   */
  it('records a null reason when none is given', () => {
    const log = new ConnectionEventLog();
    log.onConnect(meta('c1', 'ana@acme', '2026-07-09T12:00:01.000Z'));

    log.onDisconnect({ ...meta('c1', 'ana@acme', '2026-07-09T12:00:01.000Z'), durationMs: 5 });

    expect(log.timeline('ana@acme')[0]?.reason).toBeNull();
  });

  /**
   * Unknown disconnect.
   *
   * A disconnect for a connection that was never recorded must be a safe no-op.
   */
  it('ignores a disconnect for an unknown connection', () => {
    const log = new ConnectionEventLog();

    log.onDisconnect({ ...meta('ghost', 'ana@acme', '2026-07-09T12:00:01.000Z'), durationMs: 1 });

    expect(log.timeline('ana@acme')).toEqual([]);
  });

  /**
   * Bounded history.
   *
   * The log caps its history at 500 entries, dropping the oldest, so a long-running
   * instance never grows unboundedly.
   */
  it('drops the oldest entry beyond capacity', () => {
    const log = new ConnectionEventLog();
    for (let i = 0; i < 501; i += 1) {
      const stamp = new Date(1_700_000_000_000 + i).toISOString();
      log.onConnect(meta(`c${i}`, 'ana@acme', stamp));
    }

    const timeline = log.timeline('ana@acme');
    expect(timeline.length).toBe(500);
    expect(timeline.some((entry) => entry.connectionId === 'c0')).toBe(false);
  });
});
