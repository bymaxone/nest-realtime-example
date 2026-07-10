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
 * Retention note: entries are removed on disconnect, not by TTL, so a hard crash
 * that skips `setOffline` can leave a stale entry until the process restarts. A
 * production adapter would add a heartbeat TTL; the example keeps the mechanics
 * legible.
 */

import type { IPresenceStorage } from '@bymax-one/nest-realtime';
import type { Redis } from 'ioredis';

/** Key of the global set of every online user id. */
const GLOBAL_ONLINE_KEY = 'presence:online';

/** Construction options for {@link RedisPresenceStorage}. */
export interface RedisPresenceStorageOptions {
  /** The ioredis client every presence operation runs against. */
  readonly client: Redis;
}

/** Throw the first error reported by a pipelined command batch. */
function throwOnPipelineError(results: Array<[Error | null, unknown]> | null): void {
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

  /**
   * Build the presence storage.
   *
   * @param options - The Redis client backing every set and index.
   */
  constructor(options: RedisPresenceStorageOptions) {
    this.client = options.client;
  }

  /** Key of a user's connection-id set. */
  private userKey(userId: string): string {
    return `presence:user:${userId}`;
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
   * Mark a connection online for a user (and index its tenant when known).
   *
   * @param userId - The connecting user.
   * @param connectionId - The connection that came online.
   * @param tenantId - The user's tenant, when the connection carries one.
   * @throws When any pipelined Redis command reports an error.
   */
  async setOnline(userId: string, connectionId: string, tenantId?: string): Promise<void> {
    const pipeline = this.client.pipeline();
    pipeline.sadd(this.userKey(userId), connectionId);
    pipeline.sadd(GLOBAL_ONLINE_KEY, userId);
    if (tenantId !== undefined) {
      pipeline.set(this.userTenantKey(userId), tenantId);
      pipeline.sadd(this.tenantKey(tenantId), userId);
    }
    throwOnPipelineError(await pipeline.exec());
  }

  /**
   * Mark a connection offline, removing the user from every index once the last
   * connection is gone.
   *
   * @param userId - The disconnecting user.
   * @param connectionId - The connection that went offline.
   * @throws When any pipelined Redis command reports an error.
   */
  async setOffline(userId: string, connectionId: string): Promise<void> {
    await this.client.srem(this.userKey(userId), connectionId);
    if ((await this.client.scard(this.userKey(userId))) > 0) return;
    const tenantId = await this.client.get(this.userTenantKey(userId));
    const pipeline = this.client.pipeline();
    pipeline.srem(GLOBAL_ONLINE_KEY, userId);
    pipeline.del(this.userTenantKey(userId));
    if (tenantId !== null) pipeline.srem(this.tenantKey(tenantId), userId);
    throwOnPipelineError(await pipeline.exec());
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
