/**
 * @fileoverview Ticket-based connection authenticator (library auth Pattern B).
 * @layer auth
 *
 * Implements the library's `IConnectionAuthenticator` for clients that cannot
 * ride a cookie (for example a cross-origin `EventSource`): the one-shot ticket
 * arrives on the `?ticket=` query parameter, which the library surfaces on
 * `ctx.query`. A repeated key (`?ticket=a&ticket=b`) arrives as an array and is
 * rejected outright, so only a single well-formed ticket is ever redeemed.
 */

import type {
  AuthenticationResult,
  ConnectionAuthContext,
  IConnectionAuthenticator,
} from '@bymax-one/nest-realtime';
import { Injectable } from '@nestjs/common';

import { TicketService } from './ticket.service';

/** Authenticates realtime connections from a one-shot query-string ticket. */
@Injectable()
export class TicketAuthenticator implements IConnectionAuthenticator {
  /**
   * Build the authenticator.
   *
   * @param tickets - The one-shot ticket store.
   */
  constructor(private readonly tickets: TicketService) {}

  /**
   * Authenticate a new connection by redeeming its ticket.
   *
   * @param context - The transport-agnostic connection context.
   * @returns The redeemed traits, or `null` when the ticket is absent, repeated,
   *   already used, expired or malformed.
   */
  authenticate(context: ConnectionAuthContext): Promise<AuthenticationResult | null> {
    const ticket = context.query['ticket'];
    if (typeof ticket !== 'string') return Promise.resolve(null);
    return this.tickets.consume(ticket);
  }
}
