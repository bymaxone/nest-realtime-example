/**
 * Unit tests for RedisRevocationStore.
 *
 * Layer: unit.
 * Goal: revocation is reported from key existence; revoke sets a session-lifetime
 *       marker; unrevoke deletes it; the client is released on teardown.
 * Mocks: a minimal Redis double with exists/set/del/disconnect spies.
 */

import { SESSION_TTL_SECONDS } from '../../src/auth/auth.constants';
import { RedisRevocationStore, type RevocationRedis } from '../../src/auth/revocation.store';

interface RedisDouble extends RevocationRedis {
  exists: jest.Mock<Promise<number>, [string]>;
  set: jest.Mock<Promise<unknown>, [string, string, 'EX', number]>;
  del: jest.Mock<Promise<number>, [string]>;
  disconnect: jest.Mock<void, []>;
}

const buildRedis = (existsResult: number): RedisDouble => ({
  exists: jest.fn<Promise<number>, [string]>().mockResolvedValue(existsResult),
  set: jest.fn<Promise<unknown>, [string, string, 'EX', number]>().mockResolvedValue('OK'),
  del: jest.fn<Promise<number>, [string]>().mockResolvedValue(1),
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
   * Revoke.
   *
   * Revoking must write the namespaced marker with the session lifetime as its
   * TTL, so a revocation self-cleans once no session it kills could still be valid.
   */
  it('sets a session-lifetime marker on revoke', async () => {
    const redis = buildRedis(0);
    const store = new RedisRevocationStore(redis);

    await store.revoke('ana@acme');

    expect(redis.set).toHaveBeenCalledWith(
      'realtime:revoked:ana@acme',
      '1',
      'EX',
      SESSION_TTL_SECONDS,
    );
  });

  /**
   * Unrevoke.
   *
   * Clearing a revocation must delete the exact marker key so new sessions
   * authenticate again.
   */
  it('deletes the marker on unrevoke', async () => {
    const redis = buildRedis(1);
    const store = new RedisRevocationStore(redis);

    await store.unrevoke('ana@acme');

    expect(redis.del).toHaveBeenCalledWith('realtime:revoked:ana@acme');
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
