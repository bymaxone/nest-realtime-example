/**
 * End-to-end tests for the Last-Event-ID replay lab.
 *
 * Layer: e2e.
 * Goal: after a drop and reconnect, the in-memory buffer replays missed events in
 *       order before any live event, and at a buffer of 10 the oldest events age
 *       out honestly: reconnecting from a retained id replays the tail, while
 *       reconnecting from an evicted id replays nothing (a gap).
 * Mocks: none; a real Nest app over HTTP with the offline queue disabled, so the
 *        buffer is the only recovery path under test.
 */

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createApp } from '../../src/main';
import { REPLAY_EVENT } from '../../src/replay/replay.constants';
import { setEnv } from '../support/env.fixture';
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

const ANA = 'ana@acme';
const GIL = 'gil@globex';
const LIVE_EVENT = 'lab.live';

describe('Replay lab (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let restoreEnv: () => void;

  beforeAll(async () => {
    // Buffer of 10, offline queue off, reauth pushed far out so no cycle interferes.
    restoreEnv = setEnv({
      REALTIME_REPLAY_BUFFER_SIZE: '10',
      OFFLINE_QUEUE_ENABLED: 'false',
      REAUTH_INTERVAL_SECONDS: '3600',
    });
    app = await createApp();
    await app.listen(0);
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await app.close();
    restoreEnv();
  });

  const burst = (cookie: string, count: number): request.Test =>
    request(app.getHttpServer())
      .post('/api/labs/replay/emit-burst')
      .set('Cookie', cookie)
      .send({ count });

  const drop = (cookie: string): request.Test =>
    request(app.getHttpServer()).post('/api/labs/replay/drop').set('Cookie', cookie);

  /**
   * In-buffer ordered replay before live.
   *
   * After a burst and a forced drop, reconnecting with the id of the first event
   * must replay every later event (2..5) in order, and a live event emitted after
   * reconnect must arrive only after that replay, proving recovery preserves order.
   */
  it('replays missed events in order before live events', async () => {
    const cookie = await login(app, ANA);
    const source = openSse(`${baseUrl}/api/events`, cookie);
    const received = collectSeqEvents(source, REPLAY_EVENT);
    await nextEvent(source, 'connection:established');

    await burst(cookie, 5).expect(201);
    await waitUntil(() => received.length === 5);
    const cursor = received[0]?.id ?? '';
    const closed = waitForClose(source);
    await drop(cookie).expect(200);
    await closed;

    const reconnect = openSseReplay(`${baseUrl}/api/events`, cookie, cursor);
    const replayed = collectSeqEvents(reconnect, REPLAY_EVENT);
    const live = collectSeqEvents(reconnect, LIVE_EVENT);
    try {
      await waitUntil(() => replayed.length === 4);
      expect(replayed.map((event) => event.seq)).toEqual([2, 3, 4, 5]);

      await request(app.getHttpServer())
        .post(`/api/emit/user/${encodeURIComponent(ANA)}`)
        .set('Cookie', cookie)
        .send({ event: LIVE_EVENT, data: { seq: 99 } })
        .expect(201);
      await waitUntil(() => live.length === 1);
      expect(live[0]?.seq).toBe(99);
    } finally {
      reconnect.close();
    }
  });

  /**
   * Honest buffer cap at size 10.
   *
   * Bursting 15 keeps only the newest 10 (seqs 6..15). Reconnecting from the
   * oldest retained id replays the tail (7..15); reconnecting from an evicted id
   * replays nothing, and the timeline marks seqs 1..5 evicted, so the cap is
   * demonstrated without pretending an aged-out event is still available.
   */
  it('evicts the oldest events beyond the buffer window', async () => {
    const cookie = await login(app, GIL);
    const source = openSse(`${baseUrl}/api/events`, cookie);
    const received = collectSeqEvents(source, REPLAY_EVENT);
    await nextEvent(source, 'connection:established');

    await burst(cookie, 15).expect(201);
    await waitUntil(() => received.length === 15);
    const idOfSeq = (seq: number): string => received.find((event) => event.seq === seq)?.id ?? '';
    const closed = waitForClose(source);
    await drop(cookie).expect(200);
    await closed;

    const fromRetained = openSseReplay(`${baseUrl}/api/events`, cookie, idOfSeq(6));
    const tail = collectSeqEvents(fromRetained, REPLAY_EVENT);
    try {
      await waitUntil(() => tail.length === 9);
      expect(tail.map((event) => event.seq)).toEqual([7, 8, 9, 10, 11, 12, 13, 14, 15]);
    } finally {
      fromRetained.close();
    }

    const fromEvicted = openSseReplay(`${baseUrl}/api/events`, cookie, idOfSeq(3));
    const afterGap = collectSeqEvents(fromEvicted, REPLAY_EVENT);
    const live = collectSeqEvents(fromEvicted, LIVE_EVENT);
    try {
      await request(app.getHttpServer())
        .post(`/api/emit/user/${encodeURIComponent(GIL)}`)
        .set('Cookie', cookie)
        .send({ event: LIVE_EVENT, data: { seq: 42 } })
        .expect(201);
      await waitUntil(() => live.length === 1);
      expect(afterGap).toHaveLength(0);
    } finally {
      fromEvicted.close();
    }

    const timeline = await request(app.getHttpServer())
      .get(`/api/labs/replay/timeline?userId=${encodeURIComponent(GIL)}`)
      .set('Cookie', cookie)
      .expect(200);
    const body = timeline.body as { retainedSeqs: number[]; evictedSeqs: number[] };
    expect(body.retainedSeqs).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    expect(body.evictedSeqs).toEqual([1, 2, 3, 4, 5]);
  });
});
