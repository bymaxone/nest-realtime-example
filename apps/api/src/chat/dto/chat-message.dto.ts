/**
 * @fileoverview Zod schema for an incident-chat client message.
 * @layer chat
 *
 * The client sends the id of a resource room it has joined plus a message body.
 * The room id is constrained to the `resource:incident:` scope so a client can
 * never address a `user:` or `tenant:` room through the chat channel, and the body
 * is trimmed and length-bounded so an empty or oversized message never reaches the
 * room. The sender identity is never taken from this payload; the handler reads it
 * from the authenticated connection record instead.
 */

import { z } from 'zod';

/** Prefix every incident room id carries (`resource:incident:{id}`). */
const INCIDENT_ROOM_PREFIX = 'resource:incident:';

/** Largest chat body accepted, in characters. */
const MAX_BODY_LENGTH = 2000;

/** Schema for a `chat.message` client event. */
export const chatMessageSchema = z.object({
  roomId: z.string().min(1).startsWith(INCIDENT_ROOM_PREFIX),
  body: z.string().trim().min(1).max(MAX_BODY_LENGTH),
});

/** Validated incident-chat message input. */
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
