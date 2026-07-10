/**
 * @fileoverview Read-only per-instance cluster fan-out counters endpoint.
 * @layer controller
 *
 * `GET /labs/cluster/stats` returns the reporting instance's `published`,
 * `receivedRemote` and `deliveredLocal` counts. It is the machine-readable feed the
 * cluster lab reads to prove exactly-once fan-out and the absence of a re-publish
 * storm: after one tenant emit the origin instance shows `published` incremented by
 * one and each peer shows `receivedRemote` incremented by one, and a settle window
 * shows no further change. The counters are instance-global (no per-principal
 * data), so a valid session is enough; there is nothing here to leak across users.
 */

import { Controller, Get, UseGuards } from '@nestjs/common';

import { SessionGuard } from '../auth/session.guard';

import { type ClusterStats, ClusterStatsService } from './cluster-stats.service';

/** Serves the per-instance cluster fan-out counters under `/labs/cluster`. */
@Controller('labs/cluster')
@UseGuards(SessionGuard)
export class ClusterStatsController {
  /**
   * Build the cluster stats controller.
   *
   * @param stats - The per-instance fan-out counters.
   */
  constructor(private readonly stats: ClusterStatsService) {}

  /**
   * Report this instance's fan-out counters.
   *
   * @returns The current {@link ClusterStats} snapshot.
   */
  @Get('stats')
  read(): ClusterStats {
    return this.stats.snapshot();
  }
}
