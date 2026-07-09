/**
 * @fileoverview Rooms module: resource-room membership endpoints.
 * @layer module
 *
 * Depends on the globally-registered `ConnectionRegistry` and `RealtimeService`,
 * the auth module for the session guard, and the lifecycle module for the
 * membership tracker (which is cleared on disconnect).
 */

import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { LifecycleModule } from '../lifecycle/lifecycle.module';

import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

/** Wires the resource-room membership controller and service. */
@Module({
  imports: [AuthModule, LifecycleModule],
  controllers: [RoomsController],
  providers: [RoomsService],
})
export class RoomsModule {}
