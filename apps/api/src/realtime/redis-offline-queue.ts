/**
 * @fileoverview Redis sorted-set implementation of the library's `IOfflineQueueStorage`.
 * @layer realtime
 *
 * This is a sanctioned consumer-side storage adapter: the library owns the replay
 * and delivery logic and only calls this contract (`append`, `retrieveSince`,
 * `acknowledge`) to persist events for users who are momentarily disconnected. It
 * is intentionally the simplest correct backing store so it reads as a template:
 * one Redis sorted set per user under `realtime:offline:{userId}`, ordered by an
 * insertion timestamp for rank-based trimming, while all delivery ordering is
 * decided by lexicographic comparison of the opaque, fixed-width event ids the
 * library generates. Retention is enforced here (a `maxPerUser` cap trimmed on
 * every append plus a sliding TTL) so a disconnected user can never grow the
 * store without bound.
 */

import type { IOfflineQueueStorage, OfflineQueuedEvent } from '@bymax-one/nest-realtime';
import type { Redis } from 'ioredis';

/** Key namespace for a user's durable offline queue. */
const KEY_PREFIX = 'realtime:offline';

/** Construction options for {@link RedisOfflineQueue}. */
export interface RedisOfflineQueueOptions {
  /** The ioredis client every queue operation runs against. */
  readonly client: Redis;
  /** Seconds a user's key survives inactivity before Redis expires it. */
  readonly ttlSeconds: number;
  /** Newest-N cap per user; older events are trimmed oldest-first on append. */
  readonly maxPerUser: number;
}

/**
 * Revive an offline event from its stored JSON, restoring `emittedAt` to a `Date`.
 *
 * @param member - The raw sorted-set member (a JSON-encoded {@link OfflineQueuedEvent}).
 * @returns The decoded event with a real `Date` for `emittedAt`.
 */
function decodeMember(member: string): OfflineQueuedEvent {
  return JSON.parse(member, (key, value: unknown) =>
    key === 'emittedAt' && typeof value === 'string' ? new Date(value) : value,
  ) as OfflineQueuedEvent;
}

/**
 * Redis sorted-set-backed offline queue, one key per user.
 *
 * Delivery ordering never relies on the numeric ZSET score (epoch milliseconds
 * collide at burst rates and lose precision as fractional scores); it is derived
 * by comparing the library's fixed-width event ids as strings, which the
 * id-ordering spec pins. The score exists only so `ZREMRANGEBYRANK` can trim the
 * oldest events when the per-user cap is exceeded.
 */
export class RedisOfflineQueue implements IOfflineQueueStorage {
  private readonly client: Redis;
  private readonly ttlSeconds: number;
  private readonly maxPerUser: number;

  /**
   * Build a Redis-backed offline queue.
   *
   * @param options - The Redis client and retention bounds.
   */
  constructor(options: RedisOfflineQueueOptions) {
    this.client = options.client;
    this.ttlSeconds = options.ttlSeconds;
    this.maxPerUser = options.maxPerUser;
  }

  /**
   * Compose the sorted-set key for a user's queue.
   *
   * @param userId - The queue owner.
   * @returns The per-user Redis key.
   */
  private key(userId: string): string {
    return `${KEY_PREFIX}:${userId}`;
  }

  /**
   * Append one event to a user's queue, then enforce retention atomically.
   *
   * The pipeline adds the event, trims everything beyond the newest `maxPerUser`
   * by rank, and refreshes the sliding TTL so an active queue never expires while
   * an idle one is reclaimed.
   *
   * @param userId - The queue owner.
   * @param event - The event to persist.
   * @throws When any pipelined Redis command reports an error.
   */
  async append(userId: string, event: OfflineQueuedEvent): Promise<void> {
    const key = this.key(userId);
    const results = await this.client
      .pipeline()
      .zadd(key, Date.now(), JSON.stringify(event))
      .zremrangebyrank(key, 0, -(this.maxPerUser + 1))
      .expire(key, this.ttlSeconds)
      .exec();
    for (const [error] of results ?? []) {
      if (error) throw error;
    }
  }

  /**
   * Return the events a user missed, strictly newer than `sinceId`, in order.
   *
   * Ordering is lexicographic on the event id (the same comparison the in-memory
   * replay buffer uses), so replay from the buffer and drain from this queue
   * interleave into one monotonic stream.
   *
   * @param userId - The queue owner.
   * @param sinceId - The last id the client already has; events with a greater id are returned.
   * @param limit - The maximum number of events to return.
   * @returns Up to `limit` events with `id > sinceId`, ascending by id.
   */
  async retrieveSince(
    userId: string,
    sinceId: string,
    limit: number,
  ): Promise<OfflineQueuedEvent[]> {
    const members = await this.client.zrange(this.key(userId), 0, -1);
    return members
      .map(decodeMember)
      .filter((event) => event.id > sinceId)
      .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
      .slice(0, limit);
  }

  /**
   * Purge every event delivered up to and including `upToId`.
   *
   * @param userId - The queue owner.
   * @param upToId - The delivery watermark; events with `id <= upToId` are removed.
   */
  async acknowledge(userId: string, upToId: string): Promise<void> {
    const key = this.key(userId);
    const members = await this.client.zrange(key, 0, -1);
    const delivered = members.filter((member) => decodeMember(member).id <= upToId);
    if (delivered.length > 0) {
      await this.client.zrem(key, ...delivered);
    }
  }
}
