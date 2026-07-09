/**
 * Unit tests for WsTokenService.
 *
 * Layer: unit.
 * Goal: a minted bearer carries a 10-minute expiry and round-trips through the
 *       shared HMAC verifier; a forged or expired token verifies to null.
 * Mocks: none; a real SessionService over a test config exercises the HMAC path.
 */

import { SessionService } from '../../src/auth/session.service';
import { WsTokenService } from '../../src/auth/ws-token.service';
import type { SessionTraits } from '../../src/auth/session.types';
import { buildTestConfig } from '../support/config.fixture';

const TRAITS: SessionTraits = { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] };

/** Build a WsTokenService over a real SessionService with a fixed secret. */
function buildService(): { service: WsTokenService; sessions: SessionService } {
  const sessions = new SessionService(buildTestConfig());
  return { service: new WsTokenService(sessions), sessions };
}

describe('WsTokenService', () => {
  /**
   * Mint contract.
   *
   * A minted token must expire exactly 600 seconds after the supplied clock and
   * verify back to the caller's claims (checked within the window), proving the
   * 10-minute bearer works.
   */
  it('mints a 10-minute token that verifies back to the traits', () => {
    const { service, sessions } = buildService();

    const grant = service.mint(TRAITS, 1000);
    const payload = sessions.verify(grant.token, 1500);

    expect(grant.expiresAt).toBe(new Date(1600 * 1000).toISOString());
    expect(payload).toEqual({ sub: 'ana@acme', tid: 'acme', roles: ['admin'], exp: 1600 });
  });

  /**
   * Expiry edge case.
   *
   * Verifying after the 10-minute window has elapsed must return null so a stale
   * bearer cannot authenticate a WebSocket handshake.
   */
  it('verifies to null once the token has expired', () => {
    const { service, sessions } = buildService();

    const grant = service.mint(TRAITS, 1000);

    expect(sessions.verify(grant.token, 2000)).toBeNull();
  });

  /**
   * Default clock.
   *
   * Called without an explicit clock, mint must default to the wall clock: the
   * token then verifies as valid under the real clock and its expiry sits ~600s
   * ahead, exercising the default-parameter path.
   */
  it('defaults to the wall clock when no time is supplied', () => {
    const { service } = buildService();
    const before = Math.floor(Date.now() / 1000);

    const grant = service.mint(TRAITS);
    const payload = service.verify(grant.token);

    expect(payload?.sub).toBe('ana@acme');
    expect(payload?.exp).toBeGreaterThanOrEqual(before + 600);
  });

  /**
   * Forgery rejection.
   *
   * A tampered token (any non-signed string) must verify to null, proving the
   * HMAC guards the bearer just as it guards the session cookie.
   */
  it('verifies to null for a forged token', () => {
    const { service } = buildService();

    expect(service.verify('not.a.valid.token')).toBeNull();
  });
});
