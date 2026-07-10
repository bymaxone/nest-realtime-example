/**
 * Unit tests for ChatRateLimiter.
 *
 * Layer: unit.
 * Goal: a connection is admitted up to the per-window cap, dropped over it, allowed
 *       again once the window slides, and reset when released.
 * Mocks: none; the current time is passed explicitly for deterministic windows.
 */

import { ChatRateLimiter } from '../../src/chat/chat-rate-limiter';

const CAP = 20;
const WINDOW_MS = 1000;
const CONNECTION = 'sock-1';

describe('ChatRateLimiter', () => {
  /**
   * Within the cap.
   *
   * Every message up to the cap within one window must be admitted, so normal chat
   * traffic is never throttled.
   */
  it('admits messages up to the cap within a window', () => {
    const limiter = new ChatRateLimiter();

    const admitted = Array.from({ length: CAP }, () => limiter.tryConsume(CONNECTION, 0));

    expect(admitted.every(Boolean)).toBe(true);
  });

  /**
   * Over the cap.
   *
   * The first message beyond the cap in the same window must be dropped, so a
   * flooding connection is throttled.
   */
  it('drops the message over the cap in the same window', () => {
    const limiter = new ChatRateLimiter();
    for (let index = 0; index < CAP; index += 1) limiter.tryConsume(CONNECTION, 0);

    expect(limiter.tryConsume(CONNECTION, 500)).toBe(false);
  });

  /**
   * Sliding window.
   *
   * Once the window has fully elapsed, the earlier timestamps are pruned and the
   * connection is admitted again, so the cap is a rolling limit, not a permanent ban.
   */
  it('admits again once the window has elapsed', () => {
    const limiter = new ChatRateLimiter();
    for (let index = 0; index < CAP; index += 1) limiter.tryConsume(CONNECTION, 0);

    expect(limiter.tryConsume(CONNECTION, WINDOW_MS - 1)).toBe(false);
    expect(limiter.tryConsume(CONNECTION, WINDOW_MS)).toBe(true);
  });

  /**
   * Default clock.
   *
   * Called without an explicit time, the limiter must fall back to the real clock
   * and admit a first message, so production callers need not pass a timestamp.
   */
  it('admits a first message using the default clock', () => {
    const limiter = new ChatRateLimiter();

    expect(limiter.tryConsume(CONNECTION)).toBe(true);
  });

  /**
   * Release resets state.
   *
   * Releasing a connection must clear its window, so a reconnecting id (or a test)
   * starts fresh and the map never retains dead connections.
   */
  it('resets a connection when released', () => {
    const limiter = new ChatRateLimiter();
    for (let index = 0; index < CAP; index += 1) limiter.tryConsume(CONNECTION, 0);

    limiter.release(CONNECTION);

    expect(limiter.tryConsume(CONNECTION, 0)).toBe(true);
  });
});
