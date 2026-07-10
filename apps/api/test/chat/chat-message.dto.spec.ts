/**
 * Unit tests for the incident-chat message schema.
 *
 * Layer: unit.
 * Goal: the schema accepts a well-formed incident message and rejects a non-incident
 *       room, an empty body and an oversized body, and trims the body.
 * Mocks: none.
 */

import { chatMessageSchema } from '../../src/chat/dto/chat-message.dto';

describe('chatMessageSchema', () => {
  /**
   * Well-formed message.
   *
   * A message to an incident room with a non-empty body must parse, and the body
   * must be trimmed so surrounding whitespace never reaches the room.
   */
  it('accepts an incident message and trims the body', () => {
    const result = chatMessageSchema.safeParse({
      roomId: 'resource:incident:i1',
      body: '  hello team  ',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ roomId: 'resource:incident:i1', body: 'hello team' });
  });

  /**
   * Non-incident room rejected.
   *
   * A room id outside the `resource:incident:` scope must be refused so a client
   * can never fan a chat message out to a tenant or user room.
   */
  it('rejects a room id outside the incident scope', () => {
    expect(chatMessageSchema.safeParse({ roomId: 'tenant:acme', body: 'hi' }).success).toBe(false);
  });

  /**
   * Empty body rejected.
   *
   * A body that is empty after trimming carries no message and must be refused.
   */
  it('rejects an empty body', () => {
    expect(
      chatMessageSchema.safeParse({ roomId: 'resource:incident:i1', body: '   ' }).success,
    ).toBe(false);
  });

  /**
   * Oversized body rejected.
   *
   * A body beyond the length cap must be refused so a single message cannot
   * approach the payload limit on its own.
   */
  it('rejects a body over the length cap', () => {
    const result = chatMessageSchema.safeParse({
      roomId: 'resource:incident:i1',
      body: 'x'.repeat(2001),
    });

    expect(result.success).toBe(false);
  });
});
