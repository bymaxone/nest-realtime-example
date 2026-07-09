/**
 * Unit tests for the application event catalogue.
 *
 * Layer: unit.
 * Goal: the app's event names never collide with the library's reserved names.
 * Mocks: none.
 */

import { RESERVED_EVENT_NAMES } from '@bymax-one/nest-realtime/shared';

import { APP_EVENT_NAMES } from '../../src/domain/events';

describe('APP_EVENT_NAMES', () => {
  /**
   * Reserved-name guard.
   *
   * No application event name may equal a library-reserved name, so demos and
   * client listeners stay unambiguous (spec §7 row 34).
   */
  it('never intersects the library reserved names', () => {
    const reserved = new Set<string>(Object.values(RESERVED_EVENT_NAMES));
    const collisions = Object.values(APP_EVENT_NAMES).filter((name) => reserved.has(name));

    expect(collisions).toEqual([]);
  });
});
