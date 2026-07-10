/**
 * @fileoverview Incident-chat gateway: the client-to-server showcase over WebSocket.
 * @layer chat
 *
 * The library owns the connection lifecycle (auth, registration, rooms) and the
 * server-to-client fan-out; this gateway adds the missing client-to-server half
 * for the incident chat. It handles the `chat.message` event a joined client
 * emits, validates it, verifies the sender is a member of the target room, and
 * re-emits it to that room through the library's `RealtimeService`. The gateway is
 * registered only for the WebSocket and composite profiles, so under SSE it does
 * not exist and no client-to-server handler is ever bound.
 *
 * It also surfaces the WebSocket payload guard: Socket.IO drops a frame larger than
 * `maxHttpBufferSize` at the transport level (the handler never runs) and closes
 * the connection with a "max payload size exceeded" transport error. The installed
 * library wires `hooks.onError` only for SSE, so this gateway bridges that specific
 * transport error into the same `hooks.onError` audit path as a
 * `REALTIME_PAYLOAD_TOO_LARGE` entry. It does not emit the reserved `error` event to
 * the client: the library surfaces no client-facing `error` event for WebSocket
 * transport errors, and the example never emits library-reserved event names.
 *
 * Security: the sender identity is read from the authenticated connection record,
 * never from the client payload, so a client cannot spoof another user; and the
 * room id is constrained to the incident scope and checked for membership, so a
 * client cannot fan a message out to a room it has not joined.
 */

import {
  ConnectionRegistry,
  REALTIME_ERROR_CODES,
  RealtimeService,
} from '@bymax-one/nest-realtime';
import { type OnGatewayConnection, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { Socket } from 'socket.io';

import { CompositeLifecycleHooks } from '../lifecycle/lifecycle-hooks';
import { RoomMembershipTracker } from '../lifecycle/room-membership.tracker';
import { ROOM_EVENT_NAMES } from '../rooms/room-events';

import { chatMessageSchema } from './dto/chat-message.dto';

/**
 * Extract a message string from a Socket.IO disconnect description.
 *
 * @param description - The disconnect description (an `Error`, a string, or absent).
 * @returns The message text, or an empty string when none is available.
 */
function describeDisconnect(description: unknown): string {
  if (description instanceof Error) return description.message;
  if (typeof description === 'string') return description;
  return '';
}

/**
 * Report whether a Socket.IO disconnect was the transport-level max-payload drop.
 *
 * @param reason - The Socket.IO disconnect reason.
 * @param description - The optional disconnect description (an `Error` for a
 *   transport error).
 * @returns `true` when the disconnect was caused by an oversized frame.
 */
function isPayloadOverflow(reason: string, description: unknown): boolean {
  if (reason !== 'transport error') return false;
  return /max payload size exceeded/iu.test(describeDisconnect(description));
}

/** Handles the incident-chat `chat.message` client event over WebSocket. */
@WebSocketGateway()
export class ChatGateway implements OnGatewayConnection {
  /**
   * Build the chat gateway.
   *
   * @param realtime - The library realtime API used to re-emit to the room.
   * @param registry - The library connection registry, the source of the sender's
   *   authenticated identity.
   * @param membership - The app-side room-membership view, used to verify the
   *   sender belongs to the target room.
   * @param hooks - The library lifecycle hooks, used to surface a WebSocket payload
   *   overflow into the audit feed as an error entry.
   */
  constructor(
    private readonly realtime: RealtimeService,
    private readonly registry: ConnectionRegistry,
    private readonly membership: RoomMembershipTracker,
    private readonly hooks: CompositeLifecycleHooks,
  ) {}

  /**
   * Attach the payload-overflow guard to a new socket.
   *
   * Socket.IO closes a connection whose frame exceeds `maxHttpBufferSize` with a
   * "max payload size exceeded" transport error; this records that as a
   * `REALTIME_PAYLOAD_TOO_LARGE` audit entry through the library hooks.
   *
   * @param socket - The newly connected socket.
   */
  handleConnection(socket: Socket): void {
    socket.on('disconnect', (reason: string, description?: unknown) => {
      if (!isPayloadOverflow(reason, description)) return;
      void this.hooks.onError({
        connectionId: socket.id,
        error: new Error(REALTIME_ERROR_CODES.PAYLOAD_TOO_LARGE),
        transport: 'websocket',
      });
    });
  }

  /**
   * Handle a `chat.message` from a joined client and fan it out to its room.
   *
   * Silently drops (never throws, so the gateway cannot be crashed by a client)
   * when the payload is malformed, the connection is unknown, or the sender is not
   * a member of the target room.
   *
   * @param socket - The authenticated Socket.IO socket that sent the message.
   * @param payload - The raw client payload, validated before use.
   */
  @SubscribeMessage(ROOM_EVENT_NAMES.CHAT_MESSAGE)
  async onChatMessage(socket: Socket, payload: unknown): Promise<void> {
    const parsed = chatMessageSchema.safeParse(payload);
    if (!parsed.success) return;
    const record = this.registry.get(socket.id);
    if (!record) return;
    if (!this.membership.roomsFor(socket.id).includes(parsed.data.roomId)) return;
    await this.realtime.emitToRoom(parsed.data.roomId, ROOM_EVENT_NAMES.CHAT_MESSAGE, {
      roomId: parsed.data.roomId,
      from: record.userId,
      tenantId: record.tenantId,
      body: parsed.data.body,
      at: new Date().toISOString(),
    });
  }
}
