/**
 * @fileoverview Shared singletons for the Redis-backed cluster infrastructure.
 * @layer module
 *
 * Provides the cluster pub/sub bus (and, later, presence) as singletons so the
 * realtime wiring, the liveness probe, the stats counters and the connections
 * kill switch all inject the same instances. The bus is provided twice by design:
 * `REALTIME_PUBSUB` is the concrete driver (its origin id and availability flag
 * feed the probe and counters) and `REALTIME_PUBSUB_BUS` is what the library
 * consumes, so the wiring depends on one stable token while later phases decorate
 * the bus without touching the wiring. Every provider resolves to `undefined` in
 * memory mode, keeping the single-instance boot free of any live Redis.
 */

import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { REDIS_CLIENT } from '../auth/auth.tokens';
import { APP_CONFIG } from '../config/config.tokens';

import { createRealtimePubSub } from './pubsub.factory';
import { REALTIME_PUBSUB, REALTIME_PUBSUB_BUS } from './realtime.tokens';
import type { RedisRealtimePubSub } from './redis-realtime-pubsub';

/** Wires the shared cluster infrastructure singletons for the redis driver. */
@Module({
  imports: [AuthModule],
  providers: [
    {
      provide: REALTIME_PUBSUB,
      useFactory: createRealtimePubSub,
      inject: [APP_CONFIG, REDIS_CLIENT],
    },
    {
      provide: REALTIME_PUBSUB_BUS,
      useFactory: (pubsub: RedisRealtimePubSub | undefined): RedisRealtimePubSub | undefined =>
        pubsub,
      inject: [REALTIME_PUBSUB],
    },
  ],
  exports: [REALTIME_PUBSUB, REALTIME_PUBSUB_BUS],
})
export class RealtimeInfraModule {}
