/**
 * @fileoverview Emit console service delegating 1:1 to the library.
 * @layer emit
 *
 * Each method forwards to the matching `RealtimeService` primitive. The tenant
 * emit is the seam where per-tenant ownership (anti-IDOR) enforcement is added
 * later; today the console requires an authenticated caller (the controller
 * guard) and delegates without additional restriction.
 */

import { RealtimeService } from '@bymax-one/nest-realtime';
import { Injectable } from '@nestjs/common';

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
   * Emit an event to every connection within a tenant.
   *
   * Per-tenant ownership enforcement is layered on this method in a later phase;
   * it currently delegates for any authenticated caller.
   *
   * @param tenantId - Target tenant id.
   * @param event - Event name.
   * @param data - Free-form payload.
   */
  emitToTenant(tenantId: string, event: string, data: unknown): Promise<void> {
    return this.realtime.emitToTenant(tenantId, event, data);
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
