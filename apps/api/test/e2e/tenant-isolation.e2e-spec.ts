/**
 * End-to-end tests for tenant, user and broadcast emit isolation.
 *
 * Layer: e2e.
 * Goal: a tenant emit reaches only that tenant's clients, a user emit only that
 *       user, and a broadcast every client; delivered ids increase per client.
 * Mocks: none; three real SSE clients across two tenants against one app.
 */

import type { INestApplication } from '@nestjs/common';
import type { EventSource } from 'eventsource';
import request from 'supertest';

import { createApp } from '../../src/main';
import { login, nextEvent, openSse } from '../support/sse.fixture';

interface AddressInfo {
  readonly port: number;
}

interface Received {
  readonly id: string;
  readonly seq: number;
}

const EVENT = 'order.created';

/** Record the id and payload seq of every matching event on a client. */
function collect(source: EventSource): Received[] {
  const received: Received[] = [];
  source.addEventListener(EVENT, (event: MessageEvent<string>) => {
    received.push({ id: event.lastEventId, seq: (JSON.parse(event.data) as { seq: number }).seq });
  });
  return received;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Resolve once the predicate holds, or reject after the timeout. */
async function waitUntil(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('condition not met in time');
    await sleep(25);
  }
}

describe('Tenant isolation (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let anaCookie: string;
  let ana: EventSource;
  let bob: EventSource;
  let gil: EventSource;

  beforeAll(async () => {
    app = await createApp();
    await app.listen(0);
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    anaCookie = await login(app, 'ana@acme');
    const bobCookie = await login(app, 'bob@acme');
    const gilCookie = await login(app, 'gil@globex');

    ana = openSse(`${baseUrl}/api/events`, anaCookie);
    bob = openSse(`${baseUrl}/api/events`, bobCookie);
    gil = openSse(`${baseUrl}/api/events`, gilCookie);
    await Promise.all([
      nextEvent(ana, 'connection:established'),
      nextEvent(bob, 'connection:established'),
      nextEvent(gil, 'connection:established'),
    ]);
  });

  afterAll(async () => {
    ana.close();
    bob.close();
    gil.close();
    await app.close();
  });

  /** POST an emit as the authenticated ana session. */
  function emit(path: string, seq: number): request.Test {
    return request(app.getHttpServer())
      .post(path)
      .set('Cookie', anaCookie)
      .send({ event: EVENT, data: { seq } })
      .expect(201);
  }

  /**
   * Isolation proof.
   *
   * A tenant emit must reach only that tenant (acme: ana+bob, not gil); a user
   * emit only that user (ana); a broadcast every client. Each client's delivered
   * ids must be present and strictly lexicographically increasing.
   */
  it('isolates tenant and user emits while broadcasting to all', async () => {
    const anaEvents = collect(ana);
    const bobEvents = collect(bob);
    const gilEvents = collect(gil);

    await emit('/api/emit/tenant/acme', 1);
    await waitUntil(() => anaEvents.some((e) => e.seq === 1) && bobEvents.some((e) => e.seq === 1));
    await sleep(200);
    expect(gilEvents.some((e) => e.seq === 1)).toBe(false);

    await emit(`/api/emit/user/${encodeURIComponent('ana@acme')}`, 2);
    await waitUntil(() => anaEvents.some((e) => e.seq === 2));
    await sleep(200);
    expect(bobEvents.some((e) => e.seq === 2)).toBe(false);
    expect(gilEvents.some((e) => e.seq === 2)).toBe(false);

    await emit('/api/emit/broadcast', 3);
    await waitUntil(
      () =>
        anaEvents.some((e) => e.seq === 3) &&
        bobEvents.some((e) => e.seq === 3) &&
        gilEvents.some((e) => e.seq === 3),
    );

    expect(anaEvents.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(bobEvents.map((e) => e.seq)).toEqual([1, 3]);
    expect(gilEvents.map((e) => e.seq)).toEqual([3]);

    for (const events of [anaEvents, bobEvents, gilEvents]) {
      const ids = events.map((e) => e.id);
      expect(ids).toEqual([...ids].sort());
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
