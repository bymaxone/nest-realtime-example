/**
 * Unit tests for RoomsService.
 *
 * Layer: unit.
 * Goal: join/leave compose the resource room id and delegate to the library only
 *       for a connection the caller owns; anti-IDOR rejects others; mine lists the
 *       tracked rooms.
 * Mocks: a ConnectionRegistry double, a RealtimeService double, a real tracker.
 */

import { ConnectionRegistry, RealtimeService } from '@bymax-one/nest-realtime';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { RoomMembershipTracker } from '../../src/lifecycle/room-membership.tracker';
import { RoomsService } from '../../src/rooms/rooms.service';

/** Build the service over registry/realtime doubles and a real tracker. */
function build(owner: string | null): {
  service: RoomsService;
  joinRoom: jest.Mock;
  leaveRoom: jest.Mock;
  tracker: RoomMembershipTracker;
} {
  const get = jest.fn().mockReturnValue(owner === null ? undefined : { userId: owner });
  const registry = { get } as unknown as ConnectionRegistry;
  const joinRoom = jest.fn().mockResolvedValue(undefined);
  const leaveRoom = jest.fn().mockResolvedValue(undefined);
  const realtime = { joinRoom, leaveRoom } as unknown as RealtimeService;
  const tracker = new RoomMembershipTracker();
  return { service: new RoomsService(registry, realtime, tracker), joinRoom, leaveRoom, tracker };
}

describe('RoomsService', () => {
  /**
   * Owned join composes the room id.
   *
   * A caller joining their own connection must compose `resource:incident:i1`,
   * delegate to the library and track the membership.
   */
  it('joins an owned connection to a composed resource room', async () => {
    const { service, joinRoom, tracker } = build('ana@acme');

    const roomId = await service.join('c1', 'incident', 'i1', 'ana@acme');

    expect(roomId).toBe('resource:incident:i1');
    expect(joinRoom).toHaveBeenCalledWith('c1', 'resource:incident:i1');
    expect(tracker.roomsFor('c1')).toEqual(['resource:incident:i1']);
  });

  /**
   * Anti-IDOR on join.
   *
   * Joining a connection owned by another user must be forbidden and must never
   * reach the library.
   */
  it('forbids joining a connection owned by another user', async () => {
    const { service, joinRoom } = build('bob@acme');

    await expect(service.join('c1', 'incident', 'i1', 'ana@acme')).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.join('c1', 'incident', 'i1', 'ana@acme')).rejects.toThrow(
      'not your connection',
    );
    expect(joinRoom).not.toHaveBeenCalled();
  });

  /**
   * Unknown connection on join.
   *
   * Joining with an unknown connection id must 404.
   */
  it('404s joining an unknown connection', async () => {
    const { service } = build(null);

    await expect(service.join('missing', 'incident', 'i1', 'ana@acme')).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.join('missing', 'incident', 'i1', 'ana@acme')).rejects.toThrow(
      'unknown connection',
    );
  });

  /**
   * Owned leave.
   *
   * Leaving an owned connection composes the room id, delegates and untracks it.
   */
  it('leaves an owned connection from a composed resource room', async () => {
    const { service, leaveRoom, tracker } = build('ana@acme');
    await service.join('c1', 'incident', 'i1', 'ana@acme');

    const roomId = await service.leave('c1', 'incident', 'i1', 'ana@acme');

    expect(roomId).toBe('resource:incident:i1');
    expect(leaveRoom).toHaveBeenCalledWith('c1', 'resource:incident:i1');
    expect(tracker.roomsFor('c1')).toEqual([]);
  });

  /**
   * Listing.
   *
   * mine must return the tracked rooms for an owned connection.
   */
  it('lists an owned connection rooms', async () => {
    const { service } = build('ana@acme');
    await service.join('c1', 'incident', 'i1', 'ana@acme');

    expect(service.mine('c1', 'ana@acme')).toEqual(['resource:incident:i1']);
  });

  /**
   * Anti-IDOR on listing.
   *
   * Listing another user's connection rooms must be forbidden.
   */
  it('forbids listing another user connection rooms', () => {
    const { service } = build('bob@acme');

    expect(() => service.mine('c1', 'ana@acme')).toThrow(ForbiddenException);
  });
});
