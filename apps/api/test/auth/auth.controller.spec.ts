/**
 * Unit tests for AuthController.
 *
 * Layer: unit.
 * Goal: login sets a hardened cookie, logout clears it, and identity echoes traits.
 * Mocks: a real SessionService plus an Express response double.
 */

import { UnauthorizedException } from '@nestjs/common';

import { SESSION_COOKIE_NAME, SESSION_TTL_MS } from '../../src/auth/auth.constants';
import { AuthController } from '../../src/auth/auth.controller';
import { SessionService } from '../../src/auth/session.service';
import { buildTestConfig } from '../support/config.fixture';
import { mockResponse } from '../support/nest.fixture';

const sessions = new SessionService(
  buildTestConfig({ sessionSecret: 'controller-secret-0123456789' }),
);
const controller = new AuthController(sessions, buildTestConfig());

describe('AuthController', () => {
  /**
   * Successful login.
   *
   * A known user must receive an HttpOnly, SameSite=Lax, insecure-in-dev cookie
   * carrying a verifiable token, and the response body must expose only traits.
   */
  it('issues a hardened session cookie and returns traits', () => {
    const { res, cookie } = mockResponse();

    const result = controller.login({ username: 'ana@acme' }, res);

    expect(result).toEqual({ userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] });
    const [name, value, options] = cookie.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(name).toBe(SESSION_COOKIE_NAME);
    expect(sessions.verify(value)).not.toBeNull();
    expect(options).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: SESSION_TTL_MS,
    });
  });

  /**
   * Unknown user.
   *
   * A username outside the seed must be rejected with 401 and set no cookie.
   */
  it('rejects an unknown demo user', () => {
    const { res, cookie } = mockResponse();

    expect(() => controller.login({ username: 'eve@evil' }, res)).toThrow(UnauthorizedException);
    expect(cookie).not.toHaveBeenCalled();
  });

  /**
   * Logout.
   *
   * Logout must clear the cookie with matching attributes so the browser drops it.
   */
  it('clears the session cookie on logout', () => {
    const { res, clearCookie } = mockResponse();

    expect(controller.logout(res)).toEqual({ ok: true });
    const [name, options] = clearCookie.mock.calls[0] as [string, Record<string, unknown>];
    expect(name).toBe(SESSION_COOKIE_NAME);
    expect(options).toEqual({ httpOnly: true, sameSite: 'lax', secure: false, path: '/' });
  });

  /**
   * Identity echo.
   *
   * `/me` must return exactly the guard-resolved traits.
   */
  it('returns the current session traits', () => {
    const traits = { userId: 'gil@globex', tenantId: 'globex', roles: ['admin'] };

    expect(controller.me(traits)).toBe(traits);
  });

  /**
   * Secure cookie under HTTPS.
   *
   * When the web origin is HTTPS the cookie must be marked Secure so it never
   * rides an insecure transport.
   */
  it('marks the cookie Secure when the web origin is https', () => {
    const httpsController = new AuthController(
      sessions,
      buildTestConfig({ webOrigin: 'https://app.example.com' }),
    );
    const { res, cookie } = mockResponse();

    httpsController.login({ username: 'bob@acme' }, res);

    const [, , options] = cookie.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(options).toMatchObject({ secure: true });
  });
});
