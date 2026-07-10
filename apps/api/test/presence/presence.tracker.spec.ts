/**
 * Unit tests for PresenceTracker.
 *
 * Layer: unit.
 * Goal: connect marks a user online with its tenant, disconnect marks it offline,
 *       and with no presence configured both hooks are safe no-ops.
 * Mocks: a RedisPresenceStorage double (or undefined for memory mode).
 */

import type { ConnectionEventMeta } from '@bymax-one/nest-realtime';

import type { RedisPresenceStorage } from '../../src/realtime/redis-presence-storage';
import { PresenceTracker } from '../../src/presence/presence.tracker';

/** Build a connection meta fixture with overridable identity fields. */
function meta(overrides: Partial<ConnectionEventMeta> = {}): ConnectionEventMeta {
  return {
    connectionId: 'c1',
    userId: 'ana@acme',
    tenantId: 'acme',
    transport: 'sse',
    ip: '127.0.0.1',
    userAgent: undefined,
    connectedAt: new Date(),
    ...overrides,
  };
}

describe('PresenceTracker', () => {
  /**
   * Connect marks online.
   *
   * On connect the tracker must record the user online with its connection id and
   * tenant so the roster reflects the new stream.
   */
  it('marks a connection online on connect', async () => {
    const presence = { setOnline: jest.fn().mockResolvedValue(undefined) };
    const tracker = new PresenceTracker(presence as unknown as RedisPresenceStorage);

    await tracker.onConnect(meta());

    expect(presence.setOnline).toHaveBeenCalledWith('ana@acme', 'c1', 'acme');
  });

  /**
   * Disconnect marks offline.
   *
   * On disconnect the tracker must record the connection offline so a closed stream
   * leaves the roster.
   */
  it('marks a connection offline on disconnect', async () => {
    const presence = { setOffline: jest.fn().mockResolvedValue(undefined) };
    const tracker = new PresenceTracker(presence as unknown as RedisPresenceStorage);

    await tracker.onDisconnect(meta({ connectionId: 'c2' }));

    expect(presence.setOffline).toHaveBeenCalledWith('ana@acme', 'c2');
  });

  /**
   * Memory-mode no-op.
   *
   * With no presence storage configured, both hooks must be safe no-ops so a
   * single-instance boot carries no presence state.
   */
  it('is a no-op when no presence storage is configured', async () => {
    const tracker = new PresenceTracker(undefined);

    await expect(tracker.onConnect(meta())).resolves.toBeUndefined();
    await expect(tracker.onDisconnect(meta())).resolves.toBeUndefined();
  });
});
