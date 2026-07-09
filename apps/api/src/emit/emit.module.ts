/**
 * @fileoverview Emit console module.
 * @layer module
 *
 * Depends on the globally-registered `RealtimeService` (from the realtime wiring)
 * and the `SessionGuard` exported by the auth module.
 */

import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { EmitController } from './emit.controller';
import { EmitService } from './emit.service';

/** Wires the emit console controller and service. */
@Module({
  imports: [AuthModule],
  controllers: [EmitController],
  providers: [EmitService],
})
export class EmitModule {}
