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
    presence = new RedisPresenceStorage({ client: asPresenceRedis(redis), instanceId: 'app-a' });
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
   * Arrival and departure reporting.
   *
   * The announcement in PresenceTracker is driven off these counts, so the first
   * connection must report exactly 1 and the last removal exactly 0, while the
   * connections in between report neither. This is what makes the roster
   * transition announceable exactly once.
   */
  it('reports the live connection count so a caller can spot the transition', async () => {
    expect(await presence.addConnection('ana@acme', 'c1', 'acme')).toBe(1);
    expect(await presence.addConnection('ana@acme', 'c2', 'acme')).toBe(2);

    expect(await presence.removeConnection('ana@acme', 'c2')).toBe(1);
    expect(await presence.removeConnection('ana@acme', 'c1')).toBe(0);
  });

  /**
   * Re-adding the same connection id.
   *
   * The count is a set cardinality, not an increment, so a duplicated connect for
   * an id already present must not inflate it and strand the user online.
   */
  it('does not inflate the count when the same connection is added twice', async () => {
    expect(await presence.addConnection('ana@acme', 'c1', 'acme')).toBe(1);
    expect(await presence.addConnection('ana@acme', 'c1', 'acme')).toBe(1);

    expect(await presence.removeConnection('ana@acme', 'c1')).toBe(0);
    expect(await presence.isOnline('ana@acme')).toBe(false);
  });

  /**
   * setOnline transaction failure.
   *
   * A failed transaction during setOnline must surface as a thrown error so the
   * caller never assumes presence was recorded.
   */
  it('throws when the setOnline transaction fails', async () => {
    redis.failNextTransaction();

    await expect(presence.setOnline('ana@acme', 'c1', 'acme')).rejects.toThrow(
      'transaction failed',
    );
  });

  /**
   * setOffline removal transaction failure.
   *
   * A failed removal must surface as a thrown error so the caller never treats a
   * connection as released, and never announces a departure, on a write that did
   * not land.
   */
  it('throws when the setOffline removal transaction fails', async () => {
    await presence.setOnline('ana@acme', 'c1', 'acme');
    redis.failNextTransaction();

    await expect(presence.setOffline('ana@acme', 'c1')).rejects.toThrow('transaction failed');
  });

  /**
   * setOffline cleanup transaction failure.
   *
   * A disconnect runs two transactions; a failure in the second (the index
   * cleanup on the final disconnect) must surface rather than silently leaving
   * the user stranded in the tenant and global indexes.
   */
  it('throws when the setOffline cleanup transaction fails', async () => {
    await presence.setOnline('ana@acme', 'c1', 'acme');
    // Let the removal succeed so the armed failure lands on the cleanup after it.
    redis.failNextTransaction(1);

    await expect(presence.setOffline('ana@acme', 'c1')).rejects.toThrow('transaction failed');
  });

  /**
   * Discarded connect transaction.
   *
   * A `MULTI` resolving to `null` ran none of its queued writes, which would drop
   * the connection from presence entirely: the user would be missing from the
   * roster while holding a live stream, and absent from the ownership set too, so
   * the startup reclaim could not recover it either. The writes are idempotent and
   * must be reissued, and the count then re-read so the arrival is still reported.
   */
  it('still records the connection when the connect transaction is discarded', async () => {
    redis.nullNextTransaction();

    expect(await presence.addConnection('ana@acme', 'c1', 'acme')).toBe(1);

    expect(await presence.isOnline('ana@acme')).toBe(true);
    expect(await presence.listOnlineByTenant('acme')).toEqual(['ana@acme']);
    expect(await presence.countOnline()).toBe(1);
    // The ownership entry is written too, so a reclaim can still release it.
    expect(await presence.reclaimOwnConnections()).toBe(1);
  });

  /**
   * Discarded connect transaction for a tenantless connection.
   *
   * The direct reissue must skip the tenant index exactly as the transaction
   * would have, so a connection carrying no tenant is recorded without touching
   * a tenant key it never belonged to.
   */
  it('records a tenantless connection when the connect transaction is discarded', async () => {
    redis.nullNextTransaction();

    expect(await presence.addConnection('ghost', 'c1')).toBe(1);

    expect(await presence.isOnline('ghost')).toBe(true);
    expect(await presence.countOnline()).toBe(1);
  });

  /**
   * Discarded cleanup transaction on the final disconnect.
   *
   * A `MULTI` that resolves to `null` ran none of its queued writes. Accepting
   * that as success would leave the departed user in the tenant and global
   * indexes with an empty connection set, so the roster would keep reporting a
   * ghost. The cleanup is idempotent and must be reissued directly instead.
   */
  it('still clears the indexes when the cleanup transaction is discarded', async () => {
    await presence.setOnline('ana@acme', 'c1', 'acme');
    // The removal transaction succeeds; the cleanup that follows is discarded.
    redis.nullNextTransaction(1);

    expect(await presence.removeConnection('ana@acme', 'c1')).toBe(0);

    expect(await presence.listOnlineByTenant('acme')).toEqual([]);
    expect(await presence.countOnline()).toBe(0);
    expect(await presence.isOnline('ana@acme')).toBe(false);
  });

  /**
   * Discarded cleanup for a connection that never carried a tenant.
   *
   * The direct reissue must skip the tenant index exactly as the transaction
   * would have, so a tenantless user is cleaned up without touching a tenant key
   * that was never written.
   */
  it('clears a tenantless user when the cleanup transaction is discarded', async () => {
    await presence.setOnline('ghost', 'c1');
    redis.nullNextTransaction(1);

    expect(await presence.removeConnection('ghost', 'c1')).toBe(0);

    expect(await presence.countOnline()).toBe(0);
    expect(await presence.isOnline('ghost')).toBe(false);
  });

  /**
   * Null transaction result on disconnect.
   *
   * The same fallback on the removal path: with no trailing `scard` the remaining
   * count is re-read, so a still-connected user is not reported as departed.
   */
  it('re-reads the count when a disconnect transaction result is null', async () => {
    await presence.setOnline('ana@acme', 'c1', 'acme');
    await presence.setOnline('ana@acme', 'c2', 'acme');
    redis.nullNextTransaction();

    expect(await presence.removeConnection('ana@acme', 'c1')).toBe(2);
  });

  /**
   * Crash recovery.
   *
   * A process killed without running its shutdown hooks leaves its connection ids
   * in the user sets, which would report a dead stream as online forever. The
   * restart must release exactly the connections it owned and clear its own set.
   */
  it('releases the connections it owned when reclaiming on boot', async () => {
    await presence.setOnline('ana@acme', 'c1', 'acme');
    await presence.setOnline('ana@acme', 'c2', 'acme');
    expect(await presence.isOnline('ana@acme')).toBe(true);

    expect(await presence.reclaimOwnConnections()).toBe(2);

    expect(await presence.isOnline('ana@acme')).toBe(false);
    expect(await presence.listOnlineByTenant('acme')).toEqual([]);
    // The ownership set is cleared, so a second boot has nothing left to release.
    expect(await presence.reclaimOwnConnections()).toBe(0);
  });

  /**
   * Hand-edited ownership entry.
   *
   * The ownership set lives in a shared Redis an operator can poke at; a member
   * that is not a user/connection pair must be skipped rather than mis-parsed into
   * a `setOffline` for the wrong key. It must also stay out of the count, which
   * reports released connections in a startup log line, and it must still be
   * dropped along with the rest of the set.
   */
  it('skips an ownership entry that is not a user and connection pair', async () => {
    await presence.setOnline('ana@acme', 'c1', 'acme');
    await redis.sadd('presence:instance:app-a', 'hand-edited-garbage');

    expect(await presence.reclaimOwnConnections()).toBe(1);

    expect(await presence.isOnline('ana@acme')).toBe(false);
    // The whole ownership set is cleared, garbage included, so a second boot
    // finds nothing left to release.
    expect(await presence.reclaimOwnConnections()).toBe(0);
  });
});
