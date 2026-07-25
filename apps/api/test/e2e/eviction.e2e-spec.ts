/**
 * End-to-end test for FIFO connection eviction.
 *
 * Layer: e2e.
 * Goal: with maxConnectionsPerUser=2, opening a third and fourth connection for
 *       one user evicts the OLDEST each time with REALTIME_TOO_MANY_CONNECTIONS
 *       while every new connection is admitted; there is never an HTTP 429.
 * Mocks: none; a real Nest app over HTTP. A far-future reauth interval keeps the
 *        reauth cycle out of the test.
 */

import type { INestApplication } from '@nestjs/common';
import { EventSource } from 'eventsource';
import request from 'supertest';

import { createApp } from '../../src/main';
import { login, nextEvent, openSse, waitForClose } from '../support/sse.fixture';

interface AddressInfo {
  readonly port: number;
}

interface TimelineEntry {
  readonly connectionId: string;
  readonly evictedAt: string | null;
  readonly reason: string | null;
}

const USER = 'ana@acme';
const TOO_MANY = 'REALTIME_TOO_MANY_CONNECTIONS';

describe('FIFO eviction (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let cookie: string;
  const savedInterval = process.env.REAUTH_INTERVAL_SECONDS;
  const savedMaxConnections = process.env.REALTIME_MAX_CONNECTIONS_PER_USER;

  beforeAll(async () => {
    process.env.REAUTH_INTERVAL_SECONDS = '3600';
    // Pinned rather than inherited: this suite is about the eviction boundary, so
    // it must not silently stop testing it when the shipped default changes.
    process.env.REALTIME_MAX_CONNECTIONS_PER_USER = '2';
    app = await createApp();
    await app.listen(0);
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    cookie = await login(app, USER);
  });

  afterAll(async () => {
    await app.close();
    if (savedInterval === undefined) delete process.env.REAUTH_INTERVAL_SECONDS;
    else process.env.REAUTH_INTERVAL_SECONDS = savedInterval;
    if (savedMaxConnections === undefined) delete process.env.REALTIME_MAX_CONNECTIONS_PER_USER;
    else process.env.REALTIME_MAX_CONNECTIONS_PER_USER = savedMaxConnections;
  });

  /** Open an SSE connection and return it with its connection id. */
  async function connect(): Promise<{ source: EventSource; id: string }> {
    const source = openSse(`${baseUrl}/api/events`, cookie);
    const established = await nextEvent(source, 'connection:established');
    return { source, id: established.connectionId as string };
  }

  /** Fetch the eviction timeline for the user as a map keyed by connection id. */
  async function timelineById(): Promise<Map<string, TimelineEntry>> {
    const response = await request(app.getHttpServer())
      .get(`/api/labs/eviction/timeline?userId=${encodeURIComponent(USER)}`)
      .set('Cookie', cookie)
      .expect(200);
    const timeline = (response.body as { timeline: TimelineEntry[] }).timeline;
    return new Map(timeline.map((entry) => [entry.connectionId, entry]));
  }

  /**
   * Newest admitted, oldest evicted, never 429.
   *
   * Connections A,B open under the limit; C evicts A; D evicts B. Every open
   * receives connection:established (a 200 handshake, never 429), the two evictions
   * carry REALTIME_TOO_MANY_CONNECTIONS, and A is evicted strictly before B.
   */
  it('evicts the oldest connection and admits the newest', async () => {
    const a = await connect();
    const aClosed = waitForClose(a.source, 8000);
    const b = await connect();
    const bClosed = waitForClose(b.source, 8000);

    // Third connection admits and evicts A (the oldest).
    const c = await connect();
    await aClosed;

    // Fourth connection admits and evicts B (now the oldest).
    const d = await connect();
    await bClosed;

    const byId = await timelineById();
    try {
      // The two oldest connections (A, B) are evicted with the FIFO reason; the two
      // newest (C, D) are admitted and still live.
      expect(byId.get(a.id)?.reason).toBe(TOO_MANY);
      expect(byId.get(b.id)?.reason).toBe(TOO_MANY);
      expect(byId.get(c.id)?.reason).toBeNull();
      expect(byId.get(d.id)?.reason).toBeNull();

      const evicted = [...byId.values()].filter((e) => e.reason === TOO_MANY);
      const survived = [...byId.values()].filter((e) => e.reason === null);
      expect(new Set(evicted.map((e) => e.connectionId))).toEqual(new Set([a.id, b.id]));
      expect(new Set(survived.map((e) => e.connectionId))).toEqual(new Set([c.id, d.id]));

      // A connected before B, so FIFO evicts A first: its close is not after B's.
      const aEvictedAt = byId.get(a.id)?.evictedAt ?? '';
      const bEvictedAt = byId.get(b.id)?.evictedAt ?? '';
      expect(aEvictedAt <= bEvictedAt).toBe(true);
    } finally {
      c.source.close();
      d.source.close();
    }
  });
});
