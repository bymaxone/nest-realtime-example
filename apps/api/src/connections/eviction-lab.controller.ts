/**
 * @fileoverview Read-only FIFO-eviction timeline endpoint.
 * @layer controller
 *
 * `GET /labs/eviction/timeline?userId=` returns a user's connection history,
 * oldest first, with each connection's close time and reason. It is the machine
 * readable feed the frontend eviction visualizer renders, and it makes the
 * counterintuitive FIFO policy legible: the oldest connection closes with
 * `REALTIME_TOO_MANY_CONNECTIONS` while the newest is admitted. It exposes other
 * principals' connection ids, so it is admin-only.
 */

import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';

import { AdminGuard } from '../auth/admin.guard';
import { SessionGuard } from '../auth/session.guard';
import {
  type ConnectionTimelineEntry,
  ConnectionEventLog,
} from '../lifecycle/connection-event-log';

/** The eviction timeline response for a single user. */
interface EvictionTimelineResponse {
  readonly userId: string;
  readonly timeline: readonly ConnectionTimelineEntry[];
}

/** Serves the FIFO-eviction timeline under `/labs/eviction`. */
@Controller('labs/eviction')
@UseGuards(SessionGuard, AdminGuard)
export class EvictionLabController {
  /**
   * Build the eviction lab controller.
   *
   * @param log - The app-side connection event log.
   */
  constructor(private readonly log: ConnectionEventLog) {}

  /**
   * Return a user's ordered connection timeline.
   *
   * @param userId - The user whose timeline is requested.
   * @returns The user id and its ordered connection entries.
   * @throws BadRequestException when the `userId` query parameter is missing.
   */
  @Get('timeline')
  timeline(@Query('userId') userId?: string): EvictionTimelineResponse {
    if (userId === undefined || userId.length === 0) {
      throw new BadRequestException('userId query parameter is required');
    }
    return { userId, timeline: this.log.timeline(userId) };
  }
}
