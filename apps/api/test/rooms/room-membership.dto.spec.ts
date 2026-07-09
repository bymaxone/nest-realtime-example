/**
 * Unit tests for the room membership schema.
 *
 * Layer: unit.
 * Goal: valid type/id tokens parse; empty fields and separator-bearing tokens are
 *       rejected so a client cannot inject extra room-id segments.
 * Mocks: none.
 */

import { roomMembershipSchema } from '../../src/rooms/dto/room-membership.dto';

describe('roomMembershipSchema', () => {
  /**
   * Valid body.
   *
   * A well-formed connectionId + resource type/id must parse unchanged.
   */
  it('accepts a well-formed body', () => {
    const parsed = roomMembershipSchema.parse({
      connectionId: 'conn-1',
      resourceType: 'incident',
      resourceId: 'i1',
    });

    expect(parsed).toEqual({ connectionId: 'conn-1', resourceType: 'incident', resourceId: 'i1' });
  });

  /**
   * Separator rejection.
   *
   * A `:` in the resource type or id must be rejected, so a client cannot smuggle
   * extra room-id segments (for example `incident:secret`) past composition.
   */
  it('rejects a resource token containing a separator', () => {
    expect(
      roomMembershipSchema.safeParse({
        connectionId: 'conn-1',
        resourceType: 'incident:x',
        resourceId: 'i1',
      }).success,
    ).toBe(false);
  });

  /**
   * Empty rejection.
   *
   * A missing connectionId must be rejected.
   */
  it('rejects an empty connectionId', () => {
    expect(
      roomMembershipSchema.safeParse({
        connectionId: '',
        resourceType: 'incident',
        resourceId: 'i1',
      }).success,
    ).toBe(false);
  });
});
