/**
 * @fileoverview Canonical realtime wiring consumers copy.
 * @layer realtime
 *
 * Registers the library through `BymaxRealtimeModule.forRootAsync` with the
 * options factory, the DI-resolved authenticator (as an extra provider) and a
 * synchronous `sse` transport hint that gates WebSocket wiring off so an SSE-only
 * app never boots Socket.IO or needs its peer deps.
 *
 * Endpoint note: the installed library binds the async SSE controller to the
 * fixed `/events` route, so the configured `sse.endpoint` (`/api/events`) is
 * realized by the application-wide `api` route prefix set in `main.ts`. The
 * synchronous `forRoot` path honors `sse.endpoint` directly and is exercised in
 * the wiring tests.
 */

import { BymaxRealtimeModule } from '@bymax-one/nest-realtime';
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CookieSessionAuthenticator } from '../auth/cookie-session.authenticator';
import { APP_CONFIG } from '../config/config.tokens';
import type { AppConfig } from '../config/env.loader';

import { buildRealtimeOptions } from './options.factory';

/** Wires the library for the SSE profile and exports its public providers. */
@Module({
  imports: [
    BymaxRealtimeModule.forRootAsync({
      transport: 'sse',
      imports: [AuthModule],
      inject: [APP_CONFIG, CookieSessionAuthenticator],
      // The library types useFactory as (...args: unknown[]); the injected values
      // are exactly the `inject` tuple, so narrow it to the concrete dependencies.
      useFactory: (...args: unknown[]) => {
        const [config, authenticator] = args as [AppConfig, CookieSessionAuthenticator];
        return buildRealtimeOptions(config, authenticator);
      },
      extraProviders: [CookieSessionAuthenticator],
    }),
  ],
  exports: [BymaxRealtimeModule],
})
export class RealtimeWiringModule {}
