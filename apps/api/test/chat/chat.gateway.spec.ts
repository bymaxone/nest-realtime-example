/**
 * Unit tests for ChatGateway.
 *
 * Layer: unit.
 * Goal: a valid message from a room member fans out with the authenticated sender
 *       identity; a malformed payload, an unknown connection and a non-member are
 *       each dropped without emitting or throwing.
 * Mocks: the library RealtimeService and ConnectionRegistry, and the app-side
 *        RoomMembershipTracker, as jest doubles.
 */

import type { ConnectionRegistry, RealtimeService } from '@bymax-one/nest-realtime';
import type { Socket } from 'socket.io';

import { ChatGateway } from '../../src/chat/chat.gateway';
import type { RoomMembershipTracker } from '../../src/lifecycle/room-membership.tracker';

const ROOM_ID = 'resource:incident:i1';

/** Build a gateway over jest doubles, returning the spies for assertions. */
function buildGateway(): {
  gateway: ChatGateway;
  emitToRoom: jest.Mock;
  get: jest.Mock;
  roomsFor: jest.Mock;
} {
  const emitToRoom = jest.fn().mockResolvedValue(undefined);
  const get = jest.fn();
  const roomsFor = jest.fn();
  const realtime = { emitToRoom } as unknown as RealtimeService;
  const registry = { get } as unknown as ConnectionRegistry;
  const membership = { roomsFor } as unknown as RoomMembershipTracker;
  return { gateway: new ChatGateway(realtime, registry, membership), emitToRoom, get, roomsFor };
}

/** A socket double exposing only the `id` the handler reads. */
const socket = { id: 'sock-1' } as Socket;

describe('ChatGateway', () => {
  /**
   * Happy path fan-out.
   *
   * A valid message from a member must be re-emitted to the room carrying the
   * sender identity read from the connection record (never the client payload),
   * proving a client cannot spoof another user.
   */
  it('fans a valid member message out to the room with the authenticated identity', async () => {
    const { gateway, emitToRoom, get, roomsFor } = buildGateway();
    get.mockReturnValue({ userId: 'ana@acme', tenantId: 'acme' });
    roomsFor.mockReturnValue([ROOM_ID]);

    await gateway.onChatMessage(socket, { roomId: ROOM_ID, body: 'hello', from: 'spoofed' });

    expect(emitToRoom).toHaveBeenCalledTimes(1);
    expect(emitToRoom).toHaveBeenCalledWith(ROOM_ID, 'chat.message', {
      roomId: ROOM_ID,
      from: 'ana@acme',
      tenantId: 'acme',
      body: 'hello',
      at: expect.any(String),
    });
  });

  /**
   * Malformed payload dropped.
   *
   * An invalid payload must be dropped without emitting or throwing, so a client
   * cannot crash the gateway with a bad frame.
   */
  it('drops a malformed payload without emitting', async () => {
    const { gateway, emitToRoom, get } = buildGateway();

    await gateway.onChatMessage(socket, { roomId: 'tenant:acme', body: 'hi' });

    expect(emitToRoom).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  /**
   * Unknown connection dropped.
   *
   * When the connection is not in the registry (a race with disconnect) the
   * message must be dropped rather than emitted with an undefined sender.
   */
  it('drops a message from an unknown connection', async () => {
    const { gateway, emitToRoom, get } = buildGateway();
    get.mockReturnValue(undefined);

    await gateway.onChatMessage(socket, { roomId: ROOM_ID, body: 'hello' });

    expect(emitToRoom).not.toHaveBeenCalled();
  });

  /**
   * Non-member dropped.
   *
   * A sender that has not joined the target room must not be able to fan a message
   * out to it, so the message is dropped.
   */
  it('drops a message to a room the sender has not joined', async () => {
    const { gateway, emitToRoom, get, roomsFor } = buildGateway();
    get.mockReturnValue({ userId: 'ana@acme', tenantId: 'acme' });
    roomsFor.mockReturnValue([]);

    await gateway.onChatMessage(socket, { roomId: ROOM_ID, body: 'hello' });

    expect(emitToRoom).not.toHaveBeenCalled();
  });
});
