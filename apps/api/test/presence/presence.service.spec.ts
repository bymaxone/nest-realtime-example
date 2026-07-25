/**
 * Unit tests for PresenceService.
 *
 * Layer: unit.
 * Goal: the read service delegates the tenant roster to presence storage.
 * Mocks: a RedisPresenceStorage double.
 */

import { PresenceService } from '../../src/presence/presence.service';
import type { RedisPresenceStorage } from '../../src/realtime/redis-presence-storage';

describe('PresenceService', () => {
  /**
   * Delegation.
   *
   * The service must return the storage's tenant roster verbatim, so the REST
   * mirror and the live event stream never disagree about who is online.
   */
  it('delegates the tenant roster to presence storage', async () => {
    const presence = {
      listOnlineByTenant: jest.fn().mockResolvedValue(['ana@acme', 'bob@acme']),
    };
    const service = new PresenceService(presence as unknown as RedisPresenceStorage);

    expect(await service.listOnlineByTenant('acme')).toEqual(['ana@acme', 'bob@acme']);
    expect(presence.listOnlineByTenant).toHaveBeenCalledWith('acme');
  });

  /**
   * Empty tenant.
   *
   * A tenant with nobody connected must answer with an empty roster rather than
   * an error, so the presence page renders its empty state.
   */
  it('reports an empty roster for a tenant with no one online', async () => {
    const presence = { listOnlineByTenant: jest.fn().mockResolvedValue([]) };
    const service = new PresenceService(presence as unknown as RedisPresenceStorage);

    expect(await service.listOnlineByTenant('globex')).toEqual([]);
  });
});
