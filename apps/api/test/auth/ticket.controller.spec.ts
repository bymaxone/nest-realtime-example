/**
 * Unit tests for TicketController.
 *
 * Layer: unit.
 * Goal: the endpoint issues a ticket for the guard-resolved traits and returns
 *       only the opaque id.
 * Mocks: a TicketService double.
 */

import { TicketController } from '../../src/auth/ticket.controller';
import type { SessionTraits } from '../../src/auth/session.types';
import type { TicketService } from '../../src/auth/ticket.service';

const TRAITS: SessionTraits = { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] };

describe('TicketController', () => {
  /**
   * Issue contract.
   *
   * The controller must mint a ticket for exactly the caller's traits and expose
   * only `{ ticket }` (never the traits) in the response body.
   */
  it('issues a ticket bound to the caller traits and returns only the id', async () => {
    const issue = jest.fn().mockResolvedValue('ticket-123');
    const controller = new TicketController({ issue } as unknown as TicketService);

    const response = await controller.issue(TRAITS);

    expect(issue).toHaveBeenCalledWith(TRAITS);
    expect(response).toEqual({ ticket: 'ticket-123' });
  });
});
