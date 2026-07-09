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

/**
 * Lifetime of a minted WebSocket bearer token in seconds. Kept short (10 minutes)
 * because a bearer is a hand-off credential presented once at the WS handshake,
 * not a long-lived session.
 */
export const WS_TOKEN_TTL_SECONDS = 10 * 60;

/** Role a caller must hold to reach an admin-only endpoint (revoke, broadcast). */
export const ADMIN_ROLE = 'admin';
