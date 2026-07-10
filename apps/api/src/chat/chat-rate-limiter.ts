/**
 * @fileoverview Per-connection sliding-window rate limiter for incident chat.
 * @layer chat
 *
 * The `chat.message` handler is the only client-to-server input path in the app, so
 * one authenticated member could otherwise flood a room (and the Redis-backed
 * fan-out under the cluster profile) at unbounded frequency. This limiter caps each
 * connection to a fixed number of messages per rolling window; the gateway drops
 * anything over the cap. State is per-connection and released on disconnect, so it
 * never grows unbounded.
 */

import { Injectable } from '@nestjs/common';

/** Maximum `chat.message` events accepted from one connection per window. */
const MAX_MESSAGES_PER_WINDOW = 20;

/** Rolling window width, in milliseconds. */
const WINDOW_MS = 1000;

/** Caps each connection's incoming chat rate with a rolling window. */
@Injectable()
export class ChatRateLimiter {
  private readonly timestampsByConnection = new Map<string, number[]>();

  /**
   * Try to admit one message for a connection, recording it when admitted.
   *
   * @param connectionId - The sending connection's id.
   * @param now - The current epoch milliseconds (injectable for deterministic tests).
   * @returns `true` when the message is within the cap, `false` when it must be dropped.
   */
  tryConsume(connectionId: string, now: number = Date.now()): boolean {
    const recent = (this.timestampsByConnection.get(connectionId) ?? []).filter(
      (at) => now - at < WINDOW_MS,
    );
    if (recent.length >= MAX_MESSAGES_PER_WINDOW) {
      this.timestampsByConnection.set(connectionId, recent);
      return false;
    }
    recent.push(now);
    this.timestampsByConnection.set(connectionId, recent);
    return true;
  }

  /**
   * Release a connection's rate-limit state when it disconnects.
   *
   * @param connectionId - The disconnected connection's id.
   */
  release(connectionId: string): void {
    this.timestampsByConnection.delete(connectionId);
  }
}
