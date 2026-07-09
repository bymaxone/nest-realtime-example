/**
 * End-to-end tests for the instant kill switch and the reauth-cache stats.
 *
 * Layer: e2e.
 * Goal: disconnecting one connection by id closes only that stream and leaves the
 *       user's other tab live; the reauth stats endpoint proves the positive cache
 *       collapses many reauth cycles into a single revalidation.
 * Mocks: none; a real Nest app over HTTP with a live Redis-backed revalidate path.
 */

import type { INestApplication } from '@nestjs/common';
import { EventSource } from 'eventsource';
import request from 'supertest';

import { createApp } from '../../src/main';
import { login, nextEvent, openSse, waitForClose } from '../support/sse.fixture';

interface AddressInfo {
  readonly port: number;
}

const USER = 'ana@acme';
const EVENT = 'order.created';

/** Apply reauth env for a boot and return a restore function. */
function withEnv(interval: string, cacheTtlMs: string): () => void {
  const keys = ['REAUTH_INTERVAL_SECONDS', 'REAUTH_CACHE_TTL_MS'] as const;
  const saved = keys.map((key) => [key, process.env[key]] as const);
  process.env.REAUTH_INTERVAL_SECONDS = interval;
  process.env.REAUTH_CACHE_TTL_MS = cacheTtlMs;
  return () => {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('Kill switch (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let cookie: string;
  let restoreEnv: () => void;

  beforeAll(async () => {
    // A far-future reauth interval keeps the reauth cycle out of this suite.
    restoreEnv = withEnv('3600', '10000');
    app = await createApp();
    await app.listen(0);
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    cookie = await login(app, USER);
  });

  afterAll(async () => {
    await app.close();
    restoreEnv();
  });

  /**
   * Targeted disconnect.
   *
   * Disconnecting one of a user's two tabs by id must close only that stream; the
   * other tab stays connected and still receives a subsequent emit, proving the
   * kill switch is per-connection, not per-user.
   */
  it('closes one tab by id and leaves the other live', async () => {
    const tab1 = openSse(`${baseUrl}/api/events`, cookie);
    const tab2 = openSse(`${baseUrl}/api/events`, cookie);
    const established1 = await nextEvent(tab1, 'connection:established');
    await nextEvent(tab2, 'connection:established');
    const id1 = established1.connectionId as string;

    const survivor: string[] = [];
    tab2.addEventListener(EVENT, (event: MessageEvent<string>) => survivor.push(event.data));

    const listConnections = await request(app.getHttpServer())
      .get('/api/connections')
      .set('Cookie', cookie)
      .expect(200);
    expect((listConnections.body as { connections: unknown[] }).connections.length).toBe(2);

    const closed = waitForClose(tab1, 8000);
    await request(app.getHttpServer())
      .post(`/api/connections/${id1}/disconnect`)
      .set('Cookie', cookie)
      .expect(200);
    await closed;

    await request(app.getHttpServer())
      .post(`/api/emit/user/${encodeURIComponent(USER)}`)
      .set('Cookie', cookie)
      .send({ event: EVENT, data: { seq: 1 } })
      .expect(201);

    await sleep(300);
    expect(survivor.length).toBe(1);
    tab2.close();
  });

  /**
   * Anti-IDOR on disconnect.
   *
   * A caller must not be able to disconnect another user's connection: the kill
   * switch checks ownership before touching the transport.
   */
  it('forbids disconnecting a connection owned by another user', async () => {
    const gilCookie = await login(app, 'gil@globex');
    const gilTab = openSse(`${baseUrl}/api/events`, gilCookie);
    const established = await nextEvent(gilTab, 'connection:established');
    const gilConnectionId = established.connectionId as string;

    try {
      await request(app.getHttpServer())
        .post(`/api/connections/${gilConnectionId}/disconnect`)
        .set('Cookie', cookie)
        .expect(403);
    } finally {
      gilTab.close();
    }
  });
});

describe('Reauth cache stats (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let cookie: string;
  let restoreEnv: () => void;

  beforeAll(async () => {
    // A 1s interval with a 60s positive cache: the first cycle revalidates, every
    // later cycle within the window is skipped.
    restoreEnv = withEnv('1', '60000');
    app = await createApp();
    await app.listen(0);
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    cookie = await login(app, USER);
  });

  afterAll(async () => {
    await request(app.getHttpServer()).delete(`/api/auth/revoke/${USER}`).set('Cookie', cookie);
    await app.close();
    restoreEnv();
  });

  /**
   * Cache collapses cycles.
   *
   * Over several 1s reauth cycles the positive cache must hold, so the user is
   * revalidated exactly once despite many cycles, which the stats endpoint reports.
   */
  it('revalidates once across a burst of reauth cycles', async () => {
    await request(app.getHttpServer())
      .delete(`/api/auth/revoke/${USER}`)
      .set('Cookie', cookie)
      .expect(200);
    const source: EventSource = openSse(`${baseUrl}/api/events`, cookie);
    try {
      await nextEvent(source, 'connection:established');
      // Span at least three 1s reauth cycles.
      await sleep(3300);

      const stats = await request(app.getHttpServer())
        .get('/api/labs/reauth/stats')
        .set('Cookie', cookie)
        .expect(200);
      const entry = (
        stats.body as { revalidations: { userId: string; revalidations: number }[] }
      ).revalidations.find((row) => row.userId === USER);

      expect(entry?.revalidations).toBe(1);
    } finally {
      source.close();
    }
  });
});
