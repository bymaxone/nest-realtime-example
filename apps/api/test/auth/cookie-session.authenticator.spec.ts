/**
 * Unit tests for CookieSessionAuthenticator.
 *
 * Layer: unit.
 * Goal: cookie auth maps to client-safe traits and revalidate consults revocation.
 * Mocks: a real SessionService plus a revocation-store double.
 */

import type { AuthenticationResult, ConnectionAuthContext } from '@bymax-one/nest-realtime';

import { CookieSessionAuthenticator } from '../../src/auth/cookie-session.authenticator';
import type { IRevocationStore } from '../../src/auth/revocation.store';
import { SessionService } from '../../src/auth/session.service';
import type { DemoUser } from '../../src/auth/users.seed';
import { buildTestConfig } from '../support/config.fixture';

const SECRET = 'authenticator-secret-0123456789';
const USER: DemoUser = { id: 'ana@acme', tenantId: 'acme', roles: ['admin'] };

const sessions = new SessionService(buildTestConfig({ sessionSecret: SECRET }));

const buildContext = (cookies: Record<string, string>): ConnectionAuthContext => ({
  cookies,
  headers: {},
  query: {},
  ip: '127.0.0.1',
  userAgent: undefined,
  transport: 'sse',
});

const revocations = (revoked: boolean): IRevocationStore => ({
  isRevoked: jest.fn<Promise<boolean>, [string]>().mockResolvedValue(revoked),
});

describe('CookieSessionAuthenticator', () => {
  /**
   * Valid cookie.
   *
   * A valid session cookie must map to exactly the client-safe traits (no
   * metadata), which is what `connection:established` will expose.
   */
  it('maps a valid session cookie to client-safe traits', async () => {
    const auth = new CookieSessionAuthenticator(sessions, revocations(false));
    const token = sessions.issue(USER);

    const result = await auth.authenticate(buildContext({ session: token }));

    expect(result).toEqual({ userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] });
  });

  /**
   * Missing cookie.
   *
   * Without the session cookie the connection must be rejected with null.
   */
  it('rejects when the session cookie is absent', async () => {
    const auth = new CookieSessionAuthenticator(sessions, revocations(false));

    await expect(auth.authenticate(buildContext({}))).resolves.toBeNull();
  });

  /**
   * Invalid cookie.
   *
   * A forged or malformed token must be rejected with null.
   */
  it('rejects an invalid session cookie', async () => {
    const auth = new CookieSessionAuthenticator(sessions, revocations(false));

    await expect(auth.authenticate(buildContext({ session: 'garbage.token' }))).resolves.toBeNull();
  });

  /**
   * Live session.
   *
   * revalidate must keep a connection whose user is not revoked.
   */
  it('keeps a connection whose user is not revoked', async () => {
    const auth = new CookieSessionAuthenticator(sessions, revocations(false));
    const original: AuthenticationResult = {
      userId: 'ana@acme',
      tenantId: 'acme',
      roles: ['admin'],
    };

    await expect(auth.revalidate('conn-1', original)).resolves.toBe(true);
  });

  /**
   * Revoked session.
   *
   * revalidate must drop a connection once the user is revoked, powering the
   * kill-switch and reauth labs.
   */
  it('drops a connection whose user is revoked', async () => {
    const auth = new CookieSessionAuthenticator(sessions, revocations(true));
    const original: AuthenticationResult = {
      userId: 'ana@acme',
      tenantId: 'acme',
      roles: ['admin'],
    };

    await expect(auth.revalidate('conn-1', original)).resolves.toBe(false);
  });
});
