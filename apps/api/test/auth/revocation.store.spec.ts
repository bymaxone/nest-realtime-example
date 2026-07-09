/**
 * Unit tests for RedisRevocationStore.
 *
 * Layer: unit.
 * Goal: revocation is reported from key existence and the client is released.
 * Mocks: a minimal Redis double with exists/disconnect spies.
 */

import { RedisRevocationStore, type RevocationRedis } from '../../src/auth/revocation.store';

interface RedisDouble extends RevocationRedis {
  exists: jest.Mock<Promise<number>, [string]>;
  disconnect: jest.Mock<void, []>;
}

const buildRedis = (existsResult: number): RedisDouble => ({
  exists: jest.fn<Promise<number>, [string]>().mockResolvedValue(existsResult),
  disconnect: jest.fn<void, []>(),
});

describe('RedisRevocationStore', () => {
  /**
   * Revoked user.
   *
   * A present `realtime:revoked:{userId}` key means the user is revoked, so the
   * store must report true and query the exact namespaced key.
   */
  it('reports revoked when the marker key exists', async () => {
    const redis = buildRedis(1);
    const store = new RedisRevocationStore(redis);

    await expect(store.isRevoked('ana@acme')).resolves.toBe(true);
    expect(redis.exists).toHaveBeenCalledWith('realtime:revoked:ana@acme');
  });

  /**
   * Active user.
   *
   * A missing marker (exists returns 0) means the user is still valid.
   */
  it('reports not revoked when the marker key is absent', async () => {
    const store = new RedisRevocationStore(buildRedis(0));

    await expect(store.isRevoked('bob@acme')).resolves.toBe(false);
  });

  /**
   * Teardown.
   *
   * On module destroy the store must release the shared client so no socket
   * lingers past shutdown.
   */
  it('disconnects the client on module destroy', () => {
    const redis = buildRedis(0);

    new RedisRevocationStore(redis).onModuleDestroy();

    expect(redis.disconnect).toHaveBeenCalledTimes(1);
  });
});
