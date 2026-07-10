/**
 * @fileoverview Pure tagging logic for the replay lab's diff viewer.
 * @layer lib
 *
 * Cross-references the server's recovery timeline (which sequence numbers are
 * still in the in-memory replay buffer, which aged out, and which the durable
 * offline queue still holds) against the sequence numbers this client actually
 * received, to classify each emitted event into exactly one recovery range.
 */

import type { ReplayTimelineEntry } from './api-client';

/** How one emitted sequence number was (or was not) recovered by this client. */
export type ReplayRangeTag = 'live' | 'buffer' | 'queue' | 'gap';

/** One tagged row of the replay diff viewer. */
export interface ReplayDiffRow {
  readonly seq: number;
  readonly id: string;
  readonly tag: ReplayRangeTag;
}

/** Input for {@link tagReplayRanges}. */
export interface TagReplayRangesInput {
  /** Every sequence number the server recorded emitting, in emission order. */
  readonly emissions: readonly ReplayTimelineEntry[];
  /** Sequence numbers still inside the in-memory replay buffer window. */
  readonly retainedSeqs: readonly number[];
  /** Sequence numbers that aged out of the replay buffer. */
  readonly evictedSeqs: readonly number[];
  /** Sequence numbers still held in the durable offline queue. */
  readonly offlineQueuedSeqs: readonly (number | undefined)[];
  /** Sequence numbers this client's `useRealtime` accumulation actually received. */
  readonly receivedSeqs: ReadonlySet<number>;
}

/**
 * Classify each server-recorded emission into a recovery range.
 *
 * Precedence: a sequence still in the durable queue is `'queue'`; otherwise one
 * still in the buffer window is `'buffer'`; otherwise one this client received
 * directly is `'live'`; anything left (aged out of the buffer, never queued,
 * never received) is an unrecoverable `'gap'`.
 *
 * @param input - The server timeline plus this client's own received set.
 * @returns One tagged row per emission, in emission order.
 */
export function tagReplayRanges(input: TagReplayRangesInput): readonly ReplayDiffRow[] {
  const retained = new Set(input.retainedSeqs);
  const queued = new Set(input.offlineQueuedSeqs.filter((seq): seq is number => seq !== undefined));

  return input.emissions.map((emission) => {
    let tag: ReplayRangeTag;
    if (queued.has(emission.seq)) tag = 'queue';
    else if (retained.has(emission.seq)) tag = 'buffer';
    else if (input.receivedSeqs.has(emission.seq)) tag = 'live';
    else tag = 'gap';
    return { seq: emission.seq, id: emission.id, tag };
  });
}
