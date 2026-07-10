/**
 * @fileoverview Connections module: registry introspection, kill switch and cluster stats.
 * @layer module
 *
 * Depends on the globally-registered `ConnectionRegistry` and `RealtimeService`
 * from the realtime wiring, on the auth module for the session and admin guards,
 * and on the realtime infrastructure for the shared cluster stats counters the
 * fan-out lab reads.
 */

import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { LifecycleModule } from '../lifecycle/lifecycle.module';
import { RealtimeInfraModule } from '../realtime/realtime-infra.module';

import { ClusterStatsController } from './cluster-stats.controller';
import { ConnectionsController } from './connections.controller';
import { ConnectionsService } from './connections.service';
import { EvictionLabController } from './eviction-lab.controller';
import { RealtimeIntrospectionService } from './realtime-introspection.service';

/** Wires the connection introspection, kill-switch, eviction and cluster-stats endpoints. */
@Module({
  imports: [AuthModule, LifecycleModule, RealtimeInfraModule],
  controllers: [ConnectionsController, EvictionLabController, ClusterStatsController],
  providers: [ConnectionsService, RealtimeIntrospectionService],
})
export class ConnectionsModule {}
