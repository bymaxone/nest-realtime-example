/**
 * @fileoverview Canonical realtime wiring consumers copy.
 * @layer realtime
 *
 * Registers the library through `BymaxRealtimeModule.forRootAsync` with the
 * options factory, the DI-resolved authenticator (as an extra provider) and a
 * synchronous transport hint read from the environment. The hint gates which
 * transport providers register at module-definition time, so an SSE boot never
 * registers the gateway or boots Socket.IO while a WebSocket boot does; it must
 * equal the transport the async factory returns from `APP_CONFIG`, and both derive
 * from the same environment so they always agree. Reading it here (the one place a
 * synchronous value is needed before DI resolves) keeps the profile a pure
 * function of `REALTIME_TRANSPORT`, which is what lets the identical wiring serve
 * either transport. When the config enables it, the same shared ioredis client
 * backs a `RedisOfflineQueue` handed to the library so events for momentarily
 * disconnected users survive until reconnect, and (under `PUBSUB_DRIVER=redis`) a
 * `RedisRealtimePubSub` so an emit on one instance fans out to clients connected
 * to the others.
 *
 * Endpoint note: the installed library binds the async SSE controller to the
 * fixed `/events` route, so the configured `sse.endpoint` (`/api/events`) is
 * realized by the application-wide `api` route prefix set in `main.ts`. The
 * synchronous `forRoot` path honors `sse.endpoint` directly and is exercised in
 * the wiring tests.
 */

import {
  BymaxRealtimeModule,
  type IPresenceStorage,
  type IRealtimePubSub,
} from '@bymax-one/nest-realtime';
import { Module } from '@nestjs/common';
import type { Redis } from 'ioredis';

import { AuthModule } from '../auth/auth.module';
import { REDIS_CLIENT } from '../auth/auth.tokens';
import { CompositeAuthenticator } from '../auth/composite.authenticator';
import { APP_CONFIG } from '../config/config.tokens';
import type { AppConfig } from '../config/env.loader';
import { envSchema } from '../config/env.schema';
import { CompositeLifecycleHooks } from '../lifecycle/lifecycle-hooks';
import { LifecycleModule } from '../lifecycle/lifecycle.module';

import { createOfflineQueue } from './offline-queue.factory';
import { buildRealtimeOptions } from './options.factory';
import { RealtimeInfraModule } from './realtime-infra.module';
import { REALTIME_PRESENCE, REALTIME_PUBSUB_BUS } from './realtime.tokens';

/**
 * The boot transport, parsed from the environment before DI resolves. It gates
 * provider registration and must equal the transport the async factory later
 * derives from `APP_CONFIG`; both read the same `REALTIME_TRANSPORT` variable.
 */
const BOOT_TRANSPORT = envSchema.shape.REALTIME_TRANSPORT.parse(process.env.REALTIME_TRANSPORT);

/** Wires the library for the configured transport and exports its providers. */
@Module({
  imports: [
    BymaxRealtimeModule.forRootAsync({
      transport: BOOT_TRANSPORT,
      imports: [AuthModule, LifecycleModule, RealtimeInfraModule],
      inject: [
        APP_CONFIG,
        CompositeAuthenticator,
        CompositeLifecycleHooks,
        REDIS_CLIENT,
        REALTIME_PUBSUB_BUS,
        REALTIME_PRESENCE,
      ],
      // The library types useFactory as (...args: unknown[]); the injected values
      // are exactly the `inject` tuple, so narrow it to the concrete dependencies.
      useFactory: (...args: unknown[]) => {
        const [config, authenticator, hooks, redis, pubsub, presence] = args as [
          AppConfig,
          CompositeAuthenticator,
          CompositeLifecycleHooks,
          Redis,
          IRealtimePubSub | undefined,
          IPresenceStorage | undefined,
        ];
        return buildRealtimeOptions(
          config,
          authenticator,
          hooks,
          createOfflineQueue(config, redis),
          pubsub,
          presence,
        );
      },
    }),
  ],
  exports: [BymaxRealtimeModule],
})
export class RealtimeWiringModule {}
