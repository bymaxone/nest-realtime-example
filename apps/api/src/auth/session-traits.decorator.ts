/**
 * @fileoverview Param decorator exposing the guard-resolved session traits.
 * @layer auth
 *
 * Reads the traits the {@link SessionGuard} attached to the request. It must be
 * used on a route the guard protects; otherwise the traits are absent and the
 * request is rejected rather than served without an identity.
 */

import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';

import type { RequestWithSession, SessionTraits } from './session.types';

/**
 * Resolve the client-safe session traits attached by {@link SessionGuard}.
 *
 * @param _data - Unused decorator argument.
 * @param ctx - The current execution context.
 * @returns The request's {@link SessionTraits}.
 * @throws UnauthorizedException when traits are absent (guard not applied).
 */
export function resolveSessionTraits(_data: unknown, ctx: ExecutionContext): SessionTraits {
  const request = ctx.switchToHttp().getRequest<RequestWithSession>();
  if (!request.sessionTraits) throw new UnauthorizedException();
  return request.sessionTraits;
}

/** Injects the client-safe {@link SessionTraits} resolved by the session guard. */
export const SessionTraitsParam = createParamDecorator(resolveSessionTraits);
