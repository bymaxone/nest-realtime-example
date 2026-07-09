/**
 * @fileoverview Factory for the shared, lazily-connecting ioredis client.
 * @layer auth
 *
 * The client is configured with `lazyConnect` so constructing it never opens a
 * socket; the connection is established only when a command (the first
 * revocation check) actually runs. This keeps SSE-only test runs and the dev
 * boot from requiring a live Redis.
 */

import Redis from 'ioredis';

import type { AppConfig } from '../config/env.loader';

/**
 * Create the shared Redis client from the application config.
 *
 * @param config - The frozen application config providing `REDIS_URL`.
 * @returns A lazily-connecting ioredis client.
 */
export function createRedisClient(config: AppConfig): Redis {
  return new Redis(config.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
}
