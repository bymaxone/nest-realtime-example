/**
 * @fileoverview Domain simulator module.
 * @layer module
 *
 * Depends on the globally-registered `RealtimeService` and the `SessionGuard`
 * from the auth module, and supplies the inter-event delay.
 */

import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { DomainController } from './domain.controller';
import { DomainService } from './domain.service';
import { DEFAULT_EVENT_DELAY_MS, EVENT_DELAY_MS } from './domain.tokens';

/** Wires the domain simulator controller, service and delay. */
@Module({
  imports: [AuthModule],
  controllers: [DomainController],
  providers: [DomainService, { provide: EVENT_DELAY_MS, useValue: DEFAULT_EVENT_DELAY_MS }],
})
export class DomainModule {}
