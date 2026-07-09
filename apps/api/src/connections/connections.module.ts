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
import { LifecycleModule } from '../lifecycle/lifecycle.module';

import { ConnectionsController } from './connections.controller';
import { ConnectionsService } from './connections.service';
import { EvictionLabController } from './eviction-lab.controller';

/** Wires the connection introspection, kill-switch and eviction-timeline endpoints. */
@Module({
  imports: [AuthModule, LifecycleModule],
  controllers: [ConnectionsController, EvictionLabController],
  providers: [ConnectionsService],
})
export class ConnectionsModule {}
