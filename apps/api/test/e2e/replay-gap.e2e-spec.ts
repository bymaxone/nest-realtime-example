/**
 * End-to-end tests for the buffer-miss fallback.
 *
 * Layer: e2e.
 * Goal: when a reconnect's Last-Event-ID predates the in-memory buffer window, the
 *       durable offline queue covers the gap (delivering 2..15 in order); with the
 *       queue disabled the same gap is unrecoverable, and only the retained window
 *       replays, which the timeline marks explicitly.
 * Mocks: none; two real Nest apps, one with the offline queue on and one off, so
 *        the only variable across the two suites is the fallback storage.
 */

import type { INestApplication } from '@nestjs/common';
import type { Redis } from 'ioredis';
import request from 'supertest';

import { createApp } from '../../src/main';
import { OFFLINE_EVENT, REPLAY_EVENT } from '../../src/replay/replay.constants';
import { setEnv } from '../support/env.fixture';
import { clearOfflineQueue, createTestRedis } from '../support/offline-redis.fixture';
import {
  collectSeqEvents,
  login,
  nextEvent,
  openSse,
  openSseReplay,
  waitForClose,
  waitUntil,
} from '../support/sse.fixture';

interface AddressInfo {
  readonly port: number;
}

interface TimelineBody {
  readonly retainedSeqs: number[];
  readonly evictedSeqs: number[];
  readonly offlineQueued: ReadonlyArray<{ seq: number; id: string }>;
}

const GIL = 'gil@globex';
const LIVE_EVENT = 'lab.live';
const seqRange = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_unused, index) => from + index);

describe('Replay gap with offline queue (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let cookie: string;
  let redis: Redis;
  let restoreEnv: () => void;

  beforeAll(async () => {
    restoreEnv = setEnv({
      OFFLINE_QUEUE_ENABLED: 'true',
      REALTIME_REPLAY_BUFFER_SIZE: '10',
      REAUTH_INTERVAL_SECONDS: '3600',
    });
    app = await createApp();
    await app.listen(0);
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    cookie = await login(app, GIL);
    redis = createTestRedis();
    await clearOfflineQueue(redis, GIL);
  });

  afterAll(async () => {
    await app.close();
    await redis.quit();
    restoreEnv();
  });

  const timeline = async (): Promise<TimelineBody> => {
    const response = await request(app.getHttpServer())
      .get(`/api/labs/replay/timeline?userId=${encodeURIComponent(GIL)}`)
      .set('Cookie', cookie)
      .expect(200);
    return response.body as TimelineBody;
  };

  /**
   * Queue covers the gap the buffer lost.
   *
   * Bursting 15 while offline keeps only 6..15 in the buffer but all 15 in the
   * queue. Reconnecting from event 1 (below the window) is a buffer miss, so the
   * queue must deliver 2..15 in order; the timeline shows 1..5 evicted yet present
   * in the queue, proving the durable fallback recovers what the buffer dropped.
   */
  it('drains the offline queue when the buffer misses', async () => {
    await request(app.getHttpServer())
      .post('/api/labs/offline/emit')
      .set('Cookie', cookie)
      .send({ userId: GIL, count: 15 })
      .expect(201);

    const before = await timeline();
    expect(before.retainedSeqs).toEqual(seqRange(6, 15));
    expect(before.evictedSeqs).toEqual(seqRange(1, 5));
    expect(before.offlineQueued.map((event) => event.seq)).toEqual(seqRange(1, 15));
    const cursor = before.offlineQueued[0]?.id ?? '';

    const source = openSseReplay(`${baseUrl}/api/events`, cookie, cursor);
    const delivered = collectSeqEvents(source, OFFLINE_EVENT);
    try {
      await waitUntil(() => delivered.length === 14);
      expect(delivered.map((event) => event.seq)).toEqual(seqRange(2, 15));
    } finally {
      source.close();
    }
  });
});

describe('Replay gap without offline queue (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let cookie: string;
  let restoreEnv: () => void;

  beforeAll(async () => {
    restoreEnv = setEnv({
      OFFLINE_QUEUE_ENABLED: 'false',
      REALTIME_REPLAY_BUFFER_SIZE: '10',
      REAUTH_INTERVAL_SECONDS: '3600',
    });
    app = await createApp();
    await app.listen(0);
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    cookie = await login(app, GIL);
  });

  afterAll(async () => {
    await app.close();
    restoreEnv();
  });

  /** Connect, burst 15, drop the stream, and return a seq-to-id lookup. */
  const burstAndDrop = async (): Promise<(seq: number) => string> => {
    const source = openSse(`${baseUrl}/api/events`, cookie);
    const received = collectSeqEvents(source, REPLAY_EVENT);
    await nextEvent(source, 'connection:established');
    await request(app.getHttpServer())
      .post('/api/labs/replay/emit-burst')
      .set('Cookie', cookie)
      .send({ count: 15 })
      .expect(201);
    await waitUntil(() => received.length === 15);
    const closed = waitForClose(source);
    await request(app.getHttpServer())
      .post('/api/labs/replay/drop')
      .set('Cookie', cookie)
      .expect(200);
    await closed;
    return (seq: number): string => received.find((event) => event.seq === seq)?.id ?? '';
  };

  /** Reconnect from a cursor and assert the replayed sequence numbers. */
  const expectReplay = async (cursor: string, expected: number[]): Promise<void> => {
    const source = openSseReplay(`${baseUrl}/api/events`, cookie, cursor);
    const replayed = collectSeqEvents(source, REPLAY_EVENT);
    try {
      await waitUntil(() => replayed.length === expected.length);
      expect(replayed.map((event) => event.seq)).toEqual(expected);
    } finally {
      source.close();
    }
  };

  /** Reconnect from an evicted cursor and assert nothing replays before a live event. */
  const expectGap = async (cursor: string): Promise<void> => {
    const source = openSseReplay(`${baseUrl}/api/events`, cookie, cursor);
    const afterGap = collectSeqEvents(source, REPLAY_EVENT);
    const live = collectSeqEvents(source, LIVE_EVENT);
    try {
      await nextEvent(source, 'connection:established');
      await request(app.getHttpServer())
        .post(`/api/emit/user/${encodeURIComponent(GIL)}`)
        .set('Cookie', cookie)
        .send({ event: LIVE_EVENT, data: { seq: 21 } })
        .expect(201);
      await waitUntil(() => live.length === 1);
      expect(afterGap).toHaveLength(0);
    } finally {
      source.close();
    }
  };

  /**
   * The gap is unrecoverable without a queue.
   *
   * Bursting 15 while connected keeps only 6..15 in the buffer. Reconnecting from
   * the oldest retained id replays only the window (7..15); reconnecting from an
   * evicted id replays nothing; and the timeline reports an empty queue, so the
   * loss of 1..5 is explicit rather than silently patched. The window check runs
   * first because the live event in the gap check would evict the oldest retained id.
   */
  it('replays only the buffer window and marks the gap', async () => {
    const idOfSeq = await burstAndDrop();

    await expectReplay(idOfSeq(6), seqRange(7, 15));
    await expectGap(idOfSeq(1));

    const response = await request(app.getHttpServer())
      .get(`/api/labs/replay/timeline?userId=${encodeURIComponent(GIL)}`)
      .set('Cookie', cookie)
      .expect(200);
    const body = response.body as TimelineBody;
    expect(body.evictedSeqs).toEqual(seqRange(1, 5));
    expect(body.offlineQueued).toHaveLength(0);
  });
});
