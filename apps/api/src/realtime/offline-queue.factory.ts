/**
 * @fileoverview Builds the Redis offline queue from config, or nothing when disabled.
 * @layer realtime
 *
 * Keeps the enable/disable decision in one place: when `OFFLINE_QUEUE_ENABLED` is
 * off the library receives no `offlineQueue`, so an SSE-only boot needs no Redis
 * and behaves exactly as before. When on, the single shared ioredis client backs
 * the queue the library appends to and the offline lab reads.
 */

import type { Redis } from 'ioredis';

import type { AppConfig } from '../config/env.loader';

import { RedisOfflineQueue } from './redis-offline-queue';

/**
 * Construct the offline queue when the config enables it.
 *
 * @param config - The frozen application configuration.
 * @param client - The shared ioredis client.
 * @returns A configured {@link RedisOfflineQueue}, or `undefined` when disabled.
 */
export function createOfflineQueue(
  config: AppConfig,
  client: Redis,
): RedisOfflineQueue | undefined {
  if (!config.offlineQueue.enabled) {
    return undefined;
  }
  return new RedisOfflineQueue({
    client,
    ttlSeconds: config.offlineQueue.ttlSeconds,
    maxPerUser: config.offlineQueue.maxPerUser,
  });
}
