/**
 * Unit tests for extractSessionCookie.
 *
 * Layer: unit.
 * Goal: the session token is parsed from the raw header when present.
 * Mocks: none.
 */

import { extractSessionCookie } from '../../src/auth/cookie.util';

describe('extractSessionCookie', () => {
  /**
   * Present cookie.
   *
   * The session value must be extracted from among other cookies.
   */
  it('reads the session token from the header', () => {
    expect(extractSessionCookie('other=1; session=abc.def; theme=dark')).toBe('abc.def');
  });

  /**
   * Absent header.
   *
   * With no Cookie header there is no token to return.
   */
  it('returns undefined when no header is present', () => {
    expect(extractSessionCookie(undefined)).toBeUndefined();
  });

  /**
   * Header without the session cookie.
   *
   * A header that lacks the session key yields undefined so the guard rejects.
   */
  it('returns undefined when the session cookie is absent', () => {
    expect(extractSessionCookie('theme=dark')).toBeUndefined();
  });
});
