/**
 * Unit tests for RoomsController.
 *
 * Layer: unit.
 * Goal: join/leave/mine forward the body fields and the caller user id to the
 *       service and shape the acknowledgements.
 * Mocks: a RoomsService double.
 */

import { RoomsController } from '../../src/rooms/rooms.controller';
import type { RoomsService } from '../../src/rooms/rooms.service';
import type { SessionTraits } from '../../src/auth/session.types';

const TRAITS: SessionTraits = { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] };
const BODY = { connectionId: 'c1', resourceType: 'incident', resourceId: 'i1' };

describe('RoomsController', () => {
  /**
   * Join.
   *
   * The controller must pass the connection id, resource type/id and caller user
   * id to the service and return the composed room id.
   */
  it('joins and returns the room id', async () => {
    const join = jest.fn().mockResolvedValue('resource:incident:i1');
    const controller = new RoomsController({ join } as unknown as RoomsService);

    const ack = await controller.join(BODY, TRAITS);

    expect(join).toHaveBeenCalledWith('c1', 'incident', 'i1', 'ana@acme');
    expect(ack).toEqual({ roomId: 'resource:incident:i1', joined: true });
  });

  /**
   * Leave.
   *
   * The controller must delegate leave the same way and acknowledge left=true.
   */
  it('leaves and returns the room id', async () => {
    const leave = jest.fn().mockResolvedValue('resource:incident:i1');
    const controller = new RoomsController({ leave } as unknown as RoomsService);

    const ack = await controller.leave(BODY, TRAITS);

    expect(leave).toHaveBeenCalledWith('c1', 'incident', 'i1', 'ana@acme');
    expect(ack).toEqual({ roomId: 'resource:incident:i1', left: true });
  });

  /**
   * Mine.
   *
   * The controller must list the caller's rooms for a connection.
   */
  it('lists the caller rooms for a connection', () => {
    const mine = jest.fn().mockReturnValue(['resource:incident:i1']);
    const controller = new RoomsController({ mine } as unknown as RoomsService);

    const response = controller.mine('c1', TRAITS);

    expect(mine).toHaveBeenCalledWith('c1', 'ana@acme');
    expect(response).toEqual({ connectionId: 'c1', rooms: ['resource:incident:i1'] });
  });
});
