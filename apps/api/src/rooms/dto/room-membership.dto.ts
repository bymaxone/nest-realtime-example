/**
 * @fileoverview Zod schema for a room join/leave request.
 * @layer rooms
 *
 * The caller sends its own `connectionId` (learned from `connection:established`)
 * plus a resource type and id. The server composes the room id via the library's
 * `composeRoomId('RESOURCE', ...)` convention, so a client can never supply a raw
 * `user:` or `tenant:` room id and cross into another scope. The type and id are
 * restricted to a safe token charset so they cannot inject extra id segments.
 */

import { z } from 'zod';

/** Safe charset for a resource type or id segment (no `:` separators). */
const RESOURCE_TOKEN = /^[A-Za-z0-9_-]+$/u;

/** Schema for `POST /rooms/join` and `/leave`. */
export const roomMembershipSchema = z.object({
  connectionId: z.string().min(1),
  resourceType: z.string().min(1).regex(RESOURCE_TOKEN),
  resourceId: z.string().min(1).regex(RESOURCE_TOKEN),
});

/** Validated room membership request body. */
export type RoomMembershipDto = z.infer<typeof roomMembershipSchema>;
