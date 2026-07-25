/**
 * Unit tests for createPresenceStorage.
 *
 * Layer: unit.
 * Goal: the shared Redis client always yields a RedisPresenceStorage, so the
 *       roster works on the single-instance loop and not only under the cluster
 *       profile, and the storage is scoped to the configured instance name.
 * Mocks: an in-memory presence client double and the config fixture.
 */

import { createPresenceStorage } from '../../src/realtime/presence.factory';
import { RedisPresenceStorage } from '../../src/realtime/redis-presence-storage';
import { buildTestConfig } from '../support/config.fixture';
import { asPresenceRedis, FakePresenceRedis } from '../support/fake-presence-redis';

describe('createPresenceStorage', () => {
  /**
   * Storage is always provisioned.
   *
   * Presence used to be gated on `PUBSUB_DRIVER=redis`, which left the roster
   * permanently empty on the documented development loop; it is now backed by
   * the same shared client on every profile.
   */
  it('builds a RedisPresenceStorage over the shared client', () => {
    const client = asPresenceRedis(new FakePresenceRedis());

    expect(createPresenceStorage(client, buildTestConfig())).toBeInstanceOf(RedisPresenceStorage);
  });

  /**
   * Client pass-through.
   *
   * Every instance must read and write the same Redis keyspace, so the storage
   * has to run against the client it was handed rather than open its own.
   */
  it('runs against the client it was given', async () => {
    const client = asPresenceRedis(new FakePresenceRedis());
    const storage = createPresenceStorage(client, buildTestConfig());

    await storage.setOnline('ana@acme', 'c1', 'acme');

    expect(await storage.listOnlineByTenant('acme')).toEqual(['ana@acme']);
  });

  /**
   * Ownership is scoped to the configured instance name.
   *
   * Reclaiming on boot is only safe when the identity survives a restart and never
   * collides with a peer, which is exactly what the instance name provides: a
   * differently-named instance must not release another's connections.
   */
  it('scopes reclaimable ownership to the configured instance name', async () => {
    const client = asPresenceRedis(new FakePresenceRedis());
    const appA = createPresenceStorage(client, buildTestConfig({ instanceName: 'app-a' }));
    const appB = createPresenceStorage(client, buildTestConfig({ instanceName: 'app-b' }));

    await appA.setOnline('ana@acme', 'c1', 'acme');

    // app-b owns nothing, so its reclaim must leave app-a's connection alone.
    expect(await appB.reclaimOwnConnections()).toBe(0);
    expect(await appA.isOnline('ana@acme')).toBe(true);

    expect(await appA.reclaimOwnConnections()).toBe(1);
    expect(await appA.isOnline('ana@acme')).toBe(false);
  });
});
