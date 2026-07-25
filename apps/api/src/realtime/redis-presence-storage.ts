/**
 * @fileoverview Redis set implementation of the library's `IPresenceStorage`.
 * @layer realtime
 *
 * A sanctioned consumer-side presence adapter, truthful across instances and
 * multiple tabs. Each user's live connection ids live in a set under
 * `presence:user:{userId}`, so a user with two tabs stays online until both close;
 * a per-tenant set (`presence:tenant:{tenantId}`) indexes which users are online in
 * each tenant, keeping presence tenant-scoped so a query for one tenant never
 * reveals another's users; and a global set (`presence:online`) backs an O(1)
 * count. A small `presence:user:{userId}:tenant` string remembers a user's tenant
 * so the tenant index can be cleaned on the final disconnect, since `setOffline`
 * receives no tenant id. The class also answers "does this user own this
 * connection?" cluster-wide, which the kill switch uses to authorize a
 * cross-instance disconnect.
 *
 * Crash recovery: entries are removed on disconnect, so a process killed without
 * running its shutdown hooks would leave its connections in the sets forever and
 * pin those users online. Each instance therefore also records its own live
 * connection ids under `presence:instance:{instanceId}`, and reclaims that set on
 * boot: since the instance id is stable across a restart, an instance cleans up
 * exactly the connections it owned in its previous life and never another
 * instance's. That keeps the sets self-healing without a heartbeat TTL, which
 * would have to guess how long an idle stream may live. This requires
 * `INSTANCE_NAME` to be unique per running process; the cluster profile gives each
 * container its own, and `.env.example` says so.
 *
 * Transition reporting: {@link RedisPresenceStorage.addConnection} and
 * {@link RedisPresenceStorage.removeConnection} return the user's live connection
 * count as part of the same `MULTI`, so a caller learns whether it was the one
 * that brought the user online or took them offline without a separate read.
 * Lifecycle hooks are fire-and-forget, so two connections for one user do
 * interleave; deriving the transition from the atomic write instead of a
 * read-then-write is what keeps the announcement exactly-once.
 */

import type { IPresenceStorage } from '@bymax-one/nest-realtime';
import type { Redis } from 'ioredis';

/** Key of the global set of every online user id. */
const GLOBAL_ONLINE_KEY = 'presence:online';

/**
 * Separator joining a user id and a connection id inside an instance's own set.
 *
 * A reclaim needs both halves, because `setOffline` is keyed by user. A newline
 * cannot occur in either id (both are a seeded username or a UUID/socket id), so
 * the pair round-trips unambiguously.
 */
const OWNER_SEPARATOR = '\n';

/** Construction options for {@link RedisPresenceStorage}. */
export interface RedisPresenceStorageOptions {
  /** The ioredis client every presence operation runs against. */
  readonly client: Redis;
  /**
   * Stable identity of the running instance, used to track and later reclaim the
   * connections this process owns. Must survive a restart (the configured instance
   * name does; a per-boot random id would not).
   */
  readonly instanceId: string;
}

/** Throw the first error reported by a transaction's command results. */
function throwOnTransactionError(results: Array<[Error | null, unknown]> | null): void {
  for (const [error] of results ?? []) {
    if (error) throw error;
  }
}

/**
 * Redis-backed presence storage keyed by per-user connection sets.
 *
 * Every method is instance-agnostic: because the sets live in the shared Redis,
 * a user connected on one instance is reported online by every instance.
 */
export class RedisPresenceStorage implements IPresenceStorage {
  private readonly client: Redis;
  private readonly instanceId: string;

  /**
   * Build the presence storage.
   *
   * @param options - The Redis client backing every set and index, plus the owning
   *   instance's stable id.
   */
  constructor(options: RedisPresenceStorageOptions) {
    this.client = options.client;
    this.instanceId = options.instanceId;
  }

  /** Key of a user's connection-id set. */
  private userKey(userId: string): string {
    return `presence:user:${userId}`;
  }

  /** Key of the set of connections this instance currently owns. */
  private instanceKey(): string {
    return `presence:instance:${this.instanceId}`;
  }

  /** Key of the string remembering a user's tenant for cleanup. */
  private userTenantKey(userId: string): string {
    return `presence:user:${userId}:tenant`;
  }

  /** Key of a tenant's online-user set. */
  private tenantKey(tenantId: string): string {
    return `presence:tenant:${tenantId}`;
  }

  /**
   * Read the trailing `scard` of a presence transaction.
   *
   * ioredis resolves `exec()` to `null` in some error modes, so the count is
   * re-read directly when the transaction reported none rather than guessed: a
   * missing result must never be mistaken for "no connections left", which would
   * announce a departure for a user who is still here.
   *
   * @param results - The per-command results of the transaction.
   * @param userId - The user whose connection set the count describes.
   * @returns The user's live connection count.
   */
  private async liveCount(
    results: Array<[Error | null, unknown]> | null,
    userId: string,
  ): Promise<number> {
    const trailing = results?.at(-1)?.[1];
    return typeof trailing === 'number' ? trailing : this.client.scard(this.userKey(userId));
  }

  /**
   * Mark a connection online for a user (and index its tenant when known).
   *
   * @param userId - The connecting user.
   * @param connectionId - The connection that came online.
   * @param tenantId - The user's tenant, when the connection carries one.
   * @throws When any Redis command in the transaction reports an error.
   */
  async setOnline(userId: string, connectionId: string, tenantId?: string): Promise<void> {
    await this.addConnection(userId, connectionId, tenantId);
  }

  /**
   * Add a connection and report how many the user now holds.
   *
   * The count comes from a `scard` inside the same `MULTI` as the writes, so it
   * describes the state this very transaction produced. A result of `1` therefore
   * means this call is the one that brought the user online, and exactly one
   * concurrent caller can observe it.
   *
   * @param userId - The connecting user.
   * @param connectionId - The connection that came online.
   * @param tenantId - The user's tenant, when the connection carries one.
   * @returns The user's live connection count after the add; `1` marks arrival.
   * @throws When any Redis command in the transaction reports an error.
   */
  async addConnection(userId: string, connectionId: string, tenantId?: string): Promise<number> {
    const transaction = this.client.multi();
    transaction.sadd(this.userKey(userId), connectionId);
    transaction.sadd(GLOBAL_ONLINE_KEY, userId);
    transaction.sadd(this.instanceKey(), `${userId}${OWNER_SEPARATOR}${connectionId}`);
    if (tenantId !== undefined) {
      transaction.set(this.userTenantKey(userId), tenantId);
      transaction.sadd(this.tenantKey(tenantId), userId);
    }
    transaction.scard(this.userKey(userId));
    const results = await transaction.exec();
    throwOnTransactionError(results);
    return this.liveCount(results, userId);
  }

  /**
   * Mark a connection offline, removing the user from every index once the last
   * connection is gone.
   *
   * @param userId - The disconnecting user.
   * @param connectionId - The connection that went offline.
   * @throws When any Redis command in the transaction reports an error.
   */
  async setOffline(userId: string, connectionId: string): Promise<void> {
    await this.removeConnection(userId, connectionId);
  }

  /**
   * Remove a connection and report how many the user still holds.
   *
   * As with {@link RedisPresenceStorage.addConnection}, the count is taken inside
   * the same `MULTI` as the removal, so `0` means this call is the one that took
   * the user offline and only one concurrent caller can observe it. Clearing the
   * tenant and global indexes then follows as a separate step, because it needs
   * the tenant id that only a read can supply.
   *
   * @param userId - The disconnecting user.
   * @param connectionId - The connection that went offline.
   * @returns The user's remaining connection count; `0` marks departure.
   * @throws When any Redis command in the transaction reports an error.
   */
  async removeConnection(userId: string, connectionId: string): Promise<number> {
    const transaction = this.client.multi();
    transaction.srem(this.userKey(userId), connectionId);
    transaction.srem(this.instanceKey(), `${userId}${OWNER_SEPARATOR}${connectionId}`);
    transaction.scard(this.userKey(userId));
    const results = await transaction.exec();
    throwOnTransactionError(results);
    const remaining = await this.liveCount(results, userId);
    if (remaining > 0) return remaining;

    await this.clearUserIndexes(userId);
    return 0;
  }

  /**
   * Drop a departed user from the tenant and global indexes.
   *
   * ioredis resolves `exec()` to `null` when a `MULTI` is discarded, and none of
   * its queued writes ran. Accepting that as success would leave the user in the
   * indexes with an empty connection set — a ghost the tenant roster keeps
   * reporting online after their last stream closed. Every command here is
   * idempotent, so a discarded transaction is simply reissued directly rather
   * than surfaced as a failure the caller could not act on anyway.
   *
   * @param userId - The user whose last connection just closed.
   * @throws When any Redis command in the transaction reports an error.
   */
  private async clearUserIndexes(userId: string): Promise<void> {
    const tenantId = await this.client.get(this.userTenantKey(userId));
    const cleanup = this.client.multi();
    cleanup.srem(GLOBAL_ONLINE_KEY, userId);
    cleanup.del(this.userTenantKey(userId));
    if (tenantId !== null) cleanup.srem(this.tenantKey(tenantId), userId);
    const results = await cleanup.exec();
    throwOnTransactionError(results);
    if (results !== null) return;

    await this.client.srem(GLOBAL_ONLINE_KEY, userId);
    await this.client.del(this.userTenantKey(userId));
    if (tenantId !== null) await this.client.srem(this.tenantKey(tenantId), userId);
  }

  /**
   * Release every connection this instance still claims from a previous life.
   *
   * Called on boot. A process killed without running its shutdown hooks leaves its
   * connection ids in the user sets, which would pin those users online forever;
   * this removes exactly the ones this instance owned, then clears its own set.
   *
   * A member that is not a user/connection pair is dropped with the rest of the
   * set but never counted: the return value drives a startup log line, so it has
   * to mean "connections actually released", not "members seen".
   *
   * @returns The number of stale connections released.
   */
  async reclaimOwnConnections(): Promise<number> {
    const owned = await this.client.smembers(this.instanceKey());
    let released = 0;
    for (const member of owned) {
      const separator = member.indexOf(OWNER_SEPARATOR);
      if (separator === -1) continue;
      await this.setOffline(member.slice(0, separator), member.slice(separator + 1));
      released += 1;
    }
    await this.client.del(this.instanceKey());
    return released;
  }

  /**
   * Report whether a user has any live connection.
   *
   * @param userId - The user to check.
   * @returns `true` while at least one connection is open.
   */
  async isOnline(userId: string): Promise<boolean> {
    return (await this.client.scard(this.userKey(userId))) > 0;
  }

  /**
   * List the online user ids in a tenant.
   *
   * @param tenantId - The tenant to list.
   * @returns The online user ids, in Redis set order.
   */
  listOnlineByTenant(tenantId: string): Promise<string[]> {
    return this.client.smembers(this.tenantKey(tenantId));
  }

  /**
   * Count the distinct online users cluster-wide.
   *
   * @returns The number of users with at least one live connection.
   */
  countOnline(): Promise<number> {
    return this.client.scard(GLOBAL_ONLINE_KEY);
  }

  /**
   * Report whether a connection belongs to a user, cluster-wide.
   *
   * Used to authorize a cross-instance kill switch: the caller may only disconnect
   * a connection id that is in their own connection set, wherever it lives.
   *
   * @param userId - The claimed owner.
   * @param connectionId - The connection id to check.
   * @returns `true` when the connection is in the user's set.
   */
  async isConnectionOwnedByUser(userId: string, connectionId: string): Promise<boolean> {
    return (await this.client.sismember(this.userKey(userId), connectionId)) === 1;
  }
}
