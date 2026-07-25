/**
 * @fileoverview Builds the Redis presence storage from the shared client.
 * @layer realtime
 *
 * Presence is backed by the same ioredis client the revocation store already
 * uses, so it is available on every profile rather than only under
 * `PUBSUB_DRIVER=redis`: a single-instance boot still wants a truthful roster
 * across a user's own tabs, and gating it on the pub/sub driver left the
 * presence page permanently empty on the documented development loop. The
 * storage is instance-agnostic either way, so the cluster profile keeps the
 * cross-instance roster it needs.
 */

import type { Redis } from 'ioredis';

import type { AppConfig } from '../config/env.loader';

import { RedisPresenceStorage } from './redis-presence-storage';

/**
 * Construct the presence storage over the shared Redis client.
 *
 * The configured instance name is passed as the owning identity, because it is
 * stable across a restart: that is what lets a rebooted instance reclaim the
 * connections it left behind when it died.
 *
 * @param client - The shared ioredis client.
 * @param config - The frozen application configuration.
 * @returns A configured {@link RedisPresenceStorage}.
 */
export function createPresenceStorage(client: Redis, config: AppConfig): RedisPresenceStorage {
  return new RedisPresenceStorage({ client, instanceId: config.instanceName });
}
