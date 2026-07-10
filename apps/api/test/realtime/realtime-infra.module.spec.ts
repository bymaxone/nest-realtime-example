/**
 * Unit tests for RealtimeInfraModule.
 *
 * Layer: unit (module integration).
 * Goal: the redis driver exposes a shared RedisRealtimePubSub through both tokens;
 *       the memory driver exposes nothing so the library keeps its defaults.
 * Mocks: the global ConfigModule plus an overridden APP_CONFIG and REDIS_CLIENT.
 */

import { Test, type TestingModule } from '@nestjs/testing';

import { REDIS_CLIENT } from '../../src/auth/auth.tokens';
import { APP_CONFIG } from '../../src/config/config.tokens';
import { ConfigModule } from '../../src/config/config.module';
import { ClusterStatsService } from '../../src/connections/cluster-stats.service';
import { CountingRealtimePubSub } from '../../src/realtime/counting-pubsub';
import { RealtimeInfraModule } from '../../src/realtime/realtime-infra.module';
import { RedisRealtimePubSub } from '../../src/realtime/redis-realtime-pubsub';
import { REALTIME_PUBSUB, REALTIME_PUBSUB_BUS } from '../../src/realtime/realtime.tokens';
import type { AppConfig } from '../../src/config/env.loader';
import { buildTestConfig } from '../support/config.fixture';
import { asPubSubRedis, FakePubSubBroker, FakePubSubRedis } from '../support/fake-pubsub';

/** Compile the infra module with an overridden config and fake Redis client. */
async function compile(config: AppConfig): Promise<TestingModule> {
  return Test.createTestingModule({ imports: [ConfigModule, RealtimeInfraModule] })
    .overrideProvider(APP_CONFIG)
    .useValue(config)
    .overrideProvider(REDIS_CLIENT)
    .useValue(asPubSubRedis(new FakePubSubRedis(new FakePubSubBroker())))
    .compile();
}

describe('RealtimeInfraModule', () => {
  /**
   * Redis driver wiring.
   *
   * Under the redis driver the concrete driver and the counting bus (which wraps
   * it) must both resolve, and the stats service must be shared, so the probe reads
   * the driver while the library consumes the measured bus.
   */
  it('exposes the driver, the counting bus wrapping it, and the stats service', async () => {
    const moduleRef = await compile(buildTestConfig({ pubsubDriver: 'redis' }));

    expect(moduleRef.get(REALTIME_PUBSUB)).toBeInstanceOf(RedisRealtimePubSub);
    expect(moduleRef.get(REALTIME_PUBSUB_BUS)).toBeInstanceOf(CountingRealtimePubSub);
    expect(moduleRef.get(ClusterStatsService)).toBeInstanceOf(ClusterStatsService);

    await moduleRef.close();
  });

  /**
   * Memory driver wiring.
   *
   * The default memory driver must leave both pub/sub tokens undefined so the
   * library uses its InMemoryPubSub and the boot needs no live Redis.
   */
  it('leaves both pub/sub tokens undefined under the memory driver', async () => {
    const moduleRef = await compile(buildTestConfig({ pubsubDriver: 'memory' }));

    expect(moduleRef.get(REALTIME_PUBSUB, { optional: true })).toBeUndefined();
    expect(moduleRef.get(REALTIME_PUBSUB_BUS, { optional: true })).toBeUndefined();

    await moduleRef.close();
  });
});
