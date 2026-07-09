/**
 * @fileoverview Cookie-based connection authenticator (library Pattern A).
 * @layer auth
 *
 * Implements the library's `IConnectionAuthenticator` by verifying the HttpOnly
 * HMAC session cookie. This is the SSE-safe pattern: an `EventSource` cannot send
 * custom headers, so the credential must ride in the cookie. `revalidate`
 * consults the Redis revocation store so long-lived sessions can be killed.
 */

import type {
  AuthenticationResult,
  ConnectionAuthContext,
  IConnectionAuthenticator,
} from '@bymax-one/nest-realtime';
import { Inject, Injectable } from '@nestjs/common';

import { SESSION_COOKIE_NAME } from './auth.constants';
import { REVOCATION_STORE } from './auth.tokens';
import type { IRevocationStore } from './revocation.store';
import { SessionService } from './session.service';

/** Authenticates realtime connections from the signed session cookie. */
@Injectable()
export class CookieSessionAuthenticator implements IConnectionAuthenticator {
  /**
   * Build the authenticator.
   *
   * @param sessions - Verifies the signed session token.
   * @param revocations - Reports whether a user's sessions were revoked.
   */
  constructor(
    private readonly sessions: SessionService,
    @Inject(REVOCATION_STORE) private readonly revocations: IRevocationStore,
  ) {}

  /**
   * Authenticate a new connection from its session cookie.
   *
   * @param context - The transport-agnostic connection context.
   * @returns The client-safe traits, or `null` to reject the connection.
   */
  authenticate(context: ConnectionAuthContext): Promise<AuthenticationResult | null> {
    const token = context.cookies[SESSION_COOKIE_NAME];
    const payload = token ? this.sessions.verify(token) : null;
    const result = payload
      ? { userId: payload.sub, tenantId: payload.tid, roles: payload.roles }
      : null;
    return Promise.resolve(result);
  }

  /**
   * Re-validate a live session against the revocation store.
   *
   * @param _connectionId - The connection under review (unused; kept per contract).
   * @param originalAuth - The traits captured when the connection opened.
   * @returns `true` to keep the connection, `false` once the user is revoked.
   */
  async revalidate(_connectionId: string, originalAuth: AuthenticationResult): Promise<boolean> {
    return !(await this.revocations.isRevoked(originalAuth.userId));
  }
}
