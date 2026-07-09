/**
 * @fileoverview Mints and verifies short-lived WebSocket bearer tokens.
 * @layer auth
 *
 * A bearer is the WebSocket-only credential (library auth Pattern C): an
 * `EventSource` cannot send headers, but a Socket.IO handshake can. The token
 * reuses the exact HMAC primitives of the session cookie signer, differing only
 * in its short 10-minute expiry, so there is a single signing/verification path
 * to reason about. The structure is ready here; the WebSocket transport consumes
 * it when that profile is enabled.
 */

import { Injectable } from '@nestjs/common';

import { WS_TOKEN_TTL_SECONDS } from './auth.constants';
import { type SessionPayload, SessionService } from './session.service';
import type { SessionTraits } from './session.types';

/** Milliseconds per second, for epoch conversions. */
const MS_PER_SECOND = 1000;

/** A minted WebSocket bearer token and its absolute expiry. */
export interface WsTokenGrant {
  readonly token: string;
  readonly expiresAt: string;
}

/** Issues and verifies HMAC-signed, short-lived WebSocket bearer tokens. */
@Injectable()
export class WsTokenService {
  /**
   * Build the token service.
   *
   * @param sessions - The HMAC signer/verifier shared with the session cookie.
   */
  constructor(private readonly sessions: SessionService) {}

  /**
   * Mint a 10-minute bearer token for an authenticated caller.
   *
   * @param traits - The client-safe identity the token authenticates as.
   * @param nowSeconds - Current epoch seconds (injectable for deterministic tests).
   * @returns The signed token and its absolute expiry timestamp.
   */
  mint(
    traits: SessionTraits,
    nowSeconds: number = Math.floor(Date.now() / MS_PER_SECOND),
  ): WsTokenGrant {
    const exp = nowSeconds + WS_TOKEN_TTL_SECONDS;
    const token = this.sessions.sign({
      sub: traits.userId,
      tid: traits.tenantId,
      roles: traits.roles,
      exp,
    });
    return { token, expiresAt: new Date(exp * MS_PER_SECOND).toISOString() };
  }

  /**
   * Verify a bearer token's signature and expiry.
   *
   * @param token - The raw bearer token from the WS handshake.
   * @returns The decoded claims, or `null` when invalid or expired.
   */
  verify(token: string): SessionPayload | null {
    return this.sessions.verify(token);
  }
}
