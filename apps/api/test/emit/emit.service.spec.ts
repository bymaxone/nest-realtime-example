/**
 * Unit tests for EmitService.
 *
 * Layer: unit.
 * Goal: each console operation delegates 1:1 to the library realtime API.
 * Mocks: a RealtimeService double with per-method spies.
 */

import { ForbiddenException } from '@nestjs/common';

import { EmitService } from '../../src/emit/emit.service';
import { mockRealtimeService, type RealtimeMock } from '../support/realtime.fixture';

describe('EmitService', () => {
  let realtime: RealtimeMock;
  let service: EmitService;

  beforeEach(() => {
    realtime = mockRealtimeService();
    service = new EmitService(realtime.service);
  });

  /**
   * User delegation.
   *
   * emitToUser must forward the user id, event and data unchanged.
   */
  it('delegates emitToUser', async () => {
    await service.emitToUser('ana@acme', 'order.created', { id: 1 });

    expect(realtime.emitToUser).toHaveBeenCalledWith('ana@acme', 'order.created', { id: 1 });
  });

  /**
   * Same-tenant delegation.
   *
   * emitToTenant must forward to the library only when the target tenant is the
   * caller's own tenant.
   */
  it('delegates emitToTenant within the caller tenant', async () => {
    await service.emitToTenant('acme', 'acme', 'order.paid', { id: 2 });

    expect(realtime.emitToTenant).toHaveBeenCalledWith('acme', 'order.paid', { id: 2 });
  });

  /**
   * Anti-IDOR rejection.
   *
   * Emitting to a tenant other than the caller's must throw before the library is
   * touched, so no cross-tenant event is ever delivered.
   */
  it('rejects a cross-tenant emit before touching the library', async () => {
    await expect(service.emitToTenant('acme', 'globex', 'order.paid', {})).rejects.toThrow(
      ForbiddenException,
    );
    expect(realtime.emitToTenant).not.toHaveBeenCalled();
  });

  /**
   * Room delegation.
   *
   * emitToRoom must forward the room id, event and data unchanged.
   */
  it('delegates emitToRoom', async () => {
    await service.emitToRoom('resource:incident:1', 'order.shipped', { id: 3 });

    expect(realtime.emitToRoom).toHaveBeenCalledWith('resource:incident:1', 'order.shipped', {
      id: 3,
    });
  });

  /**
   * Broadcast delegation.
   *
   * broadcast must forward the event and data unchanged.
   */
  it('delegates broadcast', async () => {
    await service.broadcast('order.created', { id: 4 });

    expect(realtime.broadcast).toHaveBeenCalledWith('order.created', { id: 4 });
  });
});
