/**
 * Unit tests for DomainService.
 *
 * Layer: unit.
 * Goal: each simulator emits its scripted sequence to the tenant, in order.
 * Mocks: a RealtimeService double; zero delay to keep the suite fast.
 */

import { DomainService } from '../../src/domain/domain.service';
import { mockRealtimeService, type RealtimeMock } from '../support/realtime.fixture';

describe('DomainService', () => {
  let realtime: RealtimeMock;
  let service: DomainService;

  beforeEach(() => {
    realtime = mockRealtimeService();
    service = new DomainService(realtime.service, 0);
  });

  /**
   * Order burst.
   *
   * The order simulator must emit created -> paid -> shipped to the tenant, all
   * carrying one shared order id, in that order.
   */
  it('emits the order lifecycle to the tenant', async () => {
    await service.simulateOrders('acme');

    const calls = realtime.emitToTenant.mock.calls as Array<[string, string, { orderId: string }]>;
    expect(calls.map((call) => [call[0], call[1]])).toEqual([
      ['acme', 'order.created'],
      ['acme', 'order.paid'],
      ['acme', 'order.shipped'],
    ]);
    const orderIds = new Set(calls.map((call) => call[2].orderId));
    expect(orderIds.size).toBe(1);
  });

  /**
   * Deployment burst.
   *
   * The deployment simulator must emit queued -> running -> succeeded to the
   * tenant, all carrying one shared deployment id, in that order.
   */
  it('emits the deployment lifecycle to the tenant', async () => {
    await service.simulateDeployments('globex');

    const calls = realtime.emitToTenant.mock.calls as Array<
      [string, string, { deploymentId: string }]
    >;
    expect(calls.map((call) => [call[0], call[1]])).toEqual([
      ['globex', 'deployment.queued'],
      ['globex', 'deployment.running'],
      ['globex', 'deployment.succeeded'],
    ]);
    expect(new Set(calls.map((call) => call[2].deploymentId)).size).toBe(1);
  });
});
