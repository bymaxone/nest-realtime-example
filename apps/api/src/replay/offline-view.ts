/**
 * @fileoverview Client-safe projection of a queued offline event.
 * @layer replay
 *
 * The replay timeline and the offline peek both surface queued events; this is
 * the single mapping they share so the id, sequence number, and instant are
 * shaped identically wherever a queue is read.
 */

import type { OfflineQueuedEvent } from '@bymax-one/nest-realtime';

/** A queued event as surfaced to a lab client, carrying its real library id. */
export interface OfflineQueuedView {
  /** The sequence number the lab embedded, or `undefined` if unreadable. */
  readonly seq: number | undefined;
  /** The library-generated event id (the `Last-Event-ID` value). */
  readonly id: string;
  /** ISO-8601 instant the event was queued. */
  readonly emittedAt: string;
}

/**
 * Extract the sequence number a lab embedded in an event payload.
 *
 * @param data - The opaque event payload.
 * @returns The numeric `seq`, or `undefined` when the payload lacks one.
 */
export function readSeq(data: unknown): number | undefined {
  if (typeof data === 'object' && data !== null && 'seq' in data) {
    const seq = data.seq;
    return typeof seq === 'number' ? seq : undefined;
  }
  return undefined;
}

/**
 * Project a queued event onto its client-safe view.
 *
 * @param event - The queued event read back from storage.
 * @returns The id, sequence number, and ISO instant for the client.
 */
export function toOfflineView(event: OfflineQueuedEvent): OfflineQueuedView {
  return {
    seq: readSeq(event.data),
    id: event.id,
    emittedAt: event.emittedAt.toISOString(),
  };
}
