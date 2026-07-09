/**
 * @fileoverview Resource-room join/leave with an anti-IDOR ownership check.
 * @layer rooms
 *
 * Composes resource room ids via the library convention and delegates membership
 * to `RealtimeService`. The library deliberately does not verify that a
 * connection belongs to the caller, so this service does: a caller may only
 * join, leave or list rooms for a connection they own. Rooms are orthogonal to
 * tenants; joining a resource room never grants a tenant's events.
 */

import { composeRoomId, ConnectionRegistry, RealtimeService } from '@bymax-one/nest-realtime';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { RoomMembershipTracker } from '../lifecycle/room-membership.tracker';

/** Joins, leaves and lists a caller's resource rooms. */
@Injectable()
export class RoomsService {
  /**
   * Build the rooms service.
   *
   * @param registry - The library registry, used for the ownership check.
   * @param realtime - The library realtime API (join/leave delegation).
   * @param tracker - The app-side membership view backing `GET /rooms/mine`.
   */
  constructor(
    private readonly registry: ConnectionRegistry,
    private readonly realtime: RealtimeService,
    private readonly tracker: RoomMembershipTracker,
  ) {}

  /**
   * Join the caller's connection to a resource room (idempotent).
   *
   * @param connectionId - The caller's connection id.
   * @param resourceType - The resource type (for example `incident`).
   * @param resourceId - The resource id.
   * @param callerUserId - The authenticated caller's user id.
   * @returns The composed room id.
   */
  async join(
    connectionId: string,
    resourceType: string,
    resourceId: string,
    callerUserId: string,
  ): Promise<string> {
    this.assertOwned(connectionId, callerUserId);
    const roomId = composeRoomId('RESOURCE', resourceType, resourceId);
    await this.realtime.joinRoom(connectionId, roomId);
    this.tracker.join(connectionId, roomId);
    return roomId;
  }

  /**
   * Remove the caller's connection from a resource room (idempotent).
   *
   * @param connectionId - The caller's connection id.
   * @param resourceType - The resource type.
   * @param resourceId - The resource id.
   * @param callerUserId - The authenticated caller's user id.
   * @returns The composed room id.
   */
  async leave(
    connectionId: string,
    resourceType: string,
    resourceId: string,
    callerUserId: string,
  ): Promise<string> {
    this.assertOwned(connectionId, callerUserId);
    const roomId = composeRoomId('RESOURCE', resourceType, resourceId);
    await this.realtime.leaveRoom(connectionId, roomId);
    this.tracker.leave(connectionId, roomId);
    return roomId;
  }

  /**
   * List the rooms one of the caller's connections belongs to.
   *
   * @param connectionId - The caller's connection id.
   * @param callerUserId - The authenticated caller's user id.
   * @returns The room ids the connection joined.
   */
  mine(connectionId: string, callerUserId: string): string[] {
    this.assertOwned(connectionId, callerUserId);
    return this.tracker.roomsFor(connectionId);
  }

  /** Reject an operation on a connection the caller does not own. */
  private assertOwned(connectionId: string, callerUserId: string): void {
    const record = this.registry.get(connectionId);
    if (!record) throw new NotFoundException('unknown connection');
    if (record.userId !== callerUserId) throw new ForbiddenException('not your connection');
  }
}
