/**
 * @fileoverview Read side of presence for the REST mirror.
 * @layer presence
 *
 * Wraps the optional presence storage so the controller never has to reason about
 * the driver: when presence is configured (redis) it returns the live roster; in
 * memory mode it reports an empty roster, so a single-instance boot answers the
 * endpoint without a Redis dependency.
 */

import { Inject, Injectable } from '@nestjs/common';

import { REALTIME_PRESENCE } from '../realtime/realtime.tokens';
import type { RedisPresenceStorage } from '../realtime/redis-presence-storage';

/** Serves the presence roster from the optional presence storage. */
@Injectable()
export class PresenceService {
  /**
   * Build the presence read service.
   *
   * @param presence - The shared presence storage, or `undefined` in memory mode.
   */
  constructor(
    @Inject(REALTIME_PRESENCE) private readonly presence: RedisPresenceStorage | undefined,
  ) {}

  /**
   * List the online users in a tenant.
   *
   * @param tenantId - The tenant to list.
   * @returns The online user ids, or an empty list when presence is disabled.
   */
  listOnlineByTenant(tenantId: string): Promise<string[]> {
    return this.presence ? this.presence.listOnlineByTenant(tenantId) : Promise.resolve([]);
  }
}
