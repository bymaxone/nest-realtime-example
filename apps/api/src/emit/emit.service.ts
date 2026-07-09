/**
 * @fileoverview Emit console service delegating to the library with a tenant guard.
 * @layer emit
 *
 * Each method forwards to the matching `RealtimeService` primitive. The tenant
 * emit is anti-IDOR: the library does not verify tenant ownership, so this
 * service rejects (403) any attempt to emit to a tenant other than the caller's
 * before the event ever reaches `RealtimeService`. The room emit is scoped the
 * same way: the console may only target resource/custom rooms, never the
 * library's auto-joined `user:` / `tenant:` scope rooms (which would otherwise let
 * a caller reach another user or tenant through a room id and bypass the tenant
 * guard).
 */

import { RealtimeService } from '@bymax-one/nest-realtime';
import { ROOM_PREFIXES } from '@bymax-one/nest-realtime/shared';
import { ForbiddenException, Injectable } from '@nestjs/common';

/** Scope-room prefixes the emit console must not target directly. */
const SCOPED_ROOM_PREFIXES: readonly string[] = [
  `${ROOM_PREFIXES.USER}:`,
  `${ROOM_PREFIXES.TENANT}:`,
];

/** Delegates emit-console operations to the library's realtime API. */
@Injectable()
export class EmitService {
  /**
   * Build the emit service.
   *
   * @param realtime - The library realtime API.
   */
  constructor(private readonly realtime: RealtimeService) {}

  /**
   * Emit an event to every connection of a single user.
   *
   * @param userId - Target user id.
   * @param event - Event name.
   * @param data - Free-form payload.
   */
  emitToUser(userId: string, event: string, data: unknown): Promise<void> {
    return this.realtime.emitToUser(userId, event, data);
  }

  /**
   * Emit an event to every connection within the caller's own tenant.
   *
   * @param callerTenantId - The authenticated caller's tenant id.
   * @param targetTenantId - The tenant to emit to.
   * @param event - Event name.
   * @param data - Free-form payload.
   * @throws ForbiddenException when the target tenant is not the caller's.
   */
  async emitToTenant(
    callerTenantId: string,
    targetTenantId: string,
    event: string,
    data: unknown,
  ): Promise<void> {
    if (targetTenantId !== callerTenantId) {
      throw new ForbiddenException('cross-tenant emit denied');
    }
    await this.realtime.emitToTenant(targetTenantId, event, data);
  }

  /**
   * Emit an event to every connection in a resource or custom room.
   *
   * @param roomId - Target room id (must not be a `user:` / `tenant:` scope room).
   * @param event - Event name.
   * @param data - Free-form payload.
   * @throws ForbiddenException when the room id targets a library scope room.
   */
  async emitToRoom(roomId: string, event: string, data: unknown): Promise<void> {
    if (SCOPED_ROOM_PREFIXES.some((prefix) => roomId.startsWith(prefix))) {
      throw new ForbiddenException('cannot emit to a user or tenant scope room');
    }
    await this.realtime.emitToRoom(roomId, event, data);
  }

  /**
   * Broadcast an event to every connected client.
   *
   * @param event - Event name.
   * @param data - Free-form payload.
   */
  broadcast(event: string, data: unknown): Promise<void> {
    return this.realtime.broadcast(event, data);
  }
}
