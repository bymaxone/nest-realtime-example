/**
 * @fileoverview Audit module.
 * @layer module
 *
 * Provides the audit sink used both as the realtime lifecycle hooks (wired by the
 * realtime module) and behind the audit feed endpoint, so both read one instance.
 */

import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { DecoratorHandlers, LifecycleDecoratorDispatcher } from './decorator-handlers';

/** Wires the audit sink, feed endpoint and the decorator-driven lifecycle counters. */
@Module({
  imports: [AuthModule],
  controllers: [AuditController],
  providers: [AuditService, DecoratorHandlers, LifecycleDecoratorDispatcher],
  exports: [AuditService, DecoratorHandlers, LifecycleDecoratorDispatcher],
})
export class AuditModule {}
