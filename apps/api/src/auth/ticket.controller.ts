/**
 * @fileoverview Endpoint that issues a one-shot SSE connection ticket.
 * @layer controller
 *
 * `POST /auth/ticket` requires a valid session cookie (the same guard the REST
 * surface uses) and mints a ticket bound to the caller's client-safe traits. The
 * ticket id is returned exactly once in the response body and never logged; the
 * client hands it to the SSE endpoint on the `?ticket=` query string.
 */

import { Controller, Post, UseGuards } from '@nestjs/common';

import { SessionTraitsParam } from './session-traits.decorator';
import { SessionGuard } from './session.guard';
import type { SessionTraits } from './session.types';
import { TicketService } from './ticket.service';

/** The minted-ticket response body. */
interface TicketResponse {
  readonly ticket: string;
}

/** Serves the one-shot ticket issuing endpoint under `/auth`. */
@Controller('auth')
export class TicketController {
  /**
   * Build the ticket controller.
   *
   * @param tickets - The one-shot ticket store.
   */
  constructor(private readonly tickets: TicketService) {}

  /**
   * Issue a one-shot ticket for the authenticated caller.
   *
   * @param traits - The guard-resolved client-safe traits.
   * @returns The opaque ticket id.
   */
  @Post('ticket')
  @UseGuards(SessionGuard)
  async issue(@SessionTraitsParam() traits: SessionTraits): Promise<TicketResponse> {
    const ticket = await this.tickets.issue(traits);
    return { ticket };
  }
}
