/**
 * Unit tests for isReservedEventName.
 *
 * Layer: unit.
 * Goal: library-reserved names are recognized; application names are not.
 * Mocks: none.
 */

import { isReservedEventName } from '../../src/common/reserved-events';

describe('isReservedEventName', () => {
  /**
   * Reserved recognition.
   *
   * A name the library owns must be flagged so the emit console can reject it.
   */
  it('recognizes a reserved event name', () => {
    expect(isReservedEventName('connection:established')).toBe(true);
    expect(isReservedEventName('error')).toBe(true);
  });

  /**
   * Application name passthrough.
   *
   * An application domain name must not be flagged as reserved.
   */
  it('accepts an application event name', () => {
    expect(isReservedEventName('order.created')).toBe(false);
  });
});
