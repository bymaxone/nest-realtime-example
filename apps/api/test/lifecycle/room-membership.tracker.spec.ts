/**
 * Unit tests for RoomMembershipTracker.
 *
 * Layer: unit.
 * Goal: join/leave are idempotent per connection; disconnect drops all of a
 *       connection's rooms; the listing is sorted.
 * Mocks: none; hand-built ConnectionEventMeta drives the disconnect hook.
 */

import type { ConnectionEventMeta } from '@bymax-one/nest-realtime';

import { RoomMembershipTracker } from '../../src/lifecycle/room-membership.tracker';

const META: ConnectionEventMeta = {
  connectionId: 'c1',
  userId: 'ana@acme',
  tenantId: 'acme',
  transport: 'sse',
  ip: '127.0.0.1',
  userAgent: undefined,
  connectedAt: new Date(),
};

describe('RoomMembershipTracker', () => {
  /**
   * Idempotent join, sorted listing.
   *
   * Joining the same room twice must not duplicate it, and rooms are returned in a
   * stable sorted order.
   */
  it('joins idempotently and lists rooms sorted', () => {
    const tracker = new RoomMembershipTracker();

    tracker.join('c1', 'resource:incident:i2');
    tracker.join('c1', 'resource:incident:i1');
    tracker.join('c1', 'resource:incident:i1');

    expect(tracker.roomsFor('c1')).toEqual(['resource:incident:i1', 'resource:incident:i2']);
  });

  /**
   * Idempotent leave.
   *
   * Leaving a room removes it; leaving again (or leaving an unknown connection) is
   * a safe no-op.
   */
  it('leaves idempotently', () => {
    const tracker = new RoomMembershipTracker();
    tracker.join('c1', 'resource:incident:i1');

    tracker.leave('c1', 'resource:incident:i1');
    tracker.leave('c1', 'resource:incident:i1');
    tracker.leave('ghost', 'resource:incident:i1');

    expect(tracker.roomsFor('c1')).toEqual([]);
  });

  /**
   * Disconnect cleanup.
   *
   * On disconnect the connection's rooms must be dropped so a dead connection never
   * lingers in the view.
   */
  it('drops all rooms of a connection on disconnect', () => {
    const tracker = new RoomMembershipTracker();
    tracker.join('c1', 'resource:incident:i1');

    tracker.onDisconnect(META);

    expect(tracker.roomsFor('c1')).toEqual([]);
  });

  /**
   * Unknown connection.
   *
   * Listing an unknown connection returns an empty list rather than throwing.
   */
  it('lists no rooms for an unknown connection', () => {
    expect(new RoomMembershipTracker().roomsFor('nobody')).toEqual([]);
  });
});
