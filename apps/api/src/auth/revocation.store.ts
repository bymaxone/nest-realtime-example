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

import { SESSION_TTL_SECONDS } from './auth.constants';
import { REDIS_CLIENT } from './auth.tokens';

/** Narrow view of the Redis client this store needs. */
export interface RevocationRedis {
  /** Return the number of the given keys that exist. */
  exists(key: string): Promise<number>;
  /** Store a value with an expiry, mirroring `SET key value EX seconds`. */
  set(key: string, value: string, mode: 'EX', ttlSeconds: number): Promise<unknown>;
  /** Delete a key, mirroring `DEL key`. */
  del(key: string): Promise<number>;
  /** Close the connection (safe even when never connected). */
  disconnect(): void;
}

/** Manages whether a user's sessions have been revoked. */
export interface IRevocationStore {
  /**
   * Report whether the given user is currently revoked.
   *
   * @param userId - The user whose revocation flag is checked.
   * @returns `true` when a revocation marker exists for the user.
   */
  isRevoked(userId: string): Promise<boolean>;
  /**
   * Revoke every live session of a user.
   *
   * @param userId - The user to revoke.
   */
  revoke(userId: string): Promise<void>;
  /**
   * Clear a user's revocation marker so new sessions authenticate again.
   *
   * @param userId - The user to restore.
   */
  unrevoke(userId: string): Promise<void>;
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

  /**
   * Revoke a user, marking them until the marker is cleared or expires.
   *
   * The marker carries the session lifetime as its TTL: a revocation only needs
   * to outlast the sessions it kills, so it self-cleans once no session could
   * still be valid.
   *
   * @param userId - The user to revoke.
   */
  async revoke(userId: string): Promise<void> {
    await this.redis.set(`${REVOCATION_KEY_PREFIX}${userId}`, '1', 'EX', SESSION_TTL_SECONDS);
  }

  /**
   * Clear a user's revocation marker.
   *
   * @param userId - The user to restore.
   */
  async unrevoke(userId: string): Promise<void> {
    await this.redis.del(`${REVOCATION_KEY_PREFIX}${userId}`);
  }

  /** Release the Redis connection on application shutdown. */
  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}
