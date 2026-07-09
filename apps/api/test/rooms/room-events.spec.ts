/**
 * Unit tests for the room event-name catalogue.
 *
 * Layer: unit.
 * Goal: no application room event name collides with a library-reserved name.
 * Mocks: none.
 */

import { isReservedEventName } from '../../src/common/reserved-events';
import { ROOM_EVENT_NAMES } from '../../src/rooms/room-events';

describe('ROOM_EVENT_NAMES', () => {
  /**
   * Reserved-name guard.
   *
   * The library owns `room:joined` / `room:left` (and the other reserved names);
   * every app room event must stay outside that set so room listeners never clash.
   */
  it('never collides with a reserved event name', () => {
    for (const name of Object.values(ROOM_EVENT_NAMES)) {
      expect(isReservedEventName(name)).toBe(false);
    }
  });
});
