/**
 * Unit tests for BearerAuthenticator.
 *
 * Layer: unit.
 * Goal: only a WebSocket transport with a well-formed, valid Bearer header
 *       authenticates; SSE, a missing/ill-formed header and a bad token all reject.
 * Mocks: a WsTokenService double controlling verification.
 */

import type { ConnectionAuthContext } from '@bymax-one/nest-realtime';

import { BearerAuthenticator } from '../../src/auth/bearer.authenticator';
import type { SessionPayload } from '../../src/auth/session.service';
import type { WsTokenService } from '../../src/auth/ws-token.service';

/** Build a connection context with the given transport and optional auth header. */
function context(transport: 'sse' | 'websocket', authorization?: string): ConnectionAuthContext {
  return {
    cookies: {},
    headers: authorization === undefined ? {} : { authorization },
    query: {},
    ip: '127.0.0.1',
    userAgent: undefined,
    transport,
  };
}

const PAYLOAD: SessionPayload = { sub: 'ana@acme', tid: 'acme', roles: ['admin'], exp: 2000 };

/** Build a BearerAuthenticator over a WsTokenService double. */
function build(verify: jest.Mock): BearerAuthenticator {
  return new BearerAuthenticator({ verify } as unknown as WsTokenService);
}

describe('BearerAuthenticator', () => {
  /**
   * Happy path.
   *
   * A WebSocket handshake with a valid Bearer token must return the token's
   * traits, mapping sub/tid/roles onto the library's AuthenticationResult.
   */
  it('authenticates a WebSocket Bearer token', async () => {
    const verify = jest.fn().mockReturnValue(PAYLOAD);
    const authenticator = build(verify);

    const result = await authenticator.authenticate(context('websocket', 'Bearer good-token'));

    expect(verify).toHaveBeenCalledWith('good-token');
    expect(result).toEqual({ userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] });
  });

  /**
   * SSE rejection.
   *
   * An `EventSource` cannot send headers, so the bearer pattern must never apply
   * to SSE: the authenticator returns null without touching the verifier.
   */
  it('returns null for a non-WebSocket transport', async () => {
    const verify = jest.fn();
    const authenticator = build(verify);

    const result = await authenticator.authenticate(context('sse', 'Bearer good-token'));

    expect(result).toBeNull();
    expect(verify).not.toHaveBeenCalled();
  });

  /**
   * Missing / ill-formed header.
   *
   * Without an `authorization` header, or one lacking the `Bearer ` prefix, the
   * authenticator must reject and skip verification.
   */
  it('returns null when the Bearer header is absent or ill-formed', async () => {
    const verify = jest.fn();
    const authenticator = build(verify);

    await expect(authenticator.authenticate(context('websocket'))).resolves.toBeNull();
    await expect(authenticator.authenticate(context('websocket', 'Basic abc'))).resolves.toBeNull();
    expect(verify).not.toHaveBeenCalled();
  });

  /**
   * Invalid token.
   *
   * A well-formed header whose token fails verification must resolve to null so a
   * forged or expired bearer is refused.
   */
  it('returns null when the token fails verification', async () => {
    const verify = jest.fn().mockReturnValue(null);
    const authenticator = build(verify);

    const result = await authenticator.authenticate(context('websocket', 'Bearer stale'));

    expect(result).toBeNull();
  });
});
