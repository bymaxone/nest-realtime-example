/**
 * Unit tests for the demo user seed.
 *
 * Layer: unit.
 * Goal: lookup finds seeded users and rejects unknown ones.
 * Mocks: none.
 */

import { DEMO_USERS, findDemoUser } from '../../src/auth/users.seed';

describe('users.seed', () => {
  /**
   * Two-tenant coverage.
   *
   * The isolation scenarios need principals in both `acme` and `globex`, so the
   * seed must contain the documented ids across the two tenants.
   */
  it('seeds users across both demo tenants', () => {
    expect(DEMO_USERS.map((user) => user.id)).toEqual(['ana@acme', 'bob@acme', 'gil@globex']);
    expect(DEMO_USERS.filter((user) => user.tenantId === 'acme')).toHaveLength(2);
  });

  /**
   * Known lookup.
   *
   * A seeded username must resolve to its full record so login can issue a token.
   */
  it('finds a seeded user by id', () => {
    expect(findDemoUser('bob@acme')).toEqual({
      id: 'bob@acme',
      tenantId: 'acme',
      roles: ['member'],
    });
  });

  /**
   * Unknown lookup.
   *
   * An unseeded username must return undefined so login can reject it.
   */
  it('returns undefined for an unknown user', () => {
    expect(findDemoUser('eve@evil')).toBeUndefined();
  });
});
