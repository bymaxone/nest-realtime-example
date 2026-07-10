/**
 * @fileoverview Presence module: the lifecycle tracker and the roster endpoint.
 * @layer module
 *
 * Owns presence population (the tracker joined into the composite lifecycle hooks)
 * and the read side (`GET /presence/:tenantId`). Depends on the realtime
 * infrastructure for the shared presence storage and on the auth module for the
 * session guard. The tracker is exported so the lifecycle module can fan connection
 * events into it.
 */

import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { RealtimeInfraModule } from '../realtime/realtime-infra.module';

import { PresenceController } from './presence.controller';
import { PresenceService } from './presence.service';
import { PresenceTracker } from './presence.tracker';

/** Wires presence population and the tenant roster endpoint. */
@Module({
  imports: [AuthModule, RealtimeInfraModule],
  controllers: [PresenceController],
  providers: [PresenceService, PresenceTracker],
  exports: [PresenceTracker],
})
export class PresenceModule {}
