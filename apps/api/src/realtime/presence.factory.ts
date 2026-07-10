/**
 * @fileoverview Builds the Redis presence storage from config, or nothing when memory.
 * @layer realtime
 *
 * Presence is a cross-instance concern, so it is enabled on the same gate as the
 * pub/sub bus: under `PUBSUB_DRIVER=redis` the shared ioredis client backs a
 * `RedisPresenceStorage`; in memory mode there is nothing to share, so presence is
 * left off and presence-dependent features stay disabled.
 */

import type { Redis } from 'ioredis';

import type { AppConfig } from '../config/env.loader';

import { RedisPresenceStorage } from './redis-presence-storage';

/**
 * Construct the presence storage when the config selects the redis driver.
 *
 * @param config - The frozen application configuration.
 * @param client - The shared ioredis client.
 * @returns A configured {@link RedisPresenceStorage}, or `undefined` for memory mode.
 */
export function createPresenceStorage(
  config: AppConfig,
  client: Redis,
): RedisPresenceStorage | undefined {
  if (config.pubsubDriver !== 'redis') {
    return undefined;
  }
  return new RedisPresenceStorage({ client });
}
