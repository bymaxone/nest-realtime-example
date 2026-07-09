/**
 * Unit tests for RevocationController.
 *
 * Layer: unit.
 * Goal: POST revokes and DELETE clears the marker for the path user, returning a
 *       stable acknowledgement.
 * Mocks: an IRevocationStore double.
 */

import { RevocationController } from '../../src/auth/revocation.controller';
import type { IRevocationStore } from '../../src/auth/revocation.store';

/** Build the controller over a revocation store double. */
function build(): { controller: RevocationController; revoke: jest.Mock; unrevoke: jest.Mock } {
  const revoke = jest.fn().mockResolvedValue(undefined);
  const unrevoke = jest.fn().mockResolvedValue(undefined);
  const store = { revoke, unrevoke, isRevoked: jest.fn() } as unknown as IRevocationStore;
  return { controller: new RevocationController(store), revoke, unrevoke };
}

describe('RevocationController', () => {
  /**
   * Revoke.
   *
   * POST must revoke the path user and acknowledge revoked=true.
   */
  it('revokes the path user', async () => {
    const { controller, revoke } = build();

    const ack = await controller.revoke('ana@acme');

    expect(revoke).toHaveBeenCalledWith('ana@acme');
    expect(ack).toEqual({ userId: 'ana@acme', revoked: true });
  });

  /**
   * Unrevoke.
   *
   * DELETE must clear the path user and acknowledge revoked=false.
   */
  it('clears the path user', async () => {
    const { controller, unrevoke } = build();

    const ack = await controller.unrevoke('ana@acme');

    expect(unrevoke).toHaveBeenCalledWith('ana@acme');
    expect(ack).toEqual({ userId: 'ana@acme', revoked: false });
  });
});
