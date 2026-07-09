/**
 * Unit tests for DomainController.
 *
 * Layer: unit.
 * Goal: each endpoint drives a burst to the caller's own tenant and acknowledges.
 * Mocks: a real DomainService over a RealtimeService double.
 */

import { DomainController } from '../../src/domain/domain.controller';
import { DomainService } from '../../src/domain/domain.service';
import type { SessionTraits } from '../../src/auth/session.types';
import { mockRealtimeService, type RealtimeMock } from '../support/realtime.fixture';

const TRAITS: SessionTraits = { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] };

describe('DomainController', () => {
  let realtime: RealtimeMock;
  let controller: DomainController;

  beforeEach(() => {
    realtime = mockRealtimeService();
    controller = new DomainController(new DomainService(realtime.service, 0));
  });

  /**
   * Orders endpoint.
   *
   * The endpoint must simulate orders for the caller's tenant (never a path one)
   * and acknowledge which sequence ran.
   */
  it('simulates orders for the caller tenant', async () => {
    const ack = await controller.simulateOrders(TRAITS);

    expect(realtime.emitToTenant).toHaveBeenCalledWith('acme', 'order.created', expect.any(Object));
    expect(ack).toEqual({ simulated: 'orders' });
  });

  /**
   * Deployments endpoint.
   *
   * The endpoint must simulate deployments for the caller's tenant and
   * acknowledge which sequence ran.
   */
  it('simulates deployments for the caller tenant', async () => {
    const ack = await controller.simulateDeployments(TRAITS);

    expect(realtime.emitToTenant).toHaveBeenCalledWith(
      'acme',
      'deployment.queued',
      expect.any(Object),
    );
    expect(ack).toEqual({ simulated: 'deployments' });
  });
});
