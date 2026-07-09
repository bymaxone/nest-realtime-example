/**
 * Unit tests for createRedisClient.
 *
 * Layer: unit.
 * Goal: the factory builds a usable, lazily-connecting client without opening a socket.
 * Mocks: none; a real ioredis client that is disconnected immediately.
 */

import { createRedisClient } from '../../src/auth/redis.client';
import { buildTestConfig } from '../support/config.fixture';

describe('createRedisClient', () => {
  /**
   * Lazy construction.
   *
   * The client must expose the command surface the revocation store uses and must
   * not have connected yet (lazyConnect), so an SSE-only run needs no live Redis.
   */
  it('builds a lazily-connecting client', () => {
    const client = createRedisClient(buildTestConfig());

    expect(typeof client.exists).toBe('function');
    expect(client.status).toBe('wait');
    client.disconnect();
  });
});
