/**
 * Unit tests for SessionGuard.
 *
 * Layer: unit.
 * Goal: only requests with a valid session cookie pass, and traits are attached.
 * Mocks: a real SessionService plus an execution-context double.
 */

import { UnauthorizedException } from '@nestjs/common';

import { SessionGuard } from '../../src/auth/session.guard';
import { SessionService } from '../../src/auth/session.service';
import type { RequestWithSession } from '../../src/auth/session.types';
import type { DemoUser } from '../../src/auth/users.seed';
import { buildTestConfig } from '../support/config.fixture';
import { mockHttpContext } from '../support/nest.fixture';

const USER: DemoUser = { id: 'ana@acme', tenantId: 'acme', roles: ['admin'] };
const sessions = new SessionService(
  buildTestConfig({ sessionSecret: 'guard-secret-0123456789abc' }),
);
const guard = new SessionGuard(sessions);

describe('SessionGuard', () => {
  /**
   * Authenticated request.
   *
   * A valid session cookie must admit the request and attach the client-safe
   * traits for downstream param decorators.
   */
  it('admits a request with a valid session cookie and attaches traits', () => {
    const request: Partial<RequestWithSession> = {
      headers: { cookie: `session=${sessions.issue(USER)}` },
    };

    expect(guard.canActivate(mockHttpContext(request))).toBe(true);
    expect(request.sessionTraits).toEqual({
      userId: 'ana@acme',
      tenantId: 'acme',
      roles: ['admin'],
    });
  });

  /**
   * Missing credential.
   *
   * A request with no session cookie must be rejected with 401.
   */
  it('rejects a request with no session cookie', () => {
    expect(() => guard.canActivate(mockHttpContext({ headers: {} }))).toThrow(
      UnauthorizedException,
    );
  });

  /**
   * Invalid credential.
   *
   * A request carrying a forged token must be rejected with 401.
   */
  it('rejects a request with an invalid session cookie', () => {
    const request: Partial<RequestWithSession> = { headers: { cookie: 'session=forged.token' } };

    expect(() => guard.canActivate(mockHttpContext(request))).toThrow(UnauthorizedException);
  });
});
