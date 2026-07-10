/**
 * Unit tests for ChatGateway.
 *
 * Layer: unit.
 * Goal: a valid message from a room member fans out with the authenticated sender
 *       identity; a malformed payload, an unknown connection and a non-member are
 *       each dropped without emitting or throwing; and a transport-level payload
 *       overflow is surfaced to the audit as a REALTIME_PAYLOAD_TOO_LARGE error.
 * Mocks: the library RealtimeService and ConnectionRegistry, the app-side
 *        RoomMembershipTracker and the composite lifecycle hooks, as jest doubles.
 */

import type { ConnectionRegistry, RealtimeService } from '@bymax-one/nest-realtime';
import type { Socket } from 'socket.io';

import { ChatGateway } from '../../src/chat/chat.gateway';
import type { ChatRateLimiter } from '../../src/chat/chat-rate-limiter';
import type { CompositeLifecycleHooks } from '../../src/lifecycle/lifecycle-hooks';
import type { RoomMembershipTracker } from '../../src/lifecycle/room-membership.tracker';

const ROOM_ID = 'resource:incident:i1';

/** Build a gateway over jest doubles, returning the spies for assertions. */
function buildGateway(): {
  gateway: ChatGateway;
  emitToRoom: jest.Mock;
  get: jest.Mock;
  roomsFor: jest.Mock;
  onError: jest.Mock;
  tryConsume: jest.Mock;
  release: jest.Mock;
} {
  const emitToRoom = jest.fn().mockResolvedValue(undefined);
  const get = jest.fn();
  const roomsFor = jest.fn();
  const onError = jest.fn().mockResolvedValue(undefined);
  const tryConsume = jest.fn().mockReturnValue(true);
  const release = jest.fn();
  const realtime = { emitToRoom } as unknown as RealtimeService;
  const registry = { get } as unknown as ConnectionRegistry;
  const membership = { roomsFor } as unknown as RoomMembershipTracker;
  const hooks = { onError } as unknown as CompositeLifecycleHooks;
  const rateLimiter = { tryConsume, release } as unknown as ChatRateLimiter;
  return {
    gateway: new ChatGateway(realtime, registry, membership, hooks, rateLimiter),
    emitToRoom,
    get,
    roomsFor,
    onError,
    tryConsume,
    release,
  };
}

/** A socket double exposing only the `id` the handler reads. */
const socket = { id: 'sock-1' } as Socket;

/** A socket double that captures the `disconnect` listener the gateway attaches. */
function socketWithCapturedDisconnect(): {
  socket: Socket;
  fire: (reason: string, description?: unknown) => void;
} {
  let handler: ((reason: string, description?: unknown) => void) | undefined;
  const double = {
    id: 'sock-1',
    on: (event: string, cb: (reason: string, description?: unknown) => void) => {
      if (event === 'disconnect') handler = cb;
    },
  } as unknown as Socket;
  return { socket: double, fire: (reason, description) => handler?.(reason, description) };
}

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

  /**
   * Rate-limited message dropped.
   *
   * A message from a connection over its rate cap must be dropped before any work,
   * so a flooding client cannot fan messages out or even reach the registry lookup.
   */
  it('drops a message from a rate-limited connection', async () => {
    const { gateway, emitToRoom, get, tryConsume } = buildGateway();
    tryConsume.mockReturnValue(false);

    await gateway.onChatMessage(socket, { roomId: ROOM_ID, body: 'flood' });

    expect(emitToRoom).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  /**
   * Rate-limit state released on disconnect.
   *
   * When a socket disconnects the gateway must release its rate-limit state so the
   * limiter never accumulates entries for dead connections.
   */
  it('releases rate-limit state on disconnect', () => {
    const { gateway, release } = buildGateway();
    const { socket: double, fire } = socketWithCapturedDisconnect();
    gateway.handleConnection(double);

    fire('io client disconnect', undefined);

    expect(release).toHaveBeenCalledWith('sock-1');
  });

  /**
   * Payload overflow surfaced to the audit.
   *
   * Socket.IO closes a connection whose frame exceeds the buffer with a
   * "max payload size exceeded" transport error; the gateway must record that as a
   * REALTIME_PAYLOAD_TOO_LARGE error through the library hooks so the audit feed
   * captures it, even though the handler itself never runs.
   */
  it('surfaces a max-payload transport error to the audit hooks', () => {
    const { gateway, onError } = buildGateway();
    const { socket: double, fire } = socketWithCapturedDisconnect();
    gateway.handleConnection(double);

    fire('transport error', new Error('RangeError: Max payload size exceeded'));

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith({
      connectionId: 'sock-1',
      error: expect.objectContaining({ message: 'REALTIME_PAYLOAD_TOO_LARGE' }),
      transport: 'websocket',
    });
  });

  /**
   * A string description is also recognized.
   *
   * The disconnect description may arrive as a plain string rather than an Error;
   * the guard must still recognize the overflow so the audit entry is recorded.
   */
  it('recognizes a max-payload overflow described by a string', () => {
    const { gateway, onError } = buildGateway();
    const { socket: double, fire } = socketWithCapturedDisconnect();
    gateway.handleConnection(double);

    fire('transport error', 'Max payload size exceeded');

    expect(onError).toHaveBeenCalledTimes(1);
  });

  /**
   * An ordinary disconnect is not an error.
   *
   * A normal client or server disconnect (not a transport error) must not be
   * recorded as an error, so the audit feed is not polluted with false errors.
   */
  it('ignores an ordinary disconnect', () => {
    const { gateway, onError } = buildGateway();
    const { socket: double, fire } = socketWithCapturedDisconnect();
    gateway.handleConnection(double);

    fire('io client disconnect', undefined);

    expect(onError).not.toHaveBeenCalled();
  });

  /**
   * A transport error unrelated to payload size is not treated as an overflow.
   *
   * A transport error whose description does not name a payload overflow must not
   * be mislabeled as REALTIME_PAYLOAD_TOO_LARGE.
   */
  it('ignores a transport error that is not a payload overflow', () => {
    const { gateway, onError } = buildGateway();
    const { socket: double, fire } = socketWithCapturedDisconnect();
    gateway.handleConnection(double);

    fire('transport error', new Error('connection reset'));

    expect(onError).not.toHaveBeenCalled();
  });

  /**
   * A transport error with no description is not an overflow.
   *
   * When a transport error arrives with no description at all, the guard must treat
   * it as a non-overflow rather than reading a message off a missing value.
   */
  it('ignores a transport error with no description', () => {
    const { gateway, onError } = buildGateway();
    const { socket: double, fire } = socketWithCapturedDisconnect();
    gateway.handleConnection(double);

    fire('transport error', undefined);

    expect(onError).not.toHaveBeenCalled();
  });
});
