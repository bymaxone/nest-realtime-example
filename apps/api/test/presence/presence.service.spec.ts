/**
 * Unit tests for PresenceService.
 *
 * Layer: unit.
 * Goal: the read service delegates to presence storage, or reports an empty roster
 *       when presence is disabled.
 * Mocks: a RedisPresenceStorage double (or undefined for memory mode).
 */

import { PresenceService } from '../../src/presence/presence.service';
import type { RedisPresenceStorage } from '../../src/realtime/redis-presence-storage';

describe('PresenceService', () => {
  /**
   * Delegation.
   *
   * With presence configured, the service must return the storage's tenant roster
   * verbatim.
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
   * Presence disabled.
   *
   * In memory mode (no presence storage) the service must report an empty roster so
   * the endpoint answers without a Redis dependency.
   */
  it('returns an empty roster when presence is disabled', async () => {
    const service = new PresenceService(undefined);

    expect(await service.listOnlineByTenant('acme')).toEqual([]);
  });
});
