/**
 * Unit tests for the library event-id ordering invariant.
 *
 * Layer: unit.
 * Goal: pin the property every recovery path depends on, that the library's ids
 *       are fixed-width and sort lexicographically into emission order, so string
 *       comparison in the replay buffer and the offline queue is chronological.
 * Mocks: none; the ids are a captured live burst, not synthesized here (the id
 *        scheme belongs to the library, never reimplemented by the example).
 */

import { CAPTURED_EVENT_IDS } from '../fixtures/captured-event-ids';

/** The exact `{13-digit ms}-{6-digit counter}` shape the library emits. */
const ID_PATTERN = /^\d{13}-\d{6}$/u;

describe('event id ordering', () => {
  /**
   * Fixed width.
   *
   * Every id must match the fixed 13-4-6 shape and share one length, since the
   * zero-padding is exactly what keeps `9` from sorting after `10`.
   */
  it('emits fixed-width ids', () => {
    for (const id of CAPTURED_EVENT_IDS) {
      expect(id).toMatch(ID_PATTERN);
      expect(id).toHaveLength(CAPTURED_EVENT_IDS[0]?.length);
    }
  });

  /**
   * Strictly increasing across a millisecond boundary.
   *
   * The captured burst straddles a millisecond rollover; each id must still be
   * strictly greater than its predecessor under plain string comparison, so a
   * later event never sorts before an earlier one.
   */
  it('increases strictly in lexicographic order', () => {
    for (let index = 1; index < CAPTURED_EVENT_IDS.length; index += 1) {
      const previous = CAPTURED_EVENT_IDS[index - 1] ?? '';
      const current = CAPTURED_EVENT_IDS[index] ?? '';
      expect(current > previous).toBe(true);
    }
  });

  /**
   * Sort stability.
   *
   * A reversed sample sorted with the default string comparator must recover the
   * exact emission order, proving the buffer and queue can rely on `Array.sort`
   * and `id > sinceId` to reconstruct chronology.
   */
  it('recovers emission order when sorted as strings', () => {
    const shuffled = [...CAPTURED_EVENT_IDS].reverse();

    expect(shuffled.sort()).toEqual([...CAPTURED_EVENT_IDS]);
  });
});
