/**
 * @fileoverview The single authenticator that dispatches all three auth patterns.
 * @layer auth
 *
 * The library wiring takes exactly one `IConnectionAuthenticator`. This composite
 * keeps that contract while supporting every pattern: a WebSocket handshake that
 * carries a bearer token uses the bearer authenticator; any connection presenting
 * a `?ticket=` query parameter uses the one-shot ticket authenticator; everything
 * else falls back to the cookie authenticator. `revalidate` delegates to the
 * cookie authenticator's revocation check (the single source of truth for a
 * killed session) and records the check so the reauth cache is observable.
 */

import type {
  AuthenticationResult,
  ConnectionAuthContext,
  IConnectionAuthenticator,
} from '@bymax-one/nest-realtime';
import { Injectable } from '@nestjs/common';

import { BearerAuthenticator } from './bearer.authenticator';
import { CookieSessionAuthenticator } from './cookie-session.authenticator';
import { RevalidationStatsService } from './revalidation-stats.service';
import { TicketAuthenticator } from './ticket.authenticator';

/** Prefix a WebSocket bearer authorization header carries. */
const BEARER_PREFIX = 'Bearer ';

/** Dispatches connection authentication across the cookie, ticket and bearer patterns. */
@Injectable()
export class CompositeAuthenticator implements IConnectionAuthenticator {
  /**
   * Build the composite authenticator.
   *
   * @param cookie - The cookie (Pattern A) authenticator and revocation check.
   * @param ticket - The one-shot ticket (Pattern B) authenticator.
   * @param bearer - The WebSocket bearer (Pattern C) authenticator.
   * @param stats - Records each revalidation so the reauth cache is observable.
   */
  constructor(
    private readonly cookie: CookieSessionAuthenticator,
    private readonly ticket: TicketAuthenticator,
    private readonly bearer: BearerAuthenticator,
    private readonly stats: RevalidationStatsService,
  ) {}

  /**
   * Authenticate a new connection by dispatching on its context.
   *
   * @param context - The transport-agnostic connection context.
   * @returns The authenticated traits, or `null` to reject the connection.
   */
  authenticate(context: ConnectionAuthContext): Promise<AuthenticationResult | null> {
    if (context.transport === 'websocket' && this.hasBearer(context)) {
      return this.bearer.authenticate(context);
    }
    if (typeof context.query['ticket'] === 'string') {
      return this.ticket.authenticate(context);
    }
    return this.cookie.authenticate(context);
  }

  /**
   * Re-validate a live session against the revocation check, counting the call.
   *
   * @param connectionId - The connection under review.
   * @param originalAuth - The traits captured when the connection opened.
   * @returns `true` to keep the connection, `false` once the user is revoked.
   */
  revalidate(connectionId: string, originalAuth: AuthenticationResult): Promise<boolean> {
    this.stats.record(originalAuth.userId);
    return this.cookie.revalidate(connectionId, originalAuth);
  }

  /** Report whether the context carries a bearer authorization header. */
  private hasBearer(context: ConnectionAuthContext): boolean {
    const header = context.headers['authorization'];
    return header !== undefined && header.startsWith(BEARER_PREFIX);
  }
}
