/**
 * Unit tests for createPresenceStorage.
 *
 * Layer: unit.
 * Goal: the redis driver yields a RedisPresenceStorage; memory yields nothing.
 * Mocks: an in-memory presence client double.
 */

import { createPresenceStorage } from '../../src/realtime/presence.factory';
import { RedisPresenceStorage } from '../../src/realtime/redis-presence-storage';
import { buildTestConfig } from '../support/config.fixture';
import { asPresenceRedis, FakePresenceRedis } from '../support/fake-presence-redis';

describe('createPresenceStorage', () => {
  const client = asPresenceRedis(new FakePresenceRedis());

  /**
   * Redis driver.
   *
   * Under `PUBSUB_DRIVER=redis` presence must be a RedisPresenceStorage so the
   * roster is truthful across instances.
   */
  it('builds a RedisPresenceStorage for the redis driver', () => {
    expect(
      createPresenceStorage(buildTestConfig({ pubsubDriver: 'redis' }), client),
    ).toBeInstanceOf(RedisPresenceStorage);
  });

  /**
   * Memory driver.
   *
   * The default memory driver must return nothing so presence-dependent features
   * stay disabled and no Redis is required.
   */
  it('returns undefined for the memory driver', () => {
    expect(
      createPresenceStorage(buildTestConfig({ pubsubDriver: 'memory' }), client),
    ).toBeUndefined();
  });
});
