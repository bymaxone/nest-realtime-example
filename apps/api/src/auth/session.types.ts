/**
 * @fileoverview Client-safe session traits and the request augmentation.
 * @layer auth
 *
 * `SessionTraits` is the only auth data exposed to controllers and responses; it
 * deliberately excludes the raw token and any secret. The request augmentation
 * lets the session guard attach the traits for downstream param decorators.
 */

import type { Request } from 'express';

/** The client-safe identity attached to an authenticated request. */
export interface SessionTraits {
  readonly userId: string;
  readonly tenantId: string;
  readonly roles: readonly string[];
}

/** An Express request that may carry resolved session traits. */
export interface RequestWithSession extends Request {
  sessionTraits?: SessionTraits;
}
