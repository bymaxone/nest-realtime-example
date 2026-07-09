/**
 * @fileoverview Domain simulator emitting realistic event bursts to a tenant.
 * @layer domain
 *
 * Produces scripted `order.*` and `deployment.*` sequences via the library's
 * tenant emit, spaced by a configurable delay so a UI shows them arriving in
 * order. Every name comes from {@link APP_EVENT_NAMES}; the app emits nothing the
 * library reserves.
 */

import { randomUUID } from 'node:crypto';

import { RealtimeService } from '@bymax-one/nest-realtime';
import { Inject, Injectable } from '@nestjs/common';

import { EVENT_DELAY_MS } from './domain.tokens';
import { APP_EVENT_NAMES, type AppEventName } from './events';

/** One step of a simulated sequence: an event name and its payload. */
interface SimulationStep {
  readonly event: AppEventName;
  readonly data: Record<string, unknown>;
}

/** Emits scripted domain event sequences to the caller's tenant. */
@Injectable()
export class DomainService {
  /**
   * Build the domain simulator.
   *
   * @param realtime - The library realtime API.
   * @param delayMs - Milliseconds paused between consecutive events.
   */
  constructor(
    private readonly realtime: RealtimeService,
    @Inject(EVENT_DELAY_MS) private readonly delayMs: number,
  ) {}

  /**
   * Emit a created -> paid -> shipped burst for one order to the tenant.
   *
   * @param tenantId - The tenant that receives the burst.
   */
  simulateOrders(tenantId: string): Promise<void> {
    const orderId = randomUUID();
    return this.emitSequence(tenantId, [
      { event: APP_EVENT_NAMES.ORDER_CREATED, data: { orderId, status: 'created' } },
      { event: APP_EVENT_NAMES.ORDER_PAID, data: { orderId, status: 'paid' } },
      { event: APP_EVENT_NAMES.ORDER_SHIPPED, data: { orderId, status: 'shipped' } },
    ]);
  }

  /**
   * Emit a queued -> running -> succeeded burst for one deployment to the tenant.
   *
   * @param tenantId - The tenant that receives the burst.
   */
  simulateDeployments(tenantId: string): Promise<void> {
    const deploymentId = randomUUID();
    return this.emitSequence(tenantId, [
      { event: APP_EVENT_NAMES.DEPLOYMENT_QUEUED, data: { deploymentId, status: 'queued' } },
      { event: APP_EVENT_NAMES.DEPLOYMENT_RUNNING, data: { deploymentId, status: 'running' } },
      { event: APP_EVENT_NAMES.DEPLOYMENT_SUCCEEDED, data: { deploymentId, status: 'succeeded' } },
    ]);
  }

  /** Emit each step in order, pausing between consecutive events. */
  private async emitSequence(tenantId: string, steps: readonly SimulationStep[]): Promise<void> {
    for (const [index, step] of steps.entries()) {
      await this.realtime.emitToTenant(tenantId, step.event, step.data);
      if (index < steps.length - 1) await this.pause();
    }
  }

  /** Resolve after the configured inter-event delay. */
  private pause(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.delayMs));
  }
}
