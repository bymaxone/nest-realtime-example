/**
 * @fileoverview Auth module: session signing, all three authenticators and the composite.
 * @layer module
 *
 * Provides the session service, the Redis client and revocation store, the demo
 * auth endpoints (login/logout, ticket issue, ws-token mint) and every
 * `IConnectionAuthenticator` pattern. The `CompositeAuthenticator` is the single
 * authenticator the realtime wiring injects; `RevalidationStatsService` is
 * exported so the reauth lab can read the cache-reduction counters.
 */

import { Module } from '@nestjs/common';

import { APP_CONFIG } from '../config/config.tokens';

import { AdminGuard } from './admin.guard';
import { AuthController } from './auth.controller';
import { REDIS_CLIENT, REVOCATION_STORE } from './auth.tokens';
import { BearerAuthenticator } from './bearer.authenticator';
import { CompositeAuthenticator } from './composite.authenticator';
import { CookieSessionAuthenticator } from './cookie-session.authenticator';
import { ReauthLabController } from './reauth-lab.controller';
import { createRedisClient } from './redis.client';
import { RevalidationStatsService } from './revalidation-stats.service';
import { RevocationController } from './revocation.controller';
import { RedisRevocationStore } from './revocation.store';
import { SessionGuard } from './session.guard';
import { SessionService } from './session.service';
import { TicketAuthenticator } from './ticket.authenticator';
import { TicketController } from './ticket.controller';
import { TicketService } from './ticket.service';
import { WsTokenController } from './ws-token.controller';
import { WsTokenService } from './ws-token.service';

/** Wires the demo auth endpoints, session signing, tickets, bearer and the composite. */
@Module({
  controllers: [
    AuthController,
    TicketController,
    WsTokenController,
    RevocationController,
    ReauthLabController,
  ],
  providers: [
    SessionService,
    SessionGuard,
    AdminGuard,
    TicketService,
    WsTokenService,
    RevalidationStatsService,
    CookieSessionAuthenticator,
    TicketAuthenticator,
    BearerAuthenticator,
    CompositeAuthenticator,
    { provide: REDIS_CLIENT, useFactory: createRedisClient, inject: [APP_CONFIG] },
    { provide: REVOCATION_STORE, useClass: RedisRevocationStore },
  ],
  exports: [
    SessionService,
    SessionGuard,
    AdminGuard,
    TicketService,
    WsTokenService,
    RevalidationStatsService,
    CompositeAuthenticator,
    REVOCATION_STORE,
  ],
})
export class AuthModule {}
