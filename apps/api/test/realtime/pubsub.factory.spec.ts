/**
 * Unit tests for createRealtimePubSub.
 *
 * Layer: unit.
 * Goal: the redis driver yields a RedisRealtimePubSub; memory yields nothing.
 * Mocks: an in-memory pub/sub client double (fake-pubsub).
 */

import { createRealtimePubSub } from '../../src/realtime/pubsub.factory';
import { RedisRealtimePubSub } from '../../src/realtime/redis-realtime-pubsub';
import { buildTestConfig } from '../support/config.fixture';
import { asPubSubRedis, FakePubSubBroker, FakePubSubRedis } from '../support/fake-pubsub';

describe('createRealtimePubSub', () => {
  const client = asPubSubRedis(new FakePubSubRedis(new FakePubSubBroker()));

  /**
   * Redis driver.
   *
   * With `PUBSUB_DRIVER=redis` the factory must return a RedisRealtimePubSub bound
   * to the shared client so emits fan out across instances.
   */
  it('builds a RedisRealtimePubSub for the redis driver', () => {
    const pubsub = createRealtimePubSub(buildTestConfig({ pubsubDriver: 'redis' }), client);

    expect(pubsub).toBeInstanceOf(RedisRealtimePubSub);
  });

  /**
   * Memory driver.
   *
   * The default `memory` driver must return nothing so the library stays on its
   * single-instance InMemoryPubSub and no Redis connection is needed.
   */
  it('returns undefined for the memory driver', () => {
    expect(
      createRealtimePubSub(buildTestConfig({ pubsubDriver: 'memory' }), client),
    ).toBeUndefined();
  });
});
