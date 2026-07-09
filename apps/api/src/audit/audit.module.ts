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

/** Wires the audit sink and feed endpoint. */
@Module({
  imports: [AuthModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
