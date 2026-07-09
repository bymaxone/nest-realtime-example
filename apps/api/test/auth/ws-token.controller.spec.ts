/**
 * Unit tests for WsTokenController.
 *
 * Layer: unit.
 * Goal: the endpoint mints a bearer for the guard-resolved traits and returns the
 *       grant verbatim.
 * Mocks: a WsTokenService double.
 */

import { WsTokenController } from '../../src/auth/ws-token.controller';
import type { SessionTraits } from '../../src/auth/session.types';
import type { WsTokenGrant, WsTokenService } from '../../src/auth/ws-token.service';

const TRAITS: SessionTraits = { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] };

describe('WsTokenController', () => {
  /**
   * Mint contract.
   *
   * The controller must mint a bearer for exactly the caller's traits and return
   * the grant (token + expiry) unchanged.
   */
  it('mints a bearer for the caller traits', () => {
    const grant: WsTokenGrant = { token: 'tok', expiresAt: '2026-07-09T00:00:00.000Z' };
    const mint = jest.fn().mockReturnValue(grant);
    const controller = new WsTokenController({ mint } as unknown as WsTokenService);

    const response = controller.mint(TRAITS);

    expect(mint).toHaveBeenCalledWith(TRAITS);
    expect(response).toBe(grant);
  });
});
