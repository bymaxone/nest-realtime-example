/**
 * @fileoverview Guard against emitting names the library reserves.
 * @layer common
 *
 * The library owns `connection:*`, `room:*` and `error` event names. The app must
 * never emit them, so this predicate lets the emit console reject reserved names
 * and lets a unit test prove the domain event set never collides with them.
 */

import { RESERVED_EVENT_NAMES, type ReservedEventName } from '@bymax-one/nest-realtime/shared';

/** Every event name the library reserves, typed as its own union. */
const RESERVED_NAMES: readonly ReservedEventName[] = Object.values(RESERVED_EVENT_NAMES);

/** Set of every event name reserved by the library. */
const RESERVED_NAME_SET: ReadonlySet<string> = new Set(RESERVED_NAMES);

/**
 * Report whether an event name is reserved by the library.
 *
 * @param name - The candidate event name.
 * @returns `true` when the name is reserved and must not be emitted by the app.
 */
export function isReservedEventName(name: string): boolean {
  return RESERVED_NAME_SET.has(name);
}
