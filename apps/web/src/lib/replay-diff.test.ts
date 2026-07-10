/**
 * @fileoverview Unit tests for the replay lab's diff-tagging logic.
 * @layer test
 */

import { describe, expect, it } from 'vitest';

import { tagReplayRanges } from './replay-diff';

describe('tagReplayRanges', () => {
  it('tags a durably queued sequence as queue, even if it is also in the buffer window', () => {
    // Scenario: queue takes precedence over buffer for a sequence present in both.
    const rows = tagReplayRanges({
      emissions: [{ seq: 1, id: '1' }],
      retainedSeqs: [1],
      evictedSeqs: [],
      offlineQueuedSeqs: [1],
      receivedSeqs: new Set(),
    });
    expect(rows).toEqual([{ seq: 1, id: '1', tag: 'queue' }]);
  });

  it('tags a sequence still in the buffer window as buffer', () => {
    // Scenario: a recent event is still recoverable via Last-Event-ID replay.
    const rows = tagReplayRanges({
      emissions: [{ seq: 2, id: '2' }],
      retainedSeqs: [2],
      evictedSeqs: [],
      offlineQueuedSeqs: [],
      receivedSeqs: new Set(),
    });
    expect(rows[0]?.tag).toBe('buffer');
  });

  it('tags a received-but-unrecoverable sequence as live', () => {
    // Scenario: the client received the event directly, before any drop.
    const rows = tagReplayRanges({
      emissions: [{ seq: 3, id: '3' }],
      retainedSeqs: [],
      evictedSeqs: [3],
      offlineQueuedSeqs: [],
      receivedSeqs: new Set([3]),
    });
    expect(rows[0]?.tag).toBe('live');
  });

  it('tags an evicted, unreceived, unqueued sequence as an unrecoverable gap', () => {
    // Scenario: the event aged out of the buffer and was never durably queued or received.
    const rows = tagReplayRanges({
      emissions: [{ seq: 4, id: '4' }],
      retainedSeqs: [],
      evictedSeqs: [4],
      offlineQueuedSeqs: [],
      receivedSeqs: new Set(),
    });
    expect(rows[0]?.tag).toBe('gap');
  });

  it('ignores undefined sequence numbers from the offline queue view', () => {
    // Scenario: a queued event whose payload could not be read carries `seq: undefined`.
    const rows = tagReplayRanges({
      emissions: [{ seq: 5, id: '5' }],
      retainedSeqs: [],
      evictedSeqs: [5],
      offlineQueuedSeqs: [undefined],
      receivedSeqs: new Set(),
    });
    expect(rows[0]?.tag).toBe('gap');
  });
});
