/**
 * End-to-end tests for the one-shot ticket auth path and SSE 401 handling.
 *
 * Layer: e2e.
 * Goal: an issued ticket authenticates a cookie-less SSE connection exactly once;
 *       reuse, a garbage ticket and no-credential access all return 401.
 * Mocks: none; a real Nest app over HTTP with a live Redis ticket store.
 */

import type { INestApplication } from '@nestjs/common';
import { EventSource } from 'eventsource';
import request from 'supertest';

import { createApp } from '../../src/main';
import { login, nextEvent } from '../support/sse.fixture';

interface AddressInfo {
  readonly port: number;
}

describe('Ticket auth (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let cookie: string;

  beforeAll(async () => {
    app = await createApp();
    await app.listen(0);
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
    cookie = await login(app, 'ana@acme');
  });

  afterAll(async () => {
    await app.close();
  });

  /** Issue a one-shot ticket for the logged-in ana session. */
  async function issueTicket(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/ticket')
      .set('Cookie', cookie)
      .expect(201);
    return (response.body as { ticket: string }).ticket;
  }

  /**
   * Cookie-less happy path.
   *
   * A freshly issued ticket on the query string must authenticate an EventSource
   * that sends no cookie, delivering connection:established with ana's traits.
   */
  it('authenticates a cookie-less SSE connection with a ticket', async () => {
    const ticket = await issueTicket();
    const source = new EventSource(`${baseUrl}/api/events?ticket=${ticket}`);
    try {
      const data = await nextEvent(source, 'connection:established');

      expect(data.traits).toEqual({ userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] });
    } finally {
      source.close();
    }
  });

  /**
   * One-shot reuse rejection.
   *
   * A ticket is consumed with GETDEL on first use, so replaying it must fail auth
   * and answer 401, proving a captured ticket cannot be replayed.
   */
  it('rejects a reused ticket with 401', async () => {
    const ticket = await issueTicket();
    const first = new EventSource(`${baseUrl}/api/events?ticket=${ticket}`);
    try {
      await nextEvent(first, 'connection:established');
    } finally {
      first.close();
    }

    const replay = await fetch(`${baseUrl}/api/events?ticket=${ticket}`);
    await replay.body?.cancel();

    expect(replay.status).toBe(401);
  });

  /**
   * Garbage ticket rejection.
   *
   * A ticket id that was never issued redeems to null, so the stream must answer
   * 401 rather than admit an unauthenticated connection.
   */
  it('rejects a garbage ticket with 401', async () => {
    const response = await fetch(`${baseUrl}/api/events?ticket=never-issued`);
    await response.body?.cancel();

    expect(response.status).toBe(401);
  });

  /**
   * No-credential rejection.
   *
   * Without a cookie or a ticket the composite falls back to the cookie path,
   * finds nothing and returns 401 (a browser will not retry a fatal 401).
   */
  it('rejects access with neither cookie nor ticket (401)', async () => {
    const response = await fetch(`${baseUrl}/api/events`);
    await response.body?.cancel();

    expect(response.status).toBe(401);
  });
});
