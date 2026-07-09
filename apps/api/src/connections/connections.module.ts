/**
 * @fileoverview Connections module: registry introspection and the kill switch.
 * @layer module
 *
 * Depends on the globally-registered `ConnectionRegistry` and `RealtimeService`
 * from the realtime wiring, and on the auth module for the session and admin
 * guards.
 */

import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { ConnectionsController } from './connections.controller';
import { ConnectionsService } from './connections.service';

/** Wires the connection introspection and kill-switch endpoints. */
@Module({
  imports: [AuthModule],
  controllers: [ConnectionsController],
  providers: [ConnectionsService],
})
export class ConnectionsModule {}
