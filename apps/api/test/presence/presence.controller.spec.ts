/**
 * Unit tests for PresenceController.
 *
 * Layer: unit.
 * Goal: a caller reads only their own tenant's roster; another tenant is forbidden.
 * Mocks: a PresenceService double.
 */

import { ForbiddenException } from '@nestjs/common';

import { PresenceController } from '../../src/presence/presence.controller';
import type { PresenceService } from '../../src/presence/presence.service';
import type { SessionTraits } from '../../src/auth/session.types';

const anaTraits: SessionTraits = { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] };

describe('PresenceController', () => {
  /**
   * Own-tenant roster.
   *
   * A caller must receive their own tenant's online roster under a tenant-tagged
   * envelope.
   */
  it('returns the online roster for the caller own tenant', async () => {
    const service = {
      listOnlineByTenant: jest.fn().mockResolvedValue(['ana@acme', 'bob@acme']),
    };
    const controller = new PresenceController(service as unknown as PresenceService);

    expect(await controller.roster('acme', anaTraits)).toEqual({
      tenantId: 'acme',
      online: ['ana@acme', 'bob@acme'],
    });
    expect(service.listOnlineByTenant).toHaveBeenCalledWith('acme');
  });

  /**
   * Anti-IDOR across tenants.
   *
   * A caller must not read another tenant's roster: the endpoint rejects a tenant
   * that is not the caller's own before touching presence.
   */
  it('forbids reading another tenant roster', async () => {
    const service = { listOnlineByTenant: jest.fn() };
    const controller = new PresenceController(service as unknown as PresenceService);

    await expect(controller.roster('globex', anaTraits)).rejects.toThrow(ForbiddenException);
    expect(service.listOnlineByTenant).not.toHaveBeenCalled();
  });
});
