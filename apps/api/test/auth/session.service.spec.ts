/**
 * Unit tests for SessionService.
 *
 * Layer: unit.
 * Goal: signing round-trips and every tamper/expiry/malformed path returns null.
 * Mocks: none; a real HMAC over a fixed test secret.
 */

import { createHmac } from 'node:crypto';

import { SessionService, type SessionPayload } from '../../src/auth/session.service';
import type { DemoUser } from '../../src/auth/users.seed';
import { buildTestConfig } from '../support/config.fixture';

const SECRET = 'unit-test-session-secret-abcdef';
const USER: DemoUser = { id: 'ana@acme', tenantId: 'acme', roles: ['admin'] };

const build = (): SessionService => new SessionService(buildTestConfig({ sessionSecret: SECRET }));

/** Forge a token with a valid signature over an arbitrary encoded payload. */
function forge(encodedPayload: string): string {
  const signature = createHmac('sha256', SECRET).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

describe('SessionService', () => {
  /**
   * Happy round-trip.
   *
   * A freshly issued token must verify back to the same claims, proving sign and
   * verify agree on encoding and the HMAC.
   */
  it('issues a token that verifies back to the user claims', () => {
    const service = build();

    const token = service.issue(USER, 1000);
    const payload = service.verify(token, 1001);

    expect(payload).toEqual({
      sub: 'ana@acme',
      tid: 'acme',
      roles: ['admin'],
      exp: 1000 + 8 * 60 * 60,
    });
  });

  /**
   * Default-clock round-trip.
   *
   * Exercises the default `nowSeconds` on both issue and verify so a real-clock
   * token is accepted immediately after issuance.
   */
  it('accepts a token issued and verified against the real clock', () => {
    const service = build();

    expect(service.verify(service.issue(USER))).not.toBeNull();
  });

  /**
   * Structural rejection.
   *
   * A token without exactly two segments cannot carry a payload and signature, so
   * it must be rejected before any HMAC work.
   */
  it('rejects tokens without exactly two segments', () => {
    const service = build();

    expect(service.verify('single-segment')).toBeNull();
    expect(service.verify('a.b.c')).toBeNull();
    expect(service.verify('.onlysig')).toBeNull();
    expect(service.verify('onlypayload.')).toBeNull();
  });

  /**
   * Payload tampering.
   *
   * Mutating the payload invalidates the HMAC, so verification must fail even
   * though the segment count is intact.
   */
  it('rejects a tampered payload', () => {
    const service = build();
    const token = service.issue(USER, 1000);
    const [payload, signature] = token.split('.');
    const tampered = `${payload ?? ''}x.${signature ?? ''}`;

    expect(service.verify(tampered, 1001)).toBeNull();
  });

  /**
   * Signature tampering (equal length).
   *
   * A same-length but altered signature must fail the constant-time compare.
   */
  it('rejects a tampered signature of equal length', () => {
    const service = build();
    const token = service.issue(USER, 1000);
    const [payload, signature] = token.split('.');
    const flipped = (signature ?? '').startsWith('A')
      ? `B${(signature ?? '').slice(1)}`
      : `A${(signature ?? '').slice(1)}`;

    expect(service.verify(`${payload ?? ''}.${flipped}`, 1001)).toBeNull();
  });

  /**
   * Signature length mismatch.
   *
   * A signature that decodes to a different byte length must be rejected before
   * `timingSafeEqual`, which throws on unequal lengths.
   */
  it('rejects a signature of the wrong length', () => {
    const service = build();
    const token = service.issue(USER, 1000);
    const [payload] = token.split('.');

    expect(service.verify(`${payload ?? ''}.AA`, 1001)).toBeNull();
  });

  /**
   * Expiry.
   *
   * A token whose `exp` is at or before the current second must be rejected.
   */
  it('rejects an expired token', () => {
    const service = build();
    const token = service.issue(USER, 1000);

    expect(service.verify(token, 1000 + 8 * 60 * 60)).toBeNull();
  });

  /**
   * Malformed decoded payload.
   *
   * A validly-signed token whose payload is not JSON must be rejected by the
   * decode guard rather than crashing.
   */
  it('rejects a validly-signed but non-JSON payload', () => {
    const service = build();
    const encoded = Buffer.from('not-json').toString('base64url');

    expect(service.verify(forge(encoded), 1)).toBeNull();
  });

  /**
   * Wrong-shape decoded payload.
   *
   * A validly-signed token whose JSON does not match the claims schema must be
   * rejected, protecting downstream code from trusting arbitrary objects.
   */
  it('rejects a validly-signed payload of the wrong shape', () => {
    const service = build();
    const encoded = Buffer.from(JSON.stringify({ foo: 'bar' })).toString('base64url');

    expect(service.verify(forge(encoded), 1)).toBeNull();
  });

  /**
   * Explicit sign path.
   *
   * Signing a hand-built payload and verifying it proves `sign` is usable
   * directly (used by the drift between issue and verify).
   */
  it('signs and verifies an explicit payload', () => {
    const service = build();
    const payload: SessionPayload = { sub: 'gil@globex', tid: 'globex', roles: [], exp: 5000 };

    expect(service.verify(service.sign(payload), 4999)).toEqual(payload);
  });
});
