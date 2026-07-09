/**
 * @fileoverview Connection registry introspection and the ownership-guarded kill switch.
 * @layer connections
 *
 * Reads the library's `ConnectionRegistry` (the source of truth for active
 * connections on this instance) and force-closes a connection through the
 * library's `RealtimeService`. The kill switch is anti-IDOR: a caller may only
 * disconnect a connection they own, so one user can never tear down another
 * user's stream by guessing its id.
 */

import {
  ConnectionRegistry,
  type PublicConnectionMeta,
  RealtimeService,
} from '@bymax-one/nest-realtime';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

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
   */
  constructor(
    private readonly registry: ConnectionRegistry,
    private readonly realtime: RealtimeService,
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
   * Force-disconnect a connection the caller owns.
   *
   * @param connectionId - The connection to close.
   * @param callerUserId - The authenticated caller's user id.
   * @throws NotFoundException when no such connection exists on this instance.
   * @throws ForbiddenException when the connection belongs to another user.
   */
  async disconnectOwned(connectionId: string, callerUserId: string): Promise<void> {
    const record = this.registry.get(connectionId);
    if (!record) throw new NotFoundException('unknown connection');
    if (record.userId !== callerUserId) throw new ForbiddenException('not your connection');
    await this.realtime.disconnect(connectionId, DISCONNECT_REASON_LOGGED_OUT);
  }
}
