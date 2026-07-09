/**
 * @fileoverview Bearer connection authenticator (library auth Pattern C, WS-only).
 * @layer auth
 *
 * Verifies the short-lived HMAC bearer token a WebSocket client presents. The
 * library surfaces `handshake.auth.token` as the `authorization` header on the
 * connection context (and strips that header for SSE), so this authenticator
 * reads `ctx.headers['authorization']` and refuses any non-WebSocket transport.
 */

import type {
  AuthenticationResult,
  ConnectionAuthContext,
  IConnectionAuthenticator,
} from '@bymax-one/nest-realtime';
import { Injectable } from '@nestjs/common';

import { WsTokenService } from './ws-token.service';

/** Prefix every bearer authorization header carries. */
export const BEARER_PREFIX = 'Bearer ';

/** Authenticates WebSocket connections from a short-lived bearer token. */
@Injectable()
export class BearerAuthenticator implements IConnectionAuthenticator {
  /**
   * Build the authenticator.
   *
   * @param wsTokens - Verifies the minted bearer token.
   */
  constructor(private readonly wsTokens: WsTokenService) {}

  /**
   * Authenticate a WebSocket connection from its bearer token.
   *
   * @param context - The transport-agnostic connection context.
   * @returns The verified traits, or `null` for a non-WebSocket transport, an
   *   absent/ill-formed header, or an invalid token.
   */
  authenticate(context: ConnectionAuthContext): Promise<AuthenticationResult | null> {
    if (context.transport !== 'websocket') return Promise.resolve(null);
    const header = context.headers['authorization'];
    if (header === undefined || !header.startsWith(BEARER_PREFIX)) return Promise.resolve(null);
    const payload = this.wsTokens.verify(header.slice(BEARER_PREFIX.length));
    const result = payload
      ? { userId: payload.sub, tenantId: payload.tid, roles: payload.roles }
      : null;
    return Promise.resolve(result);
  }
}
