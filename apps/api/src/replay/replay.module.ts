/**
 * @fileoverview Replay and offline recovery labs module.
 * @layer module
 *
 * Depends on the globally-registered `RealtimeService`, `ConnectionRegistry` and
 * `REALTIME_OFFLINE_QUEUE_TOKEN` from the realtime wiring, and on the auth module
 * for the session and admin guards. The shared `ReplayTimeline` records what both
 * labs emit so the timeline endpoint can classify each range.
 */

import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { OfflineController } from './offline.controller';
import { OfflineService } from './offline.service';
import { ReplayTimeline } from './replay-timeline';
import { ReplayController } from './replay.controller';
import { ReplayService } from './replay.service';

/** Wires the replay lab, the offline lab, and their shared emission record. */
@Module({
  imports: [AuthModule],
  controllers: [ReplayController, OfflineController],
  providers: [ReplayService, OfflineService, ReplayTimeline],
})
export class ReplayModule {}
