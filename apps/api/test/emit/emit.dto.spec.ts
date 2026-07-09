/**
 * Unit tests for the emit request schema.
 *
 * Layer: unit.
 * Goal: valid bodies pass; empty or reserved event names are rejected.
 * Mocks: none.
 */

import { emitSchema } from '../../src/emit/dto/emit.dto';

describe('emitSchema', () => {
  /**
   * Valid body.
   *
   * A non-empty application event name with any payload must parse.
   */
  it('accepts a valid emit body', () => {
    expect(emitSchema.safeParse({ event: 'order.created', data: { id: 1 } }).success).toBe(true);
  });

  /**
   * Empty event name.
   *
   * An empty event name is meaningless and must be rejected.
   */
  it('rejects an empty event name', () => {
    expect(emitSchema.safeParse({ event: '', data: {} }).success).toBe(false);
  });

  /**
   * Reserved event name.
   *
   * The console must not be able to emit a library-reserved name.
   */
  it('rejects a reserved event name', () => {
    expect(emitSchema.safeParse({ event: 'connection:established', data: {} }).success).toBe(false);
  });
});
