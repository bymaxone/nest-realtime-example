/**
 * Unit tests for EmitController.
 *
 * Layer: unit.
 * Goal: each endpoint delegates to the service and returns the acceptance ack.
 * Mocks: a real EmitService over a RealtimeService double.
 */

import { EmitController } from '../../src/emit/emit.controller';
import { EmitService } from '../../src/emit/emit.service';
import { mockRealtimeService, type RealtimeMock } from '../support/realtime.fixture';

describe('EmitController', () => {
  let realtime: RealtimeMock;
  let controller: EmitController;

  beforeEach(() => {
    realtime = mockRealtimeService();
    controller = new EmitController(new EmitService(realtime.service));
  });

  /**
   * User endpoint.
   *
   * POST /emit/user/:userId must emit to that user and acknowledge.
   */
  it('emits to a user and acknowledges', async () => {
    const ack = await controller.emitToUser('ana@acme', {
      event: 'order.created',
      data: { id: 1 },
    });

    expect(realtime.emitToUser).toHaveBeenCalledWith('ana@acme', 'order.created', { id: 1 });
    expect(ack).toEqual({ accepted: true });
  });

  /**
   * Tenant endpoint.
   *
   * POST /emit/tenant/:tenantId must emit to the tenant and acknowledge.
   */
  it('emits to a tenant and acknowledges', async () => {
    const ack = await controller.emitToTenant('acme', { event: 'order.paid', data: {} });

    expect(realtime.emitToTenant).toHaveBeenCalledWith('acme', 'order.paid', {});
    expect(ack).toEqual({ accepted: true });
  });

  /**
   * Room endpoint.
   *
   * POST /emit/room/:roomId must emit to the room and acknowledge.
   */
  it('emits to a room and acknowledges', async () => {
    const ack = await controller.emitToRoom('resource:incident:1', {
      event: 'order.shipped',
      data: {},
    });

    expect(realtime.emitToRoom).toHaveBeenCalledWith('resource:incident:1', 'order.shipped', {});
    expect(ack).toEqual({ accepted: true });
  });

  /**
   * Broadcast endpoint.
   *
   * POST /emit/broadcast must broadcast and acknowledge.
   */
  it('broadcasts and acknowledges', async () => {
    const ack = await controller.broadcast({ event: 'order.created', data: {} });

    expect(realtime.broadcast).toHaveBeenCalledWith('order.created', {});
    expect(ack).toEqual({ accepted: true });
  });
});
