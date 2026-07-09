/**
 * @fileoverview Lifecycle module: the connection event log and the composite hooks.
 * @layer module
 *
 * Owns the app-side lifecycle sinks and the single `IConnectionLifecycleHooks`
 * object the realtime wiring passes to the library. Imports the audit module so
 * the composite can fan lifecycle calls into the audit ring first.
 */

import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';

import { ConnectionEventLog } from './connection-event-log';
import { CompositeLifecycleHooks } from './lifecycle-hooks';
import { RoomMembershipTracker } from './room-membership.tracker';

/** Wires the connection event log, room-membership tracker and composite hooks. */
@Module({
  imports: [AuditModule],
  providers: [ConnectionEventLog, RoomMembershipTracker, CompositeLifecycleHooks],
  exports: [ConnectionEventLog, RoomMembershipTracker, CompositeLifecycleHooks],
})
export class LifecycleModule {}
