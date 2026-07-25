/**
 * Unit tests for PresenceTracker.
 *
 * Layer: unit.
 * Goal: connect marks a user online with its tenant and announces an arrival only
 *       on the connection that brought them online; disconnect marks it offline
 *       and announces a departure only on the one that took them offline; the
 *       decision comes from the storage write's own count, never a separate read.
 * Mocks: a RedisPresenceStorage double, and a ModuleRef double resolving a
 *        RealtimeService whose tenant emit is a spy.
 */

import type { ConnectionEventMeta } from '@bymax-one/nest-realtime';
import type { ModuleRef } from '@nestjs/core';

import { PresenceTracker } from '../../src/presence/presence.tracker';
import type { RedisPresenceStorage } from '../../src/realtime/redis-presence-storage';

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

/** A ModuleRef double whose `get` resolves a RealtimeService with a spied emit. */
function moduleRefWith(emitToTenant: jest.Mock): ModuleRef {
  return { get: () => ({ emitToTenant }) } as unknown as ModuleRef;
}

describe('PresenceTracker', () => {
  /**
   * Boot releases what a dead run left behind.
   *
   * A process killed without running its shutdown hooks leaves its connection ids
   * in the presence sets, pinning those users online; the restart must clear
   * exactly its own.
   */
  it('reclaims its own stale connections on bootstrap', async () => {
    const presence = { reclaimOwnConnections: jest.fn().mockResolvedValue(3) };
    const tracker = new PresenceTracker(
      presence as unknown as RedisPresenceStorage,
      moduleRefWith(jest.fn()),
    );

    await tracker.onApplicationBootstrap();

    expect(presence.reclaimOwnConnections).toHaveBeenCalledTimes(1);
  });

  /**
   * A clean previous shutdown leaves nothing to reclaim.
   *
   * The log line only belongs there when something was actually released, so a
   * zero must stay silent rather than reporting routine startup noise.
   */
  it('reclaims silently when nothing was left behind', async () => {
    const presence = { reclaimOwnConnections: jest.fn().mockResolvedValue(0) };
    const tracker = new PresenceTracker(
      presence as unknown as RedisPresenceStorage,
      moduleRefWith(jest.fn()),
    );

    await expect(tracker.onApplicationBootstrap()).resolves.toBeUndefined();
  });

  /**
   * A reclaim failure must not stop the boot.
   *
   * Presence is a best-effort mirror; an unreachable Redis at startup would
   * otherwise take the whole application down.
   */
  it('absorbs a failure while reclaiming on bootstrap', async () => {
    const presence = {
      reclaimOwnConnections: jest.fn().mockRejectedValue(new Error('Connection is closed.')),
    };
    const tracker = new PresenceTracker(
      presence as unknown as RedisPresenceStorage,
      moduleRefWith(jest.fn()),
    );

    await expect(tracker.onApplicationBootstrap()).resolves.toBeUndefined();
  });

  /**
   * Connect marks online and announces the arrival.
   *
   * On connect the tracker must record the user online with its connection id and
   * tenant, and announce once the storage reports this was their only connection.
   */
  it('marks a connection online on connect and announces the arrival', async () => {
    const presence = { addConnection: jest.fn().mockResolvedValue(1) };
    const emitToTenant = jest.fn().mockResolvedValue(undefined);
    const tracker = new PresenceTracker(
      presence as unknown as RedisPresenceStorage,
      moduleRefWith(emitToTenant),
    );

    await tracker.onConnect(meta());

    expect(presence.addConnection).toHaveBeenCalledWith('ana@acme', 'c1', 'acme');
    expect(emitToTenant).toHaveBeenCalledWith('acme', 'presence:online', { userId: 'ana@acme' });
  });

  /**
   * A second tab is not a second arrival.
   *
   * Storage is keyed per connection, so a user opening another stream is still the
   * same roster entry. The storage reporting a count above one is what identifies
   * it, so announcing again would double-report them.
   */
  it('does not announce an arrival when the user already held a connection', async () => {
    const presence = { addConnection: jest.fn().mockResolvedValue(2) };
    const emitToTenant = jest.fn().mockResolvedValue(undefined);
    const tracker = new PresenceTracker(
      presence as unknown as RedisPresenceStorage,
      moduleRefWith(emitToTenant),
    );

    await tracker.onConnect(meta({ connectionId: 'c2' }));

    expect(presence.addConnection).toHaveBeenCalledWith('ana@acme', 'c2', 'acme');
    expect(emitToTenant).not.toHaveBeenCalled();
  });

  /**
   * Disconnect marks offline.
   *
   * On disconnect the tracker must record the connection offline so a closed stream
   * leaves the roster, and announce the departure once nothing of the user remains.
   */
  it('marks a connection offline on disconnect and announces the departure', async () => {
    const presence = { removeConnection: jest.fn().mockResolvedValue(0) };
    const emitToTenant = jest.fn().mockResolvedValue(undefined);
    const tracker = new PresenceTracker(
      presence as unknown as RedisPresenceStorage,
      moduleRefWith(emitToTenant),
    );

    await tracker.onDisconnect(meta({ connectionId: 'c2' }));

    expect(presence.removeConnection).toHaveBeenCalledWith('ana@acme', 'c2');
    expect(emitToTenant).toHaveBeenCalledWith('acme', 'presence:offline', { userId: 'ana@acme' });
  });

  /**
   * Closing one of several tabs is not a departure.
   *
   * The user is still online through another stream, which the storage reports as
   * a non-zero remaining count, so the roster must not drop them.
   */
  it('does not announce a departure while another connection remains', async () => {
    const presence = { removeConnection: jest.fn().mockResolvedValue(1) };
    const emitToTenant = jest.fn().mockResolvedValue(undefined);
    const tracker = new PresenceTracker(
      presence as unknown as RedisPresenceStorage,
      moduleRefWith(emitToTenant),
    );

    await tracker.onDisconnect(meta());

    expect(emitToTenant).not.toHaveBeenCalled();
  });

  /**
   * Concurrent connects announce an arrival exactly once.
   *
   * The library fires lifecycle hooks without awaiting them, so two connections for
   * one user interleave. Only the call the storage told it was first may announce;
   * a read-then-write would have let both see "offline" and announce twice.
   */
  it('announces one arrival when two connections for a user race', async () => {
    const presence = {
      addConnection: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2),
    };
    const emitToTenant = jest.fn().mockResolvedValue(undefined);
    const tracker = new PresenceTracker(
      presence as unknown as RedisPresenceStorage,
      moduleRefWith(emitToTenant),
    );

    await Promise.all([
      tracker.onConnect(meta({ connectionId: 'c1' })),
      tracker.onConnect(meta({ connectionId: 'c2' })),
    ]);

    expect(emitToTenant).toHaveBeenCalledTimes(1);
    expect(emitToTenant).toHaveBeenCalledWith('acme', 'presence:online', { userId: 'ana@acme' });
  });

  /**
   * Concurrent disconnects announce a departure exactly once.
   *
   * The mirror of the arrival race: only the call that took the last connection
   * away may announce, so two closing tabs do not double-report the departure.
   */
  it('announces one departure when two disconnects for a user race', async () => {
    const presence = {
      removeConnection: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0),
    };
    const emitToTenant = jest.fn().mockResolvedValue(undefined);
    const tracker = new PresenceTracker(
      presence as unknown as RedisPresenceStorage,
      moduleRefWith(emitToTenant),
    );

    await Promise.all([
      tracker.onDisconnect(meta({ connectionId: 'c1' })),
      tracker.onDisconnect(meta({ connectionId: 'c2' })),
    ]);

    expect(emitToTenant).toHaveBeenCalledTimes(1);
    expect(emitToTenant).toHaveBeenCalledWith('acme', 'presence:offline', { userId: 'ana@acme' });
  });

  /**
   * Tenant-less connections are not announced.
   *
   * Presence is tenant-scoped, so a connection carrying no tenant has no audience
   * to announce to.
   */
  it('does not announce when the connection carries no tenant', async () => {
    const presence = { addConnection: jest.fn().mockResolvedValue(1) };
    const emitToTenant = jest.fn().mockResolvedValue(undefined);
    const tracker = new PresenceTracker(
      presence as unknown as RedisPresenceStorage,
      moduleRefWith(emitToTenant),
    );

    await tracker.onConnect(meta({ tenantId: undefined }));

    expect(emitToTenant).not.toHaveBeenCalled();
  });

  /**
   * Storage outage degrades the roster, never the connection.
   *
   * These hooks run on the connection lifecycle path, including during shutdown
   * after the shared Redis client has been released, so a rejection must be
   * absorbed rather than thrown back into the library's dispatch.
   */
  it('absorbs a storage failure on both hooks', async () => {
    const failure = new Error('Connection is closed.');
    const presence = {
      addConnection: jest.fn().mockRejectedValue(failure),
      removeConnection: jest.fn().mockRejectedValue(failure),
    };
    const tracker = new PresenceTracker(
      presence as unknown as RedisPresenceStorage,
      moduleRefWith(jest.fn()),
    );

    await expect(tracker.onConnect(meta())).resolves.toBeUndefined();
    await expect(tracker.onDisconnect(meta())).resolves.toBeUndefined();
  });
});
