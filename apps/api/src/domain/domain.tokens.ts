/**
 * @fileoverview Dependency-injection tokens for the domain simulator.
 * @layer domain
 */

/** Injection token for the milliseconds paused between simulated events. */
export const EVENT_DELAY_MS = Symbol('EVENT_DELAY_MS');

/** Default spacing between simulated events, in milliseconds. */
export const DEFAULT_EVENT_DELAY_MS = 100;
