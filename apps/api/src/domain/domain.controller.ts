/**
 * @fileoverview Domain simulator endpoints.
 * @layer controller
 *
 * Each endpoint requires an authenticated session and drives a burst to the
 * caller's own tenant (taken from the session traits), never a path-supplied one.
 */

import { Controller, Post, UseGuards } from '@nestjs/common';

import { SessionTraitsParam } from '../auth/session-traits.decorator';
import { SessionGuard } from '../auth/session.guard';
import type { SessionTraits } from '../auth/session.types';

import { DomainService } from './domain.service';

/** Acknowledgement naming the simulated sequence. */
interface SimulationAck {
  readonly simulated: 'orders' | 'deployments';
}

/** Serves the authenticated domain simulator under `/domain`. */
@Controller('domain')
@UseGuards(SessionGuard)
export class DomainController {
  /**
   * Build the domain controller.
   *
   * @param domain - The domain simulator service.
   */
  constructor(private readonly domain: DomainService) {}

  /**
   * Simulate an order lifecycle burst to the caller's tenant.
   *
   * @param traits - The caller's session traits.
   * @returns An acknowledgement naming the sequence.
   */
  @Post('orders/simulate')
  async simulateOrders(@SessionTraitsParam() traits: SessionTraits): Promise<SimulationAck> {
    await this.domain.simulateOrders(traits.tenantId);
    return { simulated: 'orders' };
  }

  /**
   * Simulate a deployment lifecycle burst to the caller's tenant.
   *
   * @param traits - The caller's session traits.
   * @returns An acknowledgement naming the sequence.
   */
  @Post('deployments/simulate')
  async simulateDeployments(@SessionTraitsParam() traits: SessionTraits): Promise<SimulationAck> {
    await this.domain.simulateDeployments(traits.tenantId);
    return { simulated: 'deployments' };
  }
}
