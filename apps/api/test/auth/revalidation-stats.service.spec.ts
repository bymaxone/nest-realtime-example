/**
 * Unit tests for RevalidationStatsService.
 *
 * Layer: unit.
 * Goal: per-user revalidation counts accumulate independently and are snapshot-able.
 * Mocks: none; the service is pure in-memory state.
 */

import { RevalidationStatsService } from '../../src/auth/revalidation-stats.service';

describe('RevalidationStatsService', () => {
  /**
   * Per-user accumulation.
   *
   * Each recorded check must increment only its own user's count, so the reauth
   * lab can attribute revalidations to the right principal.
   */
  it('accumulates counts per user', () => {
    const stats = new RevalidationStatsService();

    stats.record('ana@acme');
    stats.record('ana@acme');
    stats.record('gil@globex');

    expect(stats.countFor('ana@acme')).toBe(2);
    expect(stats.countFor('gil@globex')).toBe(1);
  });

  /**
   * Unseen user.
   *
   * A user that was never revalidated must report zero rather than undefined, so
   * callers can compare counts without guarding for absence.
   */
  it('reports zero for an unseen user', () => {
    expect(new RevalidationStatsService().countFor('nobody')).toBe(0);
  });

  /**
   * Snapshot shape.
   *
   * The snapshot must list one entry per revalidated user with its count, which is
   * exactly what the stats endpoint returns.
   */
  it('snapshots one entry per revalidated user', () => {
    const stats = new RevalidationStatsService();
    stats.record('ana@acme');
    stats.record('ana@acme');

    expect(stats.snapshot()).toEqual([{ userId: 'ana@acme', revalidations: 2 }]);
  });
});
