/**
 * @fileoverview Canonical realtime wiring consumers copy.
 * @layer realtime
 *
 * Registers the library through `BymaxRealtimeModule.forRootAsync` with the
 * options factory, the DI-resolved authenticator (as an extra provider) and a
 * synchronous `sse` transport hint that gates WebSocket wiring off so an SSE-only
 * app never boots Socket.IO or needs its peer deps. When the config enables it,
 * the same shared ioredis client backs a `RedisOfflineQueue` handed to the
 * library so events for momentarily disconnected users survive until reconnect,
 * and (under `PUBSUB_DRIVER=redis`) a `RedisRealtimePubSub` so an emit on one
 * instance fans out to clients connected to the others.
 *
 * Endpoint note: the installed library binds the async SSE controller to the
 * fixed `/events` route, so the configured `sse.endpoint` (`/api/events`) is
 * realized by the application-wide `api` route prefix set in `main.ts`. The
 * synchronous `forRoot` path honors `sse.endpoint` directly and is exercised in
 * the wiring tests.
 */

import { BymaxRealtimeModule, type IRealtimePubSub } from '@bymax-one/nest-realtime';
import { Module } from '@nestjs/common';
import type { Redis } from 'ioredis';

import { AuthModule } from '../auth/auth.module';
import { REDIS_CLIENT } from '../auth/auth.tokens';
import { CompositeAuthenticator } from '../auth/composite.authenticator';
import { APP_CONFIG } from '../config/config.tokens';
import type { AppConfig } from '../config/env.loader';
import { CompositeLifecycleHooks } from '../lifecycle/lifecycle-hooks';
import { LifecycleModule } from '../lifecycle/lifecycle.module';

import { createOfflineQueue } from './offline-queue.factory';
import { buildRealtimeOptions } from './options.factory';
import { RealtimeInfraModule } from './realtime-infra.module';
import { REALTIME_PUBSUB_BUS } from './realtime.tokens';

/** Wires the library for the SSE profile and exports its public providers. */
@Module({
  imports: [
    BymaxRealtimeModule.forRootAsync({
      transport: 'sse',
      imports: [AuthModule, LifecycleModule, RealtimeInfraModule],
      inject: [
        APP_CONFIG,
        CompositeAuthenticator,
        CompositeLifecycleHooks,
        REDIS_CLIENT,
        REALTIME_PUBSUB_BUS,
      ],
      // The library types useFactory as (...args: unknown[]); the injected values
      // are exactly the `inject` tuple, so narrow it to the concrete dependencies.
      useFactory: (...args: unknown[]) => {
        const [config, authenticator, hooks, redis, pubsub] = args as [
          AppConfig,
          CompositeAuthenticator,
          CompositeLifecycleHooks,
          Redis,
          IRealtimePubSub | undefined,
        ];
        return buildRealtimeOptions(
          config,
          authenticator,
          hooks,
          createOfflineQueue(config, redis),
          pubsub,
        );
      },
    }),
  ],
  exports: [BymaxRealtimeModule],
})
export class RealtimeWiringModule {}
