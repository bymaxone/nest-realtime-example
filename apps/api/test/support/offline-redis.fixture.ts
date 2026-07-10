/**
 * @fileoverview Direct Redis access for offline-queue end-to-end cleanup.
 * @layer test-support
 *
 * The offline-queue suites reuse the seeded demo users, so their per-user keys
 * would carry across tests; this opens a throwaway client to delete a user's
 * queue key between scenarios, keeping each test isolated.
 */

import Redis from 'ioredis';

/** The offline-queue key namespace the queue writes under. */
const KEY_PREFIX = 'realtime:offline';

/** Redis URL the suite connects to (matching the app under test). */
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

/**
 * Open a test Redis client bound to the same instance as the app under test.
 *
 * @returns A connected ioredis client the suite must close in `afterAll`.
 */
export function createTestRedis(): Redis {
  return new Redis(REDIS_URL, { maxRetriesPerRequest: 1 });
}

/**
 * Delete a user's offline queue so a scenario starts from an empty queue.
 *
 * @param client - The test Redis client.
 * @param userId - The user whose queue key is removed.
 */
export async function clearOfflineQueue(client: Redis, userId: string): Promise<void> {
  await client.del(`${KEY_PREFIX}:${userId}`);
}
