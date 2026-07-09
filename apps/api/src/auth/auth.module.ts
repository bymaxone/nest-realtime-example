/**
 * @fileoverview Auth module: session signing, revocation store and the guard.
 * @layer module
 *
 * Provides the session service, the Redis client and revocation store, and the
 * REST session guard, exporting the pieces the realtime wiring needs to build the
 * `CookieSessionAuthenticator` (registered there as an extra provider). The
 * authenticator itself is not provided here so a single instance is owned by the
 * realtime module.
 */

import { Module } from '@nestjs/common';

import { APP_CONFIG } from '../config/config.tokens';

import { AuthController } from './auth.controller';
import { REDIS_CLIENT, REVOCATION_STORE } from './auth.tokens';
import { createRedisClient } from './redis.client';
import { RedisRevocationStore } from './revocation.store';
import { SessionGuard } from './session.guard';
import { SessionService } from './session.service';
import { TicketAuthenticator } from './ticket.authenticator';
import { TicketController } from './ticket.controller';
import { TicketService } from './ticket.service';

/** Wires the demo auth endpoints, session signing, tickets and revocation store. */
@Module({
  controllers: [AuthController, TicketController],
  providers: [
    SessionService,
    SessionGuard,
    TicketService,
    TicketAuthenticator,
    { provide: REDIS_CLIENT, useFactory: createRedisClient, inject: [APP_CONFIG] },
    { provide: REVOCATION_STORE, useClass: RedisRevocationStore },
  ],
  exports: [SessionService, SessionGuard, TicketService, TicketAuthenticator, REVOCATION_STORE],
})
export class AuthModule {}
