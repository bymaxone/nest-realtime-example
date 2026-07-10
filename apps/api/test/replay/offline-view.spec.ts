/**
 * Unit tests for the offline-view projection.
 *
 * Layer: unit.
 * Goal: readSeq extracts a numeric seq only from a well-shaped payload; toOfflineView
 *       projects a queued event to its client-safe id/seq/instant view.
 * Mocks: none.
 */

import type { OfflineQueuedEvent } from '@bymax-one/nest-realtime';

import { readSeq, toOfflineView } from '../../src/replay/offline-view';

const EMITTED_AT = new Date('2026-07-09T00:00:00.000Z');

describe('readSeq', () => {
  /**
   * Well-shaped payload.
   *
   * A payload carrying a numeric `seq` must yield that number so the timeline can
   * label queued events by sequence.
   */
  it('returns the seq from a numeric payload', () => {
    expect(readSeq({ seq: 7 })).toBe(7);
  });

  /**
   * Malformed payloads.
   *
   * A non-object, null, missing-seq or non-numeric seq must all yield undefined
   * rather than a coerced or thrown value.
   */
  it('returns undefined for payloads without a numeric seq', () => {
    expect(readSeq('nope')).toBeUndefined();
    expect(readSeq(null)).toBeUndefined();
    expect(readSeq({})).toBeUndefined();
    expect(readSeq({ seq: 'x' })).toBeUndefined();
  });
});

describe('toOfflineView', () => {
  /**
   * Full projection.
   *
   * A queued event must project to its id, its embedded seq and an ISO instant,
   * exactly the shape the peek and timeline endpoints return.
   */
  it('projects a queued event onto its client-safe view', () => {
    const event: OfflineQueuedEvent = {
      id: '1700000000000-000001',
      event: 'lab.offline',
      data: { seq: 3 },
      emittedAt: EMITTED_AT,
    };

    expect(toOfflineView(event)).toEqual({
      seq: 3,
      id: '1700000000000-000001',
      emittedAt: EMITTED_AT.toISOString(),
    });
  });

  /**
   * Missing seq.
   *
   * A queued event whose payload lacks a seq must still project, with `seq`
   * undefined, so a foreign event never breaks the view.
   */
  it('projects a seq-less payload with an undefined seq', () => {
    const event: OfflineQueuedEvent = {
      id: '1700000000000-000002',
      event: 'lab.offline',
      data: { other: true },
      emittedAt: EMITTED_AT,
    };

    expect(toOfflineView(event).seq).toBeUndefined();
  });
});
