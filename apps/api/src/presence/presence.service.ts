/**
 * @fileoverview Read side of presence for the REST mirror.
 * @layer presence
 *
 * Wraps the presence storage so the controller never has to reason about the
 * driver behind the roster, only about the tenant it is asking for.
 */

import { Inject, Injectable } from '@nestjs/common';

import { REALTIME_PRESENCE } from '../realtime/realtime.tokens';
import type { RedisPresenceStorage } from '../realtime/redis-presence-storage';

/** Serves the presence roster from the shared presence storage. */
@Injectable()
export class PresenceService {
  /**
   * Build the presence read service.
   *
   * @param presence - The shared presence storage.
   */
  constructor(@Inject(REALTIME_PRESENCE) private readonly presence: RedisPresenceStorage) {}

  /**
   * List the online users in a tenant.
   *
   * @param tenantId - The tenant to list.
   * @returns The online user ids of that tenant.
   */
  listOnlineByTenant(tenantId: string): Promise<string[]> {
    return this.presence.listOnlineByTenant(tenantId);
  }
}
