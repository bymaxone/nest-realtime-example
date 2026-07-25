/**
 * @fileoverview Shared singletons for the Redis-backed cluster infrastructure.
 * @layer module
 *
 * Provides the cluster pub/sub bus, its stats counters and the presence storage as
 * singletons so the realtime wiring, the liveness probe, the stats endpoint, the
 * presence tracker and the connections kill switch all inject the same instances.
 * The bus is provided
 * twice by design: `REALTIME_PUBSUB` is the concrete driver (its origin id and
 * availability flag feed the probe) and `REALTIME_PUBSUB_BUS` is what the library
 * consumes, wrapped in the counting decorator so publishes and remote deliveries
 * are measured without the library knowing. The wiring depends on one stable token
 * regardless of the decoration. Every provider resolves to `undefined` in memory
 * mode, keeping the single-instance boot free of any live Redis.
 */

import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { REDIS_CLIENT } from '../auth/auth.tokens';
import { APP_CONFIG } from '../config/config.tokens';
import { ClusterStatsService } from '../connections/cluster-stats.service';

import { CountingRealtimePubSub } from './counting-pubsub';
import { createPresenceStorage } from './presence.factory';
import { createRealtimePubSub } from './pubsub.factory';
import { REALTIME_PRESENCE, REALTIME_PUBSUB, REALTIME_PUBSUB_BUS } from './realtime.tokens';
import type { RedisRealtimePubSub } from './redis-realtime-pubsub';

/**
 * Wrap the base bus in the counting decorator, or pass through nothing in memory
 * mode so the library keeps its single-instance default.
 *
 * @param base - The concrete Redis pub/sub bus, or `undefined` in memory mode.
 * @param stats - The counters the decorator increments.
 * @returns The counting bus handed to the library, or `undefined`.
 */
function createCountingBus(
  base: RedisRealtimePubSub | undefined,
  stats: ClusterStatsService,
): CountingRealtimePubSub | undefined {
  return base ? new CountingRealtimePubSub(base, stats) : undefined;
}

/** Wires the shared cluster infrastructure singletons for the redis driver. */
@Module({
  imports: [AuthModule],
  providers: [
    ClusterStatsService,
    {
      provide: REALTIME_PUBSUB,
      useFactory: createRealtimePubSub,
      inject: [APP_CONFIG, REDIS_CLIENT],
    },
    {
      provide: REALTIME_PUBSUB_BUS,
      useFactory: createCountingBus,
      inject: [REALTIME_PUBSUB, ClusterStatsService],
    },
    {
      provide: REALTIME_PRESENCE,
      useFactory: createPresenceStorage,
      inject: [REDIS_CLIENT, APP_CONFIG],
    },
  ],
  exports: [REALTIME_PUBSUB, REALTIME_PUBSUB_BUS, REALTIME_PRESENCE, ClusterStatsService],
})
export class RealtimeInfraModule {}
