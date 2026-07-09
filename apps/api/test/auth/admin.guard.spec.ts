/**
 * Unit tests for AdminGuard.
 *
 * Layer: unit.
 * Goal: only a session whose traits include the admin role is admitted; a member
 *       or a request with no attached traits is rejected with 403.
 * Mocks: an execution-context double carrying the request.
 */

import { ForbiddenException } from '@nestjs/common';

import { AdminGuard } from '../../src/auth/admin.guard';
import type { RequestWithSession } from '../../src/auth/session.types';
import { mockHttpContext } from '../support/nest.fixture';

describe('AdminGuard', () => {
  /**
   * Admin admitted.
   *
   * A session carrying the admin role must be admitted so operators can reach the
   * privileged endpoints.
   */
  it('admits a session with the admin role', () => {
    const context = mockHttpContext({
      sessionTraits: { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] },
    } as Partial<RequestWithSession>);

    expect(new AdminGuard().canActivate(context)).toBe(true);
  });

  /**
   * Member rejected.
   *
   * A non-admin session must be rejected with 403, so a member cannot revoke
   * others or broadcast.
   */
  it('rejects a session without the admin role', () => {
    const context = mockHttpContext({
      sessionTraits: { userId: 'bob@acme', tenantId: 'acme', roles: ['member'] },
    } as Partial<RequestWithSession>);

    expect(() => new AdminGuard().canActivate(context)).toThrow(ForbiddenException);
  });

  /**
   * Missing traits.
   *
   * With no traits attached (guard misordering or unauthenticated), the guard must
   * fail closed with 403 rather than admit.
   */
  it('rejects a request with no attached traits', () => {
    const context = mockHttpContext({});

    expect(() => new AdminGuard().canActivate(context)).toThrow(ForbiddenException);
  });
});
