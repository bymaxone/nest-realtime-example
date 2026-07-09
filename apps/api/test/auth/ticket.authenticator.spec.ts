/**
 * Unit tests for TicketAuthenticator.
 *
 * Layer: unit.
 * Goal: a single string ticket is redeemed through the store; an absent or
 *       repeated (array) ticket is rejected without touching the store.
 * Mocks: a TicketService double.
 */

import type { ConnectionAuthContext } from '@bymax-one/nest-realtime';

import { TicketAuthenticator } from '../../src/auth/ticket.authenticator';
import type { TicketService } from '../../src/auth/ticket.service';

/** Build a connection context whose query carries the given ticket value. */
function contextWithTicket(ticket: string | string[] | undefined): ConnectionAuthContext {
  return {
    cookies: {},
    headers: {},
    query: ticket === undefined ? {} : { ticket },
    ip: '127.0.0.1',
    userAgent: undefined,
    transport: 'sse',
  };
}

describe('TicketAuthenticator', () => {
  /**
   * Happy path.
   *
   * A single-string ticket must be redeemed through the store and its traits
   * returned to the library.
   */
  it('redeems a single string ticket through the store', async () => {
    const consume = jest.fn().mockResolvedValue({ userId: 'ana@acme', tenantId: 'acme' });
    const authenticator = new TicketAuthenticator({ consume } as unknown as TicketService);

    const result = await authenticator.authenticate(contextWithTicket('t-1'));

    expect(consume).toHaveBeenCalledWith('t-1');
    expect(result).toEqual({ userId: 'ana@acme', tenantId: 'acme' });
  });

  /**
   * Missing-ticket rejection.
   *
   * Without a ticket query parameter the authenticator must return null and never
   * call the store, so a cookie-less connection with no ticket is simply rejected.
   */
  it('returns null and skips the store when no ticket is present', async () => {
    const consume = jest.fn();
    const authenticator = new TicketAuthenticator({ consume } as unknown as TicketService);

    const result = await authenticator.authenticate(contextWithTicket(undefined));

    expect(result).toBeNull();
    expect(consume).not.toHaveBeenCalled();
  });

  /**
   * Repeated-parameter rejection.
   *
   * A repeated `?ticket=a&ticket=b` arrives as an array; the authenticator must
   * reject it rather than guess which one to redeem.
   */
  it('returns null and skips the store for a repeated (array) ticket', async () => {
    const consume = jest.fn();
    const authenticator = new TicketAuthenticator({ consume } as unknown as TicketService);

    const result = await authenticator.authenticate(contextWithTicket(['a', 'b']));

    expect(result).toBeNull();
    expect(consume).not.toHaveBeenCalled();
  });
});
