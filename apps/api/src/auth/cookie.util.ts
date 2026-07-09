/**
 * @fileoverview Extracts the session token from a raw Cookie header.
 * @layer auth
 *
 * The library parses cookies for the SSE stream itself; the REST guard needs the
 * same value from the raw header, so this helper isolates that single parse.
 */

import { parse } from 'cookie';

import { SESSION_COOKIE_NAME } from './auth.constants';

/**
 * Read the session token from a raw `Cookie` header.
 *
 * @param header - The raw `Cookie` header value, if present.
 * @returns The session token, or `undefined` when absent.
 */
export function extractSessionCookie(header: string | undefined): string | undefined {
  if (!header) return undefined;
  return parse(header)[SESSION_COOKIE_NAME];
}
