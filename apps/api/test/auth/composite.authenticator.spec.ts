/**
 * Unit tests for CompositeAuthenticator.
 *
 * Layer: unit.
 * Goal: authenticate dispatches bearer (ws+token) → ticket → cookie in that order;
 *       revalidate records a stat and delegates to the cookie revocation check.
 * Mocks: per-pattern authenticator doubles; a real RevalidationStatsService.
 */

import type { AuthenticationResult, ConnectionAuthContext } from '@bymax-one/nest-realtime';

import type { BearerAuthenticator } from '../../src/auth/bearer.authenticator';
import { CompositeAuthenticator } from '../../src/auth/composite.authenticator';
import type { CookieSessionAuthenticator } from '../../src/auth/cookie-session.authenticator';
import { RevalidationStatsService } from '../../src/auth/revalidation-stats.service';
import type { TicketAuthenticator } from '../../src/auth/ticket.authenticator';

/** The per-pattern doubles and the composite built over them. */
interface Harness {
  readonly composite: CompositeAuthenticator;
  readonly cookieAuth: jest.Mock;
  readonly ticketAuth: jest.Mock;
  readonly bearerAuth: jest.Mock;
  readonly cookieRevalidate: jest.Mock;
  readonly stats: RevalidationStatsService;
}

/** Build a composite over authenticator doubles and a real stats service. */
function build(): Harness {
  const cookieAuth = jest.fn().mockResolvedValue({ userId: 'cookie' });
  const ticketAuth = jest.fn().mockResolvedValue({ userId: 'ticket' });
  const bearerAuth = jest.fn().mockResolvedValue({ userId: 'bearer' });
  const cookieRevalidate = jest.fn().mockResolvedValue(true);
  const stats = new RevalidationStatsService();
  const composite = new CompositeAuthenticator(
    {
      authenticate: cookieAuth,
      revalidate: cookieRevalidate,
    } as unknown as CookieSessionAuthenticator,
    { authenticate: ticketAuth } as unknown as TicketAuthenticator,
    { authenticate: bearerAuth } as unknown as BearerAuthenticator,
    stats,
  );
  return { composite, cookieAuth, ticketAuth, bearerAuth, cookieRevalidate, stats };
}

/** Build a connection context for a transport with optional header/ticket. */
function context(
  transport: 'sse' | 'websocket',
  extras: { authorization?: string; ticket?: string } = {},
): ConnectionAuthContext {
  return {
    cookies: {},
    headers: extras.authorization === undefined ? {} : { authorization: extras.authorization },
    query: extras.ticket === undefined ? {} : { ticket: extras.ticket },
    ip: '127.0.0.1',
    userAgent: undefined,
    transport,
  };
}

describe('CompositeAuthenticator', () => {
  /**
   * Bearer wins on WebSocket + token.
   *
   * A WebSocket handshake carrying a Bearer header must dispatch to the bearer
   * authenticator, even if a ticket is also present, matching the documented order.
   */
  it('dispatches to bearer for a WebSocket handshake with a token', async () => {
    const h = build();

    const result = await h.composite.authenticate(
      context('websocket', { authorization: 'Bearer t', ticket: 'tk' }),
    );

    expect(result).toEqual({ userId: 'bearer' });
    expect(h.bearerAuth).toHaveBeenCalledTimes(1);
    expect(h.ticketAuth).not.toHaveBeenCalled();
    expect(h.cookieAuth).not.toHaveBeenCalled();
  });

  /**
   * Ticket path.
   *
   * Any connection with a `?ticket=` parameter and no WS bearer must dispatch to
   * the ticket authenticator.
   */
  it('dispatches to ticket when a ticket query parameter is present', async () => {
    const h = build();

    const result = await h.composite.authenticate(context('sse', { ticket: 'tk' }));

    expect(result).toEqual({ userId: 'ticket' });
    expect(h.ticketAuth).toHaveBeenCalledTimes(1);
    expect(h.cookieAuth).not.toHaveBeenCalled();
  });

  /**
   * Cookie fallback.
   *
   * With neither a WS bearer nor a ticket, the composite must fall back to the
   * cookie authenticator (the SSE-safe default).
   */
  it('falls back to cookie when neither bearer nor ticket applies', async () => {
    const h = build();

    const result = await h.composite.authenticate(context('sse'));

    expect(result).toEqual({ userId: 'cookie' });
    expect(h.cookieAuth).toHaveBeenCalledTimes(1);
  });

  /**
   * WebSocket without a bearer.
   *
   * A WebSocket handshake lacking a Bearer header must not use the bearer path; a
   * ticket is honored, else it falls back to cookie.
   */
  it('does not use bearer on a WebSocket handshake without a token', async () => {
    const h = build();

    await h.composite.authenticate(context('websocket'));

    expect(h.bearerAuth).not.toHaveBeenCalled();
    expect(h.cookieAuth).toHaveBeenCalledTimes(1);
  });

  /**
   * Revalidation delegates + counts.
   *
   * revalidate must record the check for the user (so the reauth cache is
   * observable) and return the cookie revocation verdict verbatim.
   */
  it('records a stat and delegates revalidate to the cookie check', async () => {
    const h = build();
    const auth: AuthenticationResult = { userId: 'ana@acme', tenantId: 'acme' };
    h.cookieRevalidate.mockResolvedValueOnce(false);

    const kept = await h.composite.revalidate('conn-1', auth);

    expect(kept).toBe(false);
    expect(h.cookieRevalidate).toHaveBeenCalledWith('conn-1', auth);
    expect(h.stats.countFor('ana@acme')).toBe(1);
  });
});
