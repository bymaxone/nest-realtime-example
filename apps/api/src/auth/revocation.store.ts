/**
 * @fileoverview Redis-backed session revocation lookup.
 * @layer auth
 *
 * The re-authentication policy and kill-switch labs (later phases) mark a user
 * revoked by writing `realtime:revoked:{userId}` in Redis. This store answers the
 * "is this user revoked?" question the authenticator's `revalidate` asks. The
 * ioredis client is created lazily, so a run that never revalidates never opens a
 * socket, and it is released on module teardown.
 */

import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';

import { REDIS_CLIENT } from './auth.tokens';

/** Narrow view of the Redis client this store needs. */
export interface RevocationRedis {
  /** Return the number of the given keys that exist. */
  exists(key: string): Promise<number>;
  /** Close the connection (safe even when never connected). */
  disconnect(): void;
}

/** Answers whether a user's sessions have been revoked. */
export interface IRevocationStore {
  /**
   * Report whether the given user is currently revoked.
   *
   * @param userId - The user whose revocation flag is checked.
   * @returns `true` when a revocation marker exists for the user.
   */
  isRevoked(userId: string): Promise<boolean>;
}

/** Key prefix under which a user's revocation marker is stored. */
const REVOCATION_KEY_PREFIX = 'realtime:revoked:';

/** Redis implementation of {@link IRevocationStore}. */
@Injectable()
export class RedisRevocationStore implements IRevocationStore, OnModuleDestroy {
  /**
   * Build the store.
   *
   * @param redis - The shared Redis client.
   */
  constructor(@Inject(REDIS_CLIENT) private readonly redis: RevocationRedis) {}

  /**
   * Report whether a revocation marker exists for the user.
   *
   * @param userId - The user whose revocation flag is checked.
   * @returns `true` when the user is revoked.
   */
  async isRevoked(userId: string): Promise<boolean> {
    return (await this.redis.exists(`${REVOCATION_KEY_PREFIX}${userId}`)) > 0;
  }

  /** Release the Redis connection on application shutdown. */
  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}
