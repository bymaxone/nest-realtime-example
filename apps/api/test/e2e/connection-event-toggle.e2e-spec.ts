/**
 * End-to-end test for the sse.emitConnectionEvent toggle.
 *
 * Layer: e2e.
 * Goal: with REALTIME_EMIT_CONNECTION_EVENT=false the server never sends
 *       connection:established, yet the stream is live and still delivers emits.
 * Mocks: none; a real Nest app booted in-process with the toggle disabled.
 */

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createApp } from '../../src/main';
import { login, nextEvent, openSse, waitForOpen } from '../support/sse.fixture';

interface AddressInfo {
  readonly port: number;
}

const USER = 'ana@acme';
const EVENT = 'order.created';
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('emitConnectionEvent toggle (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let cookie: string;
  const saved: Record<string, string | undefined> = {};

  beforeAll(async () => {
    for (const key of ['REALTIME_EMIT_CONNECTION_EVENT', 'REAUTH_INTERVAL_SECONDS']) {
      saved[key] = process.env[key];
    }
    process.env.REALTIME_EMIT_CONNECTION_EVENT = 'false';
    process.env.REAUTH_INTERVAL_SECONDS = '3600';
    app = await createApp();
    await app.listen(0);
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    cookie = await login(app, USER);
  });

  afterAll(async () => {
    await app.close();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  /**
   * Silent connect, live stream.
   *
   * The client must not receive connection:established (the toggle suppresses it),
   * but the stream is open and a subsequently emitted event still arrives, proving
   * the toggle only silences the connect event and not delivery.
   */
  it('suppresses connection:established while still delivering emits', async () => {
    const source = openSse(`${baseUrl}/api/events`, cookie);
    let establishedSeen = false;
    source.addEventListener('connection:established', () => {
      establishedSeen = true;
    });

    try {
      await waitForOpen(source);
      // Give the server a moment to register the connection before emitting.
      await sleep(200);

      const received = nextEvent(source, EVENT, 8000);
      await request(app.getHttpServer())
        .post(`/api/emit/user/${encodeURIComponent(USER)}`)
        .set('Cookie', cookie)
        .send({ event: EVENT, data: { seq: 1 } })
        .expect(201);
      const payload = await received;

      expect(payload).toEqual({ seq: 1 });
      expect(establishedSeen).toBe(false);
    } finally {
      source.close();
    }
  });
});
