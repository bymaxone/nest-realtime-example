/**
 * Unit tests for resolveSessionTraits.
 *
 * Layer: unit.
 * Goal: the decorator factory returns attached traits or rejects when absent.
 * Mocks: an execution-context double.
 */

import { UnauthorizedException } from '@nestjs/common';

import { resolveSessionTraits } from '../../src/auth/session-traits.decorator';
import { mockHttpContext } from '../support/nest.fixture';

describe('resolveSessionTraits', () => {
  /**
   * Traits present.
   *
   * When the guard has attached traits, the decorator must return them verbatim.
   */
  it('returns the traits attached by the guard', () => {
    const traits = { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] };

    expect(resolveSessionTraits(undefined, mockHttpContext({ sessionTraits: traits }))).toBe(
      traits,
    );
  });

  /**
   * Traits absent.
   *
   * Without traits (guard not applied) the decorator must reject rather than
   * serve an unauthenticated identity.
   */
  it('throws when no traits are attached', () => {
    expect(() => resolveSessionTraits(undefined, mockHttpContext({}))).toThrow(
      UnauthorizedException,
    );
  });
});
