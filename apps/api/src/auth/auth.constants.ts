/**
 * @fileoverview Shared constants for the demo session-cookie auth.
 * @layer auth
 *
 * Centralizes the cookie name and lifetime so the signer, the SSE authenticator,
 * the REST guard and the controller all agree on one contract.
 */

/** Name of the HttpOnly session cookie carrying the signed demo token. */
export const SESSION_COOKIE_NAME = 'session';

/** Session lifetime in seconds; the signed token carries a matching `exp`. */
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

/** Session lifetime in milliseconds for the cookie `Max-Age` attribute. */
export const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;
