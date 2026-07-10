/**
 * @fileoverview Builds the Redis pub/sub bus from config, or nothing when memory.
 * @layer realtime
 *
 * Keeps the driver decision in one place: when `PUBSUB_DRIVER` is `memory` the
 * library receives no `pubsub` and runs single-instance on its `InMemoryPubSub`,
 * so an SSE-only boot needs no live Redis. When `redis`, the shared ioredis client
 * backs a `RedisRealtimePubSub` whose `duplicate()` subscriber fans emits across
 * every instance on the same channel.
 */

import type { Redis } from 'ioredis';

import type { AppConfig } from '../config/env.loader';

import { RedisRealtimePubSub } from './redis-realtime-pubsub';

/**
 * Construct the Redis pub/sub bus when the config selects the redis driver.
 *
 * @param config - The frozen application configuration.
 * @param client - The shared ioredis client used for publishing.
 * @returns A configured {@link RedisRealtimePubSub}, or `undefined` for memory mode.
 */
export function createRealtimePubSub(
  config: AppConfig,
  client: Redis,
): RedisRealtimePubSub | undefined {
  if (config.pubsubDriver !== 'redis') {
    return undefined;
  }
  return new RedisRealtimePubSub({ client });
}
