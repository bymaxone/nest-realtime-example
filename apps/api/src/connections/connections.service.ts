/**
 * @fileoverview Connection registry introspection and the ownership-guarded kill switch.
 * @layer connections
 *
 * Reads the library's `ConnectionRegistry` (the source of truth for active
 * connections on this instance) and force-closes a connection through the
 * library's `RealtimeService`. The kill switch is anti-IDOR: a caller may only
 * disconnect a connection they own, so one user can never tear down another
 * user's stream by guessing its id. Ownership is verified locally for a connection
 * on this instance; for a connection living on another instance it is verified
 * against the shared presence index, and the disconnect is published cluster-wide
 * (the library turns `disconnect()` into an `op:'disconnect'` message the owning
 * instance applies).
 */

import {
  ConnectionRegistry,
  type PublicConnectionMeta,
  RealtimeService,
} from '@bymax-one/nest-realtime';
import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { REALTIME_PRESENCE } from '../realtime/realtime.tokens';
import type { RedisPresenceStorage } from '../realtime/redis-presence-storage';

/** Reason surfaced when a connection is closed by the kill switch. */
const DISCONNECT_REASON_LOGGED_OUT = 'USER_LOGGED_OUT';

/** Introspects and force-closes active realtime connections. */
@Injectable()
export class ConnectionsService {
  /**
   * Build the connections service.
   *
   * @param registry - The library registry of active connections.
   * @param realtime - The library realtime API (used for force-disconnect).
   * @param presence - The shared presence index, or `undefined` in single-instance
   *   mode; used to authorize a cross-instance disconnect.
   */
  constructor(
    private readonly registry: ConnectionRegistry,
    private readonly realtime: RealtimeService,
    @Inject(REALTIME_PRESENCE) private readonly presence: RedisPresenceStorage | undefined,
  ) {}

  /**
   * List the active SSE connections on this instance.
   *
   * @returns One client-safe metadata record per active connection.
   */
  list(): PublicConnectionMeta[] {
    return this.registry.allByTransport('sse').map((record) => ({
      connectionId: record.connectionId,
      userId: record.userId,
      ...(record.tenantId !== undefined ? { tenantId: record.tenantId } : {}),
      transport: record.transport,
      connectedAt: record.connectedAt,
    }));
  }

  /**
   * Force-disconnect a connection the caller owns, on this instance or another.
   *
   * A connection on this instance is checked against the local registry; one that
   * is not local is checked against the shared presence index, and the disconnect
   * is then published cluster-wide so the owning instance closes it.
   *
   * @param connectionId - The connection to close.
   * @param callerUserId - The authenticated caller's user id.
   * @throws NotFoundException when the caller owns no such connection anywhere.
   * @throws ForbiddenException when a local connection belongs to another user.
   */
  async disconnectOwned(connectionId: string, callerUserId: string): Promise<void> {
    const record = this.registry.get(connectionId);
    if (record) {
      if (record.userId !== callerUserId) throw new ForbiddenException('not your connection');
      await this.realtime.disconnect(connectionId, DISCONNECT_REASON_LOGGED_OUT);
      return;
    }
    if (
      !this.presence ||
      !(await this.presence.isConnectionOwnedByUser(callerUserId, connectionId))
    ) {
      throw new NotFoundException('unknown connection');
    }
    await this.realtime.disconnect(connectionId, DISCONNECT_REASON_LOGGED_OUT);
  }
}
