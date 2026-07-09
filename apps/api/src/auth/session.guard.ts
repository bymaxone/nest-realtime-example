/**
 * @fileoverview Guard that admits only requests carrying a valid session cookie.
 * @layer auth
 *
 * Verifies the signed session token from the raw Cookie header and attaches the
 * resolved client-safe traits to the request so downstream param decorators can
 * read them. It shares one verification path with the SSE authenticator, so REST
 * and stream auth never diverge.
 */

import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { extractSessionCookie } from './cookie.util';
import { SessionService } from './session.service';
import type { RequestWithSession } from './session.types';

/** Rejects unauthenticated REST requests and exposes session traits. */
@Injectable()
export class SessionGuard implements CanActivate {
  /**
   * Build the guard.
   *
   * @param sessions - Verifies the signed session token.
   */
  constructor(private readonly sessions: SessionService) {}

  /**
   * Admit the request only when it carries a valid session cookie.
   *
   * @param context - The current execution context.
   * @returns `true` when authenticated.
   * @throws UnauthorizedException when the cookie is missing or invalid.
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithSession>();
    const token = extractSessionCookie(request.headers.cookie);
    const payload = token ? this.sessions.verify(token) : null;
    if (!payload) throw new UnauthorizedException();
    // Attach the client-safe traits for the SessionTraits param decorator.
    request.sessionTraits = { userId: payload.sub, tenantId: payload.tid, roles: payload.roles };
    return true;
  }
}
