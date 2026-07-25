/**
 * @fileoverview Populates presence storage and announces roster changes.
 * @layer presence
 *
 * The installed library wires the presence token but neither calls
 * `IPresenceStorage` on connect/disconnect nor emits the presence event pair it
 * reserves, so the example does both from the lifecycle hooks it already owns.
 * On connect the connection is added to the shared storage; on disconnect it is
 * removed. Storage is keyed per connection, so a user with several tabs stays
 * online until the last one closes: this consumer therefore announces
 * `presence:online` only on a user's first connection and `presence:offline`
 * only after their last, which is exactly the transition a roster cares about.
 * The announcement is a tenant emit, keeping presence tenant-scoped, and it is
 * what makes the library's `usePresence()` hook live on the frontend.
 *
 * Which call owns the transition is decided by the storage write itself, which
 * returns the user's resulting connection count, never by reading the roster and
 * then writing it. The library fires lifecycle hooks without awaiting them, so a
 * refresh that reconnects while the old stream is still closing runs both hooks
 * concurrently; a read-then-write would let both see "already online" and drop
 * the arrival announcement, or let a departure be announced for a user who is
 * already back.
 */

import {
  type ConnectionEventMeta,
  type IConnectionLifecycleHooks,
  RealtimeService,
} from '@bymax-one/nest-realtime';
import { PRESENCE_EVENT_NAMES, type PresenceEventName } from '@bymax-one/nest-realtime/shared';
import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { REALTIME_PRESENCE } from '../realtime/realtime.tokens';
import type { RedisPresenceStorage } from '../realtime/redis-presence-storage';

/** Marks connections online/offline and announces the roster transitions. */
@Injectable()
export class PresenceTracker implements IConnectionLifecycleHooks, OnApplicationBootstrap {
  private readonly logger = new Logger(PresenceTracker.name);

  /**
   * Build the presence tracker.
   *
   * `RealtimeService` is resolved lazily rather than injected: this tracker is
   * part of the composite lifecycle hooks the library module receives through
   * `forRootAsync`, so depending on a provider that module exports would close a
   * construction-time cycle. Resolving at emit time breaks it, and by then the
   * container is fully built.
   *
   * @param presence - The shared presence storage.
   * @param moduleRef - Container handle used to resolve the emit API on demand.
   */
  constructor(
    @Inject(REALTIME_PRESENCE) private readonly presence: RedisPresenceStorage,
    private readonly moduleRef: ModuleRef,
  ) {}

  /**
   * Release the connections this instance left behind if it died without running
   * its shutdown hooks, so a restart never reports a dead stream as online.
   */
  async onApplicationBootstrap(): Promise<void> {
    await this.tolerate('startup reclaim', async () => {
      const released = await this.presence.reclaimOwnConnections();
      if (released > 0) {
        this.logger.log(`Reclaimed ${released} presence entries left by a previous run`);
      }
    });
  }

  /**
   * Mark a newly-registered connection online, announcing the user's arrival when
   * this is their first live connection.
   *
   * @param meta - The connection metadata (user, connection id and tenant).
   */
  async onConnect(meta: ConnectionEventMeta): Promise<void> {
    await this.tolerate('onConnect', async () => {
      const live = await this.presence.addConnection(meta.userId, meta.connectionId, meta.tenantId);
      if (live === 1) await this.announce(PRESENCE_EVENT_NAMES.ONLINE, meta);
    });
  }

  /**
   * Mark a closed connection offline, announcing the user's departure once their
   * last connection is gone.
   *
   * @param meta - The connection metadata of the closed stream.
   */
  async onDisconnect(meta: ConnectionEventMeta): Promise<void> {
    await this.tolerate('onDisconnect', async () => {
      const live = await this.presence.removeConnection(meta.userId, meta.connectionId);
      if (live === 0) await this.announce(PRESENCE_EVENT_NAMES.OFFLINE, meta);
    });
  }

  /** Announce a roster transition to the connection's tenant, when it has one. */
  private async announce(event: PresenceEventName, meta: ConnectionEventMeta): Promise<void> {
    if (meta.tenantId === undefined) return;
    const realtime = this.moduleRef.get(RealtimeService, { strict: false });
    await realtime.emitToTenant(meta.tenantId, event, { userId: meta.userId });
  }

  /**
   * Run a presence side effect without letting it escape into the library.
   *
   * These hooks run on the connection lifecycle path, including during shutdown
   * once the shared Redis client has already been released. Presence is a
   * best-effort mirror, so a storage outage must degrade the roster rather than
   * break the connection it is describing.
   *
   * A rejection value is not guaranteed to be an `Error`, so it is narrowed
   * before its message is read: a driver that rejects with a string would
   * otherwise log an empty reason and hide why the roster went stale.
   */
  private async tolerate(hook: string, run: () => Promise<void>): Promise<void> {
    try {
      await run();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`presence ${hook} skipped: ${reason}`);
    }
  }
}
