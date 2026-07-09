/**
 * @fileoverview Read-only reauthentication statistics endpoint.
 * @layer controller
 *
 * `GET /labs/reauth/stats` exposes how many times each user's credentials were
 * actually revalidated. Because the library's reauth service caches a positive
 * result for `cacheTtlMs`, this count stays well below the number of reauth
 * cycles when the cache is active, making the cache-reduction behavior observable.
 * The snapshot lists every connected user's id, so it is admin-only.
 */

import { Controller, Get, UseGuards } from '@nestjs/common';

import { AdminGuard } from './admin.guard';
import { type RevalidationCount, RevalidationStatsService } from './revalidation-stats.service';
import { SessionGuard } from './session.guard';

/** The reauth stats response: the configured cache TTL is not exposed, only counts. */
interface ReauthStatsResponse {
  readonly revalidations: readonly RevalidationCount[];
}

/** Serves the reauthentication stats lab endpoint under `/labs/reauth`. */
@Controller('labs/reauth')
@UseGuards(SessionGuard, AdminGuard)
export class ReauthLabController {
  /**
   * Build the reauth lab controller.
   *
   * @param statsService - The per-user revalidation counters.
   */
  constructor(private readonly statsService: RevalidationStatsService) {}

  /**
   * Return every user's observed revalidation count.
   *
   * @returns The per-user revalidation counts.
   */
  @Get('stats')
  stats(): ReauthStatsResponse {
    return { revalidations: this.statsService.snapshot() };
  }
}
