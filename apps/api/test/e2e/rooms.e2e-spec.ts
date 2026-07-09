/**
 * End-to-end tests for resource rooms and their orthogonality to tenants.
 *
 * Layer: e2e.
 * Goal: two acme users in resource:incident:i1 both receive a room emit; leaving
 *       removes one; a globex user in the SAME room receives room emits yet never
 *       receives an acme TENANT emit (rooms are orthogonal to tenants).
 * Mocks: none; three real SSE clients across two tenants. A far-future reauth
 *        interval keeps the reauth cycle out of the test.
 */

import type { INestApplication } from '@nestjs/common';
import type { EventSource } from 'eventsource';
import request from 'supertest';

import { createApp } from '../../src/main';
import { login, nextEvent, openSse } from '../support/sse.fixture';

interface AddressInfo {
  readonly port: number;
}

const ROOM = 'resource:incident:i1';
const ROOM_EVENT = 'incident.message';
const TENANT_EVENT = 'order.created';
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Collect the payload `seq` of every occurrence of a named event on a client. */
function collect(source: EventSource, eventName: string): number[] {
  const seqs: number[] = [];
  source.addEventListener(eventName, (event: MessageEvent<string>) => {
    seqs.push((JSON.parse(event.data) as { seq: number }).seq);
  });
  return seqs;
}

describe('Rooms (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let anaCookie: string;
  let ana: EventSource;
  let bob: EventSource;
  let gil: EventSource;
  let anaId: string;
  let bobId: string;
  let gilId: string;
  const savedInterval = process.env.REAUTH_INTERVAL_SECONDS;

  beforeAll(async () => {
    process.env.REAUTH_INTERVAL_SECONDS = '3600';
    app = await createApp();
    await app.listen(0);
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;

    anaCookie = await login(app, 'ana@acme');
    const bobCookie = await login(app, 'bob@acme');
    const gilCookie = await login(app, 'gil@globex');

    ana = openSse(`${baseUrl}/api/events`, anaCookie);
    bob = openSse(`${baseUrl}/api/events`, bobCookie);
    gil = openSse(`${baseUrl}/api/events`, gilCookie);
    anaId = (await nextEvent(ana, 'connection:established')).connectionId as string;
    bobId = (await nextEvent(bob, 'connection:established')).connectionId as string;
    gilId = (await nextEvent(gil, 'connection:established')).connectionId as string;

    await Promise.all([
      joinRoom(anaCookie, anaId),
      joinRoom(bobCookie, bobId),
      joinRoom(gilCookie, gilId),
    ]);
  });

  afterAll(async () => {
    ana.close();
    bob.close();
    gil.close();
    await app.close();
    if (savedInterval === undefined) delete process.env.REAUTH_INTERVAL_SECONDS;
    else process.env.REAUTH_INTERVAL_SECONDS = savedInterval;
  });

  /** Join the incident room with the given session cookie and connection id. */
  function joinRoom(cookie: string, connectionId: string): Promise<unknown> {
    return request(app.getHttpServer())
      .post('/api/rooms/join')
      .set('Cookie', cookie)
      .send({ connectionId, resourceType: 'incident', resourceId: 'i1' })
      .expect(200);
  }

  /** Emit an event to the incident room as ana. */
  function emitToRoom(event: string, seq: number): Promise<unknown> {
    return request(app.getHttpServer())
      .post(`/api/emit/room/${ROOM}`)
      .set('Cookie', anaCookie)
      .send({ event, data: { seq } })
      .expect(201);
  }

  /** Resolve once the predicate holds, or reject after the timeout. */
  async function waitUntil(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
    const start = Date.now();
    while (!predicate()) {
      if (Date.now() - start > timeoutMs) throw new Error('condition not met in time');
      await sleep(25);
    }
  }

  /** POST a tenant emit to acme as ana. */
  function emitToTenant(event: string, seq: number): Promise<unknown> {
    return request(app.getHttpServer())
      .post('/api/emit/tenant/acme')
      .set('Cookie', anaCookie)
      .send({ event, data: { seq } })
      .expect(201);
  }

  /**
   * Room delivery, leave, and tenant orthogonality.
   *
   * A room emit reaches every member (both acme users and the globex user); a
   * member that leaves stops receiving; and a tenant emit to acme reaches the acme
   * member but never the globex member, even though it shares the room.
   */
  it('delivers room emits to members while keeping tenant emits isolated', async () => {
    const anaRoom = collect(ana, ROOM_EVENT);
    const bobRoom = collect(bob, ROOM_EVENT);
    const gilRoom = collect(gil, ROOM_EVENT);
    const anaTenant = collect(ana, TENANT_EVENT);
    const gilTenant = collect(gil, TENANT_EVENT);

    // Both acme members and the globex member receive the first room emit.
    await emitToRoom(ROOM_EVENT, 1);
    await waitUntil(() => anaRoom.includes(1) && bobRoom.includes(1) && gilRoom.includes(1));

    // ana cannot move bob's connection (anti-IDOR); bob leaves as itself.
    await request(app.getHttpServer())
      .post('/api/rooms/leave')
      .set('Cookie', anaCookie)
      .send({ connectionId: bobId, resourceType: 'incident', resourceId: 'i1' })
      .expect(403);
    const bobCookie = await login(app, 'bob@acme');
    await request(app.getHttpServer())
      .post('/api/rooms/leave')
      .set('Cookie', bobCookie)
      .send({ connectionId: bobId, resourceType: 'incident', resourceId: 'i1' })
      .expect(200);

    // The next room emit skips bob but still reaches ana and the globex member.
    await emitToRoom(ROOM_EVENT, 2);
    await waitUntil(() => anaRoom.includes(2) && gilRoom.includes(2));
    await sleep(200);
    expect(bobRoom.includes(2)).toBe(false);

    // A tenant emit to acme reaches the acme member but never the globex member,
    // even though the globex member shares the room.
    await emitToTenant(TENANT_EVENT, 3);
    await waitUntil(() => anaTenant.includes(3));
    await sleep(200);
    expect(gilTenant.includes(3)).toBe(false);
  });
});
