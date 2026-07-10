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
 * Security: the sender identity is read from the authenticated connection record,
 * never from the client payload, so a client cannot spoof another user; and the
 * room id is constrained to the incident scope and checked for membership, so a
 * client cannot fan a message out to a room it has not joined.
 */

import { ConnectionRegistry, RealtimeService } from '@bymax-one/nest-realtime';
import { SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { Socket } from 'socket.io';

import { RoomMembershipTracker } from '../lifecycle/room-membership.tracker';
import { ROOM_EVENT_NAMES } from '../rooms/room-events';

import { chatMessageSchema } from './dto/chat-message.dto';

/** Handles the incident-chat `chat.message` client event over WebSocket. */
@WebSocketGateway()
export class ChatGateway {
  /**
   * Build the chat gateway.
   *
   * @param realtime - The library realtime API used to re-emit to the room.
   * @param registry - The library connection registry, the source of the sender's
   *   authenticated identity.
   * @param membership - The app-side room-membership view, used to verify the
   *   sender belongs to the target room.
   */
  constructor(
    private readonly realtime: RealtimeService,
    private readonly registry: ConnectionRegistry,
    private readonly membership: RoomMembershipTracker,
  ) {}

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
