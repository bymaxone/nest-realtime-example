/**
 * @fileoverview Emit console service delegating to the library with a tenant guard.
 * @layer emit
 *
 * Each method forwards to the matching `RealtimeService` primitive. The tenant
 * emit is anti-IDOR: the library does not verify tenant ownership, so this
 * service rejects (403) any attempt to emit to a tenant other than the caller's
 * before the event ever reaches `RealtimeService`.
 */

import { RealtimeService } from '@bymax-one/nest-realtime';
import { ForbiddenException, Injectable } from '@nestjs/common';

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
   * Emit an event to every connection in a room.
   *
   * @param roomId - Target room id.
   * @param event - Event name.
   * @param data - Free-form payload.
   */
  emitToRoom(roomId: string, event: string, data: unknown): Promise<void> {
    return this.realtime.emitToRoom(roomId, event, data);
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
