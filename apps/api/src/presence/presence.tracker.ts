/**
 * @fileoverview Populates presence storage from connection lifecycle events.
 * @layer presence
 *
 * The installed library wires the presence token but does not itself call
 * `IPresenceStorage` on connect or disconnect, so the example populates it from the
 * lifecycle hooks it already owns: this consumer joins the composite hooks and
 * marks a connection online on connect and offline on disconnect. When no presence
 * storage is configured (memory mode), every call is a no-op, so a single-instance
 * boot carries no presence state and needs no Redis.
 */

import type { ConnectionEventMeta, IConnectionLifecycleHooks } from '@bymax-one/nest-realtime';
import { Inject, Injectable } from '@nestjs/common';

import { REALTIME_PRESENCE } from '../realtime/realtime.tokens';
import type { RedisPresenceStorage } from '../realtime/redis-presence-storage';

/** Marks connections online/offline in presence storage as they come and go. */
@Injectable()
export class PresenceTracker implements IConnectionLifecycleHooks {
  /**
   * Build the presence tracker.
   *
   * @param presence - The shared presence storage, or `undefined` in memory mode.
   */
  constructor(
    @Inject(REALTIME_PRESENCE) private readonly presence: RedisPresenceStorage | undefined,
  ) {}

  /**
   * Mark a newly-registered connection online.
   *
   * @param meta - The connection metadata (user, connection id and tenant).
   */
  async onConnect(meta: ConnectionEventMeta): Promise<void> {
    await this.presence?.setOnline(meta.userId, meta.connectionId, meta.tenantId);
  }

  /**
   * Mark a closed connection offline.
   *
   * @param meta - The connection metadata of the closed stream.
   */
  async onDisconnect(meta: ConnectionEventMeta): Promise<void> {
    await this.presence?.setOffline(meta.userId, meta.connectionId);
  }
}
