/**
 * @fileoverview App-side record of the events each lab burst emitted, for assertion and UI.
 * @layer replay
 *
 * The library owns event ids and never hands them back from `emitToUser`, so this
 * store records only what the lab controls: the ordered sequence numbers it
 * emitted and when. It is the machine-readable spine the replay timeline endpoint
 * enriches with real ids from the offline queue, and the frontend renders. A
 * burst resets the user's record so each scenario reads as a clean `1..count`
 * sequence.
 */

import { Injectable } from '@nestjs/common';

/** One emitted event in a user's lab record. */
export interface TimelineEntry {
  /** The 1-based sequence number embedded in the event payload. */
  readonly seq: number;
  /** ISO-8601 instant the lab emitted the event. */
  readonly emittedAt: string;
}

/** Records, per user, the ordered sequence numbers a lab burst emitted. */
@Injectable()
export class ReplayTimeline {
  private readonly byUser = new Map<string, TimelineEntry[]>();

  /**
   * Clear a user's record so the next burst starts a fresh `1..count` sequence.
   *
   * @param userId - The user whose record is reset.
   */
  reset(userId: string): void {
    this.byUser.delete(userId);
  }

  /**
   * Record one emitted event for a user, timestamped now.
   *
   * @param userId - The user the event was emitted to.
   * @param seq - The 1-based sequence number of the event.
   */
  record(userId: string, seq: number): void {
    const entries = this.byUser.get(userId) ?? [];
    entries.push({ seq, emittedAt: new Date().toISOString() });
    this.byUser.set(userId, entries);
  }

  /**
   * Return a user's recorded emissions in emission order.
   *
   * @param userId - The user whose record is read.
   * @returns The ordered entries, or an empty array when the user has none.
   */
  entries(userId: string): readonly TimelineEntry[] {
    return this.byUser.get(userId) ?? [];
  }
}
