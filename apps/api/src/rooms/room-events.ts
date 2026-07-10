/**
 * @fileoverview Application event names emitted into resource rooms.
 * @layer rooms
 *
 * These are the only names the example emits to a `resource:{type}:{id}` room. A
 * unit test asserts they never collide with the library's `RESERVED_EVENT_NAMES`
 * (which owns `room:joined` / `room:left`), so room listeners stay unambiguous.
 */

/** Every event name the application emits into a resource room. */
export const ROOM_EVENT_NAMES = Object.freeze({
  INCIDENT_MESSAGE: 'incident.message',
  CHAT_MESSAGE: 'chat.message',
} as const);

/** Union of room event name values. */
export type RoomEventName = (typeof ROOM_EVENT_NAMES)[keyof typeof ROOM_EVENT_NAMES];
