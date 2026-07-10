/**
 * Unit tests for ReplayTimeline.
 *
 * Layer: unit.
 * Goal: the per-user record appends in order, reads back in order, resets, and
 *       returns an empty list for an unknown user.
 * Mocks: none; the store is in-memory by design.
 */

import { ReplayTimeline } from '../../src/replay/replay-timeline';

const USER = 'ana@acme';

describe('ReplayTimeline', () => {
  let timeline: ReplayTimeline;

  beforeEach(() => {
    timeline = new ReplayTimeline();
  });

  /**
   * Empty by default.
   *
   * A user with no recorded burst must read back an empty list, not undefined,
   * so the timeline endpoint never has to special-case a fresh user.
   */
  it('returns an empty list for an unknown user', () => {
    expect(timeline.entries(USER)).toEqual([]);
  });

  /**
   * Ordered recording.
   *
   * Recorded sequence numbers must read back in emission order with an instant on
   * each, since the endpoint classifies ranges by that order.
   */
  it('records sequence numbers in order with a timestamp', () => {
    timeline.record(USER, 1);
    timeline.record(USER, 2);

    const entries = timeline.entries(USER);

    expect(entries.map((entry) => entry.seq)).toEqual([1, 2]);
    expect(typeof entries[0]?.emittedAt).toBe('string');
    expect(Number.isNaN(Date.parse(entries[0]?.emittedAt ?? ''))).toBe(false);
  });

  /**
   * Reset clears a user's record.
   *
   * A fresh burst resets the user so each scenario reads as a clean 1..count
   * sequence rather than accumulating across bursts.
   */
  it('clears a user record on reset', () => {
    timeline.record(USER, 1);
    timeline.reset(USER);

    expect(timeline.entries(USER)).toEqual([]);
  });
});
