/**
 * @fileoverview Liveness endpoint exposing instance, transport and pub/sub health.
 * @layer controller
 *
 * The health payload names the running instance and the active transport so the
 * cluster labs and the compose/CI liveness probes can tell instances apart, and it
 * surfaces a pub/sub flag so the frontend can show when an instance has degraded to
 * single-instance mode after losing Redis. It reads only the frozen application
 * config and the pub/sub driver's observable state, never the process environment.
 */

import type { TransportMode } from '@bymax-one/nest-realtime/shared';
import { Controller, Get, Inject } from '@nestjs/common';

import { APP_VERSION } from '../app.constants';
import { APP_CONFIG } from '../config/config.tokens';
import type { AppConfig } from '../config/env.loader';
import { REALTIME_PUBSUB } from '../realtime/realtime.tokens';
import type { RedisRealtimePubSub } from '../realtime/redis-realtime-pubsub';

/** Cross-instance fan-out health: `ok`, or `degraded` after a Redis outage. */
export type PubSubHealth = 'ok' | 'degraded';

/** Shape returned by the liveness endpoint. */
export interface HealthStatus {
  readonly status: 'ok';
  readonly instance: string;
  readonly transport: TransportMode;
  readonly version: string;
  readonly pubsub: PubSubHealth;
}

/** Serves the unauthenticated liveness probe at `GET /health`. */
@Controller('health')
export class HealthController {
  /**
   * Build the health controller.
   *
   * @param config - The frozen application configuration.
   * @param pubsub - The Redis pub/sub driver, or `undefined` in single-instance mode.
   */
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(REALTIME_PUBSUB) private readonly pubsub: RedisRealtimePubSub | undefined,
  ) {}

  /**
   * Report liveness with the instance name, active transport, version and pub/sub
   * health.
   *
   * @returns The current {@link HealthStatus}.
   */
  @Get()
  check(): HealthStatus {
    return {
      status: 'ok',
      instance: this.config.instanceName,
      transport: this.config.realtime.transport,
      version: APP_VERSION,
      pubsub: this.pubsubHealth(),
    };
  }

  /**
   * Derive pub/sub health from the driver. Single-instance mode (no Redis driver)
   * is always `ok`; the Redis driver reports `degraded` once its bus is unavailable.
   */
  private pubsubHealth(): PubSubHealth {
    if (!this.pubsub) return 'ok';
    return this.pubsub.isAvailable ? 'ok' : 'degraded';
  }
}
