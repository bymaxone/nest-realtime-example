/**
 * Unit tests for RedisPresenceStorage.
 *
 * Layer: unit.
 * Goal: multi-tab presence stays online until the last tab closes, tenant indexes
 *       are scoped and cleaned on final disconnect, and connection ownership is
 *       answered for the cross-instance kill switch.
 * Mocks: an in-memory set/string ioredis double (fake-presence-redis).
 */

import { RedisPresenceStorage } from '../../src/realtime/redis-presence-storage';
import { asPresenceRedis, FakePresenceRedis } from '../support/fake-presence-redis';

describe('RedisPresenceStorage', () => {
  let redis: FakePresenceRedis;
  let presence: RedisPresenceStorage;

  beforeEach(() => {
    redis = new FakePresenceRedis();
    presence = new RedisPresenceStorage({ client: asPresenceRedis(redis) });
  });

  /**
   * Multi-tab online lifecycle.
   *
   * A user with two tabs must stay online until both close: the first setOffline
   * leaves them online, and only the second removes them from every index.
   */
  it('keeps a user online until the last of two tabs closes', async () => {
    await presence.setOnline('ana@acme', 'c1', 'acme');
    await presence.setOnline('ana@acme', 'c2', 'acme');
    expect(await presence.isOnline('ana@acme')).toBe(true);
    expect(await presence.countOnline()).toBe(1);
    expect(await presence.listOnlineByTenant('acme')).toEqual(['ana@acme']);

    await presence.setOffline('ana@acme', 'c1');
    expect(await presence.isOnline('ana@acme')).toBe(true);
    expect(await presence.listOnlineByTenant('acme')).toEqual(['ana@acme']);

    await presence.setOffline('ana@acme', 'c2');
    expect(await presence.isOnline('ana@acme')).toBe(false);
    expect(await presence.countOnline()).toBe(0);
    expect(await presence.listOnlineByTenant('acme')).toEqual([]);
  });

  /**
   * Tenant scoping.
   *
   * A tenant roster must contain only its own users, so a presence query for one
   * tenant never reveals another tenant's online users.
   */
  it('scopes online users to their tenant', async () => {
    await presence.setOnline('ana@acme', 'c1', 'acme');
    await presence.setOnline('gil@globex', 'c2', 'globex');

    expect(await presence.listOnlineByTenant('acme')).toEqual(['ana@acme']);
    expect(await presence.listOnlineByTenant('globex')).toEqual(['gil@globex']);
    expect(await presence.countOnline()).toBe(2);
  });

  /**
   * Tenantless connection.
   *
   * A connection with no tenant must still count toward online presence and clean
   * up on disconnect without touching any tenant index.
   */
  it('tracks a tenantless connection and cleans up without a tenant index', async () => {
    await presence.setOnline('ghost', 'c1');
    expect(await presence.isOnline('ghost')).toBe(true);
    expect(await presence.countOnline()).toBe(1);

    await presence.setOffline('ghost', 'c1');
    expect(await presence.isOnline('ghost')).toBe(false);
    expect(await presence.countOnline()).toBe(0);
  });

  /**
   * Connection ownership.
   *
   * The storage must answer whether a connection id belongs to a user, which the
   * cross-instance kill switch uses to authorize a disconnect.
   */
  it('reports whether a connection belongs to a user', async () => {
    await presence.setOnline('ana@acme', 'c1', 'acme');

    expect(await presence.isConnectionOwnedByUser('ana@acme', 'c1')).toBe(true);
    expect(await presence.isConnectionOwnedByUser('ana@acme', 'other')).toBe(false);
    expect(await presence.isConnectionOwnedByUser('bob@acme', 'c1')).toBe(false);
  });

  /**
   * setOnline pipeline failure.
   *
   * A failed pipeline during setOnline must surface as a thrown error so the caller
   * never assumes presence was recorded.
   */
  it('throws when the setOnline pipeline fails', async () => {
    redis.failNextPipeline();

    await expect(presence.setOnline('ana@acme', 'c1', 'acme')).rejects.toThrow('pipeline failed');
  });

  /**
   * setOffline cleanup pipeline failure.
   *
   * A failed cleanup pipeline on the final disconnect must surface as a thrown
   * error rather than silently leaving stale indexes.
   */
  it('throws when the setOffline cleanup pipeline fails', async () => {
    await presence.setOnline('ana@acme', 'c1', 'acme');
    redis.failNextPipeline();

    await expect(presence.setOffline('ana@acme', 'c1')).rejects.toThrow('pipeline failed');
  });

  /**
   * Null pipeline result.
   *
   * ioredis can resolve `pipeline().exec()` to `null`; setOnline must treat that as
   * no per-command error and resolve rather than throwing on the null result.
   */
  it('resolves when a pipeline result is null', async () => {
    redis.nullNextPipeline();

    await expect(presence.setOnline('ana@acme', 'c1', 'acme')).resolves.toBeUndefined();
  });
});
