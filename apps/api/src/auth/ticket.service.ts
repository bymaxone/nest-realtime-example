/**
 * @fileoverview One-shot SSE connection ticket store (library auth Pattern B).
 * @layer auth
 *
 * A ticket is an opaque `randomUUID` whose value is the connecting user's
 * client-safe traits, held in Redis under `realtime:ticket:{id}` with a 60 second
 * TTL. Consumption uses `GETDEL` so a ticket is valid exactly once: a reuse, an
 * expiry or a forged id all resolve to `null` and the library treats the
 * connection as unauthenticated. The traits are never logged, so a leaked log can
 * never reveal who a ticket belonged to.
 */

import { randomUUID } from 'node:crypto';

import type { AuthenticationResult } from '@bymax-one/nest-realtime';
import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';

import { REDIS_CLIENT } from './auth.tokens';

/** Key prefix under which a pending ticket's traits are stored. */
const TICKET_KEY_PREFIX = 'realtime:ticket:';

/** Ticket lifetime in seconds; a ticket must be redeemed within this window. */
const TICKET_TTL_SECONDS = 60;

/** Narrow view of the Redis client the ticket store needs. */
export interface TicketRedis {
  /** Store a value with an expiry, mirroring `SET key value EX seconds`. */
  set(key: string, value: string, mode: 'EX', ttlSeconds: number): Promise<unknown>;
  /** Atomically read and delete a key, mirroring `GETDEL key`. */
  getdel(key: string): Promise<string | null>;
}

/** Runtime schema guarding a decoded ticket payload before it is trusted. */
const ticketTraitsSchema = z.object({
  userId: z.string().min(1),
  tenantId: z.string().min(1).optional(),
  roles: z.array(z.string()).optional(),
});

/** Issues and one-shot-consumes opaque SSE connection tickets. */
@Injectable()
export class TicketService {
  /**
   * Build the ticket store.
   *
   * @param redis - The shared Redis client.
   */
  constructor(@Inject(REDIS_CLIENT) private readonly redis: TicketRedis) {}

  /**
   * Issue a fresh ticket for an authenticated user.
   *
   * @param traits - The client-safe identity the ticket will authenticate as.
   * @returns The opaque ticket id the client presents on the SSE query string.
   */
  async issue(traits: AuthenticationResult): Promise<string> {
    const id = randomUUID();
    const payload = JSON.stringify({
      userId: traits.userId,
      tenantId: traits.tenantId,
      roles: traits.roles,
    });
    await this.redis.set(`${TICKET_KEY_PREFIX}${id}`, payload, 'EX', TICKET_TTL_SECONDS);
    return id;
  }

  /**
   * Redeem a ticket exactly once.
   *
   * @param id - The ticket id from the SSE query string.
   * @returns The stored traits, or `null` when the ticket is missing, already
   *   consumed, expired or malformed.
   */
  async consume(id: string): Promise<AuthenticationResult | null> {
    const raw = await this.redis.getdel(`${TICKET_KEY_PREFIX}${id}`);
    if (raw === null) return null;
    return this.parseTraits(raw);
  }

  /** Parse and validate a stored ticket payload, returning null on any fault. */
  private parseTraits(raw: string): AuthenticationResult | null {
    try {
      const result = ticketTraitsSchema.safeParse(JSON.parse(raw));
      if (!result.success) return null;
      const { userId, tenantId, roles } = result.data;
      // Omit absent optionals so the result matches AuthenticationResult under
      // exactOptionalPropertyTypes (a present `tenantId: undefined` is disallowed).
      return {
        userId,
        ...(tenantId !== undefined ? { tenantId } : {}),
        ...(roles !== undefined ? { roles } : {}),
      };
    } catch {
      return null;
    }
  }
}
