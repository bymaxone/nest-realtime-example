/**
 * @fileoverview Shared constants for the replay and offline recovery labs.
 * @layer replay
 *
 * The two labs emit under distinct event names so a client can tell a buffer
 * replay apart from an offline drain, and share the reason string logged when the
 * replay lab force-closes a stream.
 */

/** SSE event name for the replay lab's numbered burst events. */
export const REPLAY_EVENT = 'lab.replay';

/** SSE event name for the offline lab's numbered queued events. */
export const OFFLINE_EVENT = 'lab.offline';

/** Reason logged when the replay lab force-closes the caller's stream. */
export const REPLAY_DROP_REASON = 'REPLAY_LAB_DROP';

/**
 * Lexicographically minimal cursor. Every generated event id (`{ms}-{counter}`)
 * sorts after it, so passing it as `Last-Event-ID` drains a whole queue.
 */
export const MIN_EVENT_ID = '0';

/** Upper bound on how many events a single lab peek returns. */
export const PEEK_LIMIT = 500;
