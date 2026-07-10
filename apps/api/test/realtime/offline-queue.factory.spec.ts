/**
 * Unit tests for createOfflineQueue.
 *
 * Layer: unit.
 * Goal: the factory returns a live queue only when the config enables it, and
 *       nothing otherwise, so an SSE-only boot never wires Redis.
 * Mocks: FakeRedis as the client.
 */

import { createOfflineQueue } from '../../src/realtime/offline-queue.factory';
import { RedisOfflineQueue } from '../../src/realtime/redis-offline-queue';
import { buildTestConfig } from '../support/config.fixture';
import { asRedis, FakeRedis } from '../support/fake-redis';

const client = asRedis(new FakeRedis());

describe('createOfflineQueue', () => {
  /**
   * Disabled profile.
   *
   * With the queue disabled the factory must return nothing so the library keeps
   * its no-queue default and the app needs no Redis.
   */
  it('returns undefined when the offline queue is disabled', () => {
    const config = buildTestConfig({ offlineQueue: { enabled: false } });

    expect(createOfflineQueue(config, client)).toBeUndefined();
  });

  /**
   * Enabled profile.
   *
   * With the queue enabled the factory must build a `RedisOfflineQueue` bound to
   * the shared client so the library can persist events for offline users.
   */
  it('builds a RedisOfflineQueue when enabled', () => {
    const config = buildTestConfig({
      offlineQueue: { enabled: true, ttlSeconds: 120, maxPerUser: 25 },
    });

    expect(createOfflineQueue(config, client)).toBeInstanceOf(RedisOfflineQueue);
  });
});
