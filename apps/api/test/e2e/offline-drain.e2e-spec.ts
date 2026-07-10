/**
 * End-to-end tests for the offline drain lab.
 *
 * Layer: e2e.
 * Goal: events emitted while a user has no connection are queued in Redis, drain
 *       in order and auto-acknowledge when the user reconnects with the drain
 *       cursor, the peek endpoint reflects the queue, the ack endpoint purges it,
 *       and emitting to a connected user is refused.
 * Mocks: none; a real Nest app with the offline queue enabled over a live Redis.
 */

import type { INestApplication } from '@nestjs/common';
import type { Redis } from 'ioredis';
import request from 'supertest';

import { createApp } from '../../src/main';
import { MIN_EVENT_ID, OFFLINE_EVENT } from '../../src/replay/replay.constants';
import { setEnv } from '../support/env.fixture';
import { clearOfflineQueue, createTestRedis } from '../support/offline-redis.fixture';
import {
  collectSeqEvents,
  login,
  nextEvent,
  openSse,
  openSseReplay,
  waitUntil,
} from '../support/sse.fixture';

interface AddressInfo {
  readonly port: number;
}

interface PeekBody {
  readonly events: ReadonlyArray<{ seq: number; id: string }>;
}

const GIL = 'gil@globex';
const LIVE_EVENT = 'lab.live';
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('Offline drain lab (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let cookie: string;
  let redis: Redis;
  let restoreEnv: () => void;

  beforeAll(async () => {
    restoreEnv = setEnv({ OFFLINE_QUEUE_ENABLED: 'true', REAUTH_INTERVAL_SECONDS: '3600' });
    app = await createApp();
    await app.listen(0);
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    cookie = await login(app, GIL);
    redis = createTestRedis();
  });

  afterAll(async () => {
    await app.close();
    await redis.quit();
    restoreEnv();
  });

  /** Poll the connections view until the user has no live SSE stream. */
  const waitForNoConnections = async (): Promise<void> => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const response = await request(app.getHttpServer())
        .get('/api/connections')
        .set('Cookie', cookie)
        .expect(200);
      const connections = (response.body as { connections: Array<{ userId: string }> }).connections;
      if (!connections.some((connection) => connection.userId === GIL)) return;
      await sleep(50);
    }
  };

  beforeEach(async () => {
    await clearOfflineQueue(redis, GIL);
    await waitForNoConnections();
  });

  const emitOffline = (count: number): request.Test =>
    request(app.getHttpServer())
      .post('/api/labs/offline/emit')
      .set('Cookie', cookie)
      .send({ userId: GIL, count });

  const peek = async (): Promise<PeekBody> => {
    const response = await request(app.getHttpServer())
      .get(`/api/labs/offline/peek?userId=${encodeURIComponent(GIL)}`)
      .set('Cookie', cookie)
      .expect(200);
    return response.body as PeekBody;
  };

  /**
   * Queue growth while offline.
   *
   * Emitting to a user with no connection must land every event in the Redis
   * queue, in order, so the peek endpoint mirrors what a reconnect would drain.
   */
  it('queues events for an offline user', async () => {
    await emitOffline(5).expect(201);

    const { events } = await peek();

    expect(events.map((event) => event.seq)).toEqual([1, 2, 3, 4, 5]);
  });

  /**
   * Drain in order, then auto-acknowledge.
   *
   * Reconnecting with the drain cursor must deliver the five queued events in
   * order ahead of any live event, and the library must acknowledge them so the
   * queue is empty afterward, proving at-least-once delivery that then prunes.
   */
  it('drains the queue in order on reconnect and purges it', async () => {
    await emitOffline(5).expect(201);
    const source = openSseReplay(`${baseUrl}/api/events`, cookie, MIN_EVENT_ID);
    const drained = collectSeqEvents(source, OFFLINE_EVENT);
    const live = collectSeqEvents(source, LIVE_EVENT);

    try {
      await waitUntil(() => drained.length === 5);
      expect(drained.map((event) => event.seq)).toEqual([1, 2, 3, 4, 5]);

      await request(app.getHttpServer())
        .post(`/api/emit/user/${encodeURIComponent(GIL)}`)
        .set('Cookie', cookie)
        .send({ event: LIVE_EVENT, data: { seq: 77 } })
        .expect(201);
      await waitUntil(() => live.length === 1);
      expect(live[0]?.seq).toBe(77);

      let remaining = (await peek()).events.length;
      for (let attempt = 0; attempt < 20 && remaining > 0; attempt += 1) {
        await sleep(50);
        remaining = (await peek()).events.length;
      }
      expect(remaining).toBe(0);
    } finally {
      source.close();
    }
  });

  /**
   * Manual acknowledge purges the queue.
   *
   * Acknowledging up to the last queued id must remove every queued event without
   * a connection, so the lab can purge a queue directly for the visualizer.
   */
  it('purges the queue via the acknowledge endpoint', async () => {
    await emitOffline(5).expect(201);
    const before = await peek();
    const upToId = before.events[before.events.length - 1]?.id ?? '';

    await request(app.getHttpServer())
      .post('/api/labs/offline/ack')
      .set('Cookie', cookie)
      .send({ upToId })
      .expect(200);

    expect((await peek()).events).toHaveLength(0);
  });

  /**
   * Refuse emit to a connected user.
   *
   * Emitting to a user with a live connection would deliver instead of queue, so
   * the lab must reject it with a conflict rather than silently mislead the demo.
   */
  it('rejects an offline emit to a connected user', async () => {
    const source = openSse(`${baseUrl}/api/events`, cookie);
    try {
      await nextEvent(source, 'connection:established');
      await emitOffline(1).expect(409);
    } finally {
      source.close();
    }
  });
});
