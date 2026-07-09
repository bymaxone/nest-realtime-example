/**
 * @fileoverview Guard that admits only sessions holding the admin role.
 * @layer auth
 *
 * Reads the client-safe traits the {@link SessionGuard} attached to the request,
 * so it must run after `SessionGuard` in the `@UseGuards(SessionGuard, AdminGuard)`
 * chain. It protects the privileged lab endpoints (revocation, broadcast) from
 * ordinary members: a non-admin session is rejected with 403 rather than served.
 */

import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { ADMIN_ROLE } from './auth.constants';
import type { RequestWithSession } from './session.types';

/** Rejects authenticated requests that lack the admin role. */
@Injectable()
export class AdminGuard implements CanActivate {
  /**
   * Admit the request only when its session holds the admin role.
   *
   * @param context - The current execution context.
   * @returns `true` when the session is an admin.
   * @throws ForbiddenException when the session lacks the admin role.
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithSession>();
    const isAdmin = request.sessionTraits?.roles?.includes(ADMIN_ROLE) ?? false;
    if (!isAdmin) throw new ForbiddenException('admin role required');
    return true;
  }
}
