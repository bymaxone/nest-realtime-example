/**
 * Unit tests for RedisOfflineQueue.
 *
 * Layer: unit.
 * Goal: prove the append/retrieve/acknowledge contract, lexicographic ordering,
 *       the since filter, the result limit, TTL refresh, oldest-first trimming and
 *       pipeline error propagation, all against an in-memory sorted-set double.
 * Mocks: FakeRedis (a faithful sorted-set stand-in), never a real Redis.
 */

import type { OfflineQueuedEvent } from '@bymax-one/nest-realtime';

import { RedisOfflineQueue } from '../../src/realtime/redis-offline-queue';
import { asRedis, FakeRedis } from '../support/fake-redis';

const USER = 'ana@acme';
const TTL_SECONDS = 3600;
const EMITTED_AT = new Date('2026-07-09T00:00:00.000Z');

/**
 * Build a queued event with a fixed-width id and a sequence payload.
 *
 * @param id - The library-style event id.
 * @param seq - The sequence number carried in the payload.
 * @returns A queued event fixture.
 */
function makeEvent(id: string, seq: number): OfflineQueuedEvent {
  return { id, event: 'lab.offline', data: { seq }, emittedAt: EMITTED_AT };
}

/** A monotonic, fixed-width id for sequence `n`. */
function idOf(n: number): string {
  return `1700000000000-${String(n).padStart(6, '0')}`;
}

describe('RedisOfflineQueue', () => {
  let redis: FakeRedis;

  const buildQueue = (maxPerUser = 500): RedisOfflineQueue =>
    new RedisOfflineQueue({ client: asRedis(redis), ttlSeconds: TTL_SECONDS, maxPerUser });

  beforeEach(() => {
    redis = new FakeRedis();
  });

  /**
   * Append then read back with a refreshed TTL.
   *
   * A single append must be retrievable from `id '0'` and must refresh the key's
   * TTL under the per-user key, so an active queue never expires mid-use.
   */
  it('appends an event and reads it back, refreshing the TTL', async () => {
    const queue = buildQueue();

    await queue.append(USER, makeEvent(idOf(1), 1));
    const events = await queue.retrieveSince(USER, '0', 10);

    expect(events).toEqual([makeEvent(idOf(1), 1)]);
    expect(redis.expireCalls).toEqual([{ key: `realtime:offline:${USER}`, seconds: TTL_SECONDS }]);
  });

  /**
   * Ordered retrieval, strictly after the cursor.
   *
   * Retrieval must return events with `id > sinceId` in ascending lexicographic
   * id order, the same comparison the in-memory replay buffer uses, so a drain
   * interleaves cleanly with buffer replay.
   */
  it('returns events strictly newer than the cursor in id order', async () => {
    const queue = buildQueue();
    for (let seq = 1; seq <= 3; seq += 1) {
      await queue.append(USER, makeEvent(idOf(seq), seq));
    }

    expect((await queue.retrieveSince(USER, '0', 10)).map((event) => event.id)).toEqual([
      idOf(1),
      idOf(2),
      idOf(3),
    ]);
    expect((await queue.retrieveSince(USER, idOf(2), 10)).map((event) => event.id)).toEqual([
      idOf(3),
    ]);
  });

  /**
   * Result limit.
   *
   * Retrieval must never return more than `limit` events, bounding the payload a
   * single reconnect drains.
   */
  it('caps the result at the requested limit', async () => {
    const queue = buildQueue();
    for (let seq = 1; seq <= 3; seq += 1) {
      await queue.append(USER, makeEvent(idOf(seq), seq));
    }

    expect((await queue.retrieveSince(USER, '0', 2)).map((event) => event.id)).toEqual([
      idOf(1),
      idOf(2),
    ]);
  });

  /**
   * Oldest-first trimming.
   *
   * Appending past `maxPerUser` must trim the oldest events so a disconnected user
   * can never grow the queue without bound; only the newest N survive.
   */
  it('trims to maxPerUser oldest-first on append', async () => {
    const queue = buildQueue(3);
    for (let seq = 1; seq <= 5; seq += 1) {
      await queue.append(USER, makeEvent(idOf(seq), seq));
    }

    expect((await queue.retrieveSince(USER, '0', 10)).map((event) => event.id)).toEqual([
      idOf(3),
      idOf(4),
      idOf(5),
    ]);
  });

  /**
   * Empty queue.
   *
   * A user who never had events queued must retrieve an empty list, not throw.
   */
  it('returns an empty array for a user with no queue', async () => {
    expect(await buildQueue().retrieveSince('nobody', '0', 10)).toEqual([]);
  });

  /**
   * Date revival.
   *
   * `emittedAt` must round-trip as a real `Date`, not the JSON string it is stored
   * as, so the value honors the `OfflineQueuedEvent` contract.
   */
  it('revives emittedAt as a Date', async () => {
    const queue = buildQueue();
    await queue.append(USER, makeEvent(idOf(1), 1));

    const [event] = await queue.retrieveSince(USER, '0', 10);

    expect(event?.emittedAt).toBeInstanceOf(Date);
    expect(event?.emittedAt.toISOString()).toBe(EMITTED_AT.toISOString());
  });

  /**
   * Acknowledge purges the delivered prefix.
   *
   * Acknowledging up to a watermark must remove every event with `id <= upToId`
   * and keep the rest, so redelivery never repeats a confirmed event.
   */
  it('purges events up to and including the watermark', async () => {
    const queue = buildQueue();
    for (let seq = 1; seq <= 3; seq += 1) {
      await queue.append(USER, makeEvent(idOf(seq), seq));
    }

    await queue.acknowledge(USER, idOf(2));

    expect((await queue.retrieveSince(USER, '0', 10)).map((event) => event.id)).toEqual([idOf(3)]);
  });

  /**
   * Acknowledge no-op.
   *
   * When nothing sits at or below the watermark, acknowledge must issue no removal
   * so it never touches Redis needlessly and never drops undelivered events.
   */
  it('removes nothing when no event is at or below the watermark', async () => {
    const queue = buildQueue();
    const zrem = jest.spyOn(redis, 'zrem');
    for (let seq = 2; seq <= 3; seq += 1) {
      await queue.append(USER, makeEvent(idOf(seq), seq));
    }

    await queue.acknowledge(USER, '0');

    expect(zrem).not.toHaveBeenCalled();
    expect((await queue.retrieveSince(USER, '0', 10)).map((event) => event.id)).toEqual([
      idOf(2),
      idOf(3),
    ]);
  });

  /**
   * Pipeline failure propagates.
   *
   * A failed pipelined command must surface as a rejection rather than a silent
   * drop, so a storage fault is never mistaken for a successful append.
   */
  it('throws when a pipelined command reports an error', async () => {
    const queue = buildQueue();
    redis.failNextPipeline();

    await expect(queue.append(USER, makeEvent(idOf(1), 1))).rejects.toThrow('pipeline failed');
  });

  /**
   * Null exec tolerated.
   *
   * ioredis can resolve `exec()` to `null`; append must treat that as no errors
   * rather than crash on an absent result set.
   */
  it('tolerates a null exec result', async () => {
    const queue = buildQueue();
    redis.nullNextPipeline();

    await expect(queue.append(USER, makeEvent(idOf(1), 1))).resolves.toBeUndefined();
  });

  /**
   * Equal-id ordering is stable.
   *
   * Two entries that decode to the same id (a defensive edge, since ids are
   * monotonic) must not reorder unpredictably: the tie-break comparison keeps both
   * and retrieval still returns them without error.
   */
  it('keeps both entries when two decode to the same id', async () => {
    const queue = buildQueue();
    await queue.append(USER, { ...makeEvent(idOf(1), 1), event: 'a' });
    await queue.append(USER, { ...makeEvent(idOf(1), 1), event: 'b' });

    const events = await queue.retrieveSince(USER, '0', 10);

    expect(events.map((event) => event.event).sort()).toEqual(['a', 'b']);
  });

  /**
   * Ordering survives storage score divergence.
   *
   * Ordering must come from the lexicographic id, not the ZSET score: even when a
   * clock skew stores a newer id under a lower score, retrieval must still return
   * events in id order. This is the guarantee the id-scheme rests on.
   */
  it('re-sorts by id when the storage score diverges from id order', async () => {
    const queue = buildQueue();
    const nowSpy = jest.spyOn(Date, 'now');
    // The higher id lands under the lower score, so raw storage order is reversed.
    nowSpy.mockReturnValueOnce(100);
    await queue.append(USER, makeEvent(idOf(2), 2));
    nowSpy.mockReturnValueOnce(200);
    await queue.append(USER, makeEvent(idOf(1), 1));
    nowSpy.mockRestore();

    expect((await queue.retrieveSince(USER, '0', 10)).map((event) => event.id)).toEqual([
      idOf(1),
      idOf(2),
    ]);
  });
});
