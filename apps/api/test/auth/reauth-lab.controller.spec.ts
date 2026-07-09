/**
 * Unit tests for ReauthLabController.
 *
 * Layer: unit.
 * Goal: the endpoint returns the per-user revalidation snapshot.
 * Mocks: a real RevalidationStatsService seeded with counts.
 */

import { ReauthLabController } from '../../src/auth/reauth-lab.controller';
import { RevalidationStatsService } from '../../src/auth/revalidation-stats.service';

describe('ReauthLabController', () => {
  /**
   * Stats snapshot.
   *
   * The endpoint must surface exactly the recorded per-user revalidation counts,
   * which the reauth lab reads to show the cache reduced the checks.
   */
  it('returns the revalidation snapshot', () => {
    const stats = new RevalidationStatsService();
    stats.record('ana@acme');
    stats.record('ana@acme');
    const controller = new ReauthLabController(stats);

    expect(controller.stats()).toEqual({
      revalidations: [{ userId: 'ana@acme', revalidations: 2 }],
    });
  });
});
