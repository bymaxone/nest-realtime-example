/**
 * @fileoverview App-side record of which resource rooms each connection joined.
 * @layer lifecycle
 *
 * The library's room registry is internal, so the example keeps its own view to
 * answer `GET /rooms/mine`. It is a lifecycle consumer: on disconnect it drops the
 * connection's membership so the view never leaks stale rooms for a dead
 * connection. Joins and leaves are idempotent (set semantics), matching the
 * library's idempotent `joinRoom` / `leaveRoom`.
 */

import type { ConnectionEventMeta, IConnectionLifecycleHooks } from '@bymax-one/nest-realtime';
import { Injectable } from '@nestjs/common';

/** Tracks per-connection resource-room membership for the rooms endpoints. */
@Injectable()
export class RoomMembershipTracker implements IConnectionLifecycleHooks {
  private readonly byConnection = new Map<string, Set<string>>();

  /**
   * Record that a connection joined a room (idempotent).
   *
   * @param connectionId - The connection joining.
   * @param roomId - The room joined.
   */
  join(connectionId: string, roomId: string): void {
    const rooms = this.byConnection.get(connectionId) ?? new Set<string>();
    rooms.add(roomId);
    this.byConnection.set(connectionId, rooms);
  }

  /**
   * Record that a connection left a room (idempotent).
   *
   * @param connectionId - The connection leaving.
   * @param roomId - The room left.
   */
  leave(connectionId: string, roomId: string): void {
    this.byConnection.get(connectionId)?.delete(roomId);
  }

  /**
   * List the rooms a connection currently belongs to.
   *
   * @param connectionId - The connection to inspect.
   * @returns The room ids, sorted for a stable response.
   */
  roomsFor(connectionId: string): string[] {
    return [...(this.byConnection.get(connectionId) ?? [])].sort((a, b) => a.localeCompare(b));
  }

  /**
   * Drop a connection's membership when it closes.
   *
   * @param meta - The connection metadata.
   */
  onDisconnect(meta: ConnectionEventMeta): void {
    this.byConnection.delete(meta.connectionId);
  }
}
