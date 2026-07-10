/**
 * End-to-end tests for the split-screen composite fan-out proof.
 *
 * Layer: e2e.
 * Goal: one user, connected simultaneously over SSE and WebSocket under the 'both'
 *       profile (the migration split-screen: one tab still on SSE, one tab already
 *       on WS), receives a single tenant emit, a single user emit and a single room
 *       emit exactly once on EACH transport, never twice and never on the wrong
 *       transport. This is the composite fan-out contract row 50 of the coverage
 *       matrix names: one `emitToTenant`/`emitToUser`/`emitToRoom` call, two
 *       transports, zero duplicates.
 * Mocks: none; a real Nest app in 'both' mode with one `eventsource` client and one
 *        `socket.io-client`, both authenticated as the same user.
 */

import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import type { EventSource } from 'eventsource';
import request from 'supertest';
import type { Socket } from 'socket.io-client';

import { APP_CONFIG } from '../../src/config/config.tokens';
import type { AppConfig } from '../../src/config/env.loader';
import { setEnv } from '../support/env.fixture';
import { login, nextEvent, openSse, waitUntil } from '../support/sse.fixture';
import { mintWsToken, openWs } from '../support/ws.fixture';

interface AddressInfo {
  readonly port: number;
}

/** The event name every fan-out emit in this suite carries. */
const EVENT = 'board.update';
/** The incident room both connections join to prove room-scope fan-out too. */
const ROOM_ID = 'resource:incident:split-screen';
/** Grace window after the expected deliveries to catch a stray duplicate. */
const SETTLE_MS = 200;
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('Both-mode split-screen fan-out (e2e)', () => {
  let app: INestApplication;
  let cookie: string;
  let sseSource: EventSource;
  let wsSocket: Socket;
  let sseNonces: string[];
  let wsNonces: string[];
  let restoreEnv: () => void;

  beforeAll(async () => {
    restoreEnv = setEnv({ REALTIME_TRANSPORT: 'both', REAUTH_INTERVAL_SECONDS: '3600' });
    const { createApp } = await import('../../src/main');
    app = await createApp();
    await app.listen(0);
    const address = app.getHttpServer().address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const config = app.get<AppConfig>(APP_CONFIG);
    const namespaceUrl = `${baseUrl}${config.realtime.wsNamespace}`;

    cookie = await login(app, 'ana@acme');
    const token = await mintWsToken(app, cookie);

    sseNonces = [];
    wsNonces = [];

    sseSource = openSse(`${baseUrl}/api/events`, cookie);
    const sseEstablished = await nextEvent(sseSource, 'connection:established');
    sseSource.addEventListener(EVENT, (message: MessageEvent<string>) => {
      sseNonces.push((JSON.parse(message.data) as { nonce: string }).nonce);
    });

    const { socket, established: wsEstablished } = await openWs(namespaceUrl, token);
    wsSocket = socket;
    wsSocket.on(EVENT, (data: { nonce: string }) => {
      wsNonces.push(data.nonce);
    });

    await Promise.all([
      joinRoom(sseEstablished.connectionId as string),
      joinRoom(wsEstablished.connectionId as string),
    ]);
  });

  afterAll(async () => {
    sseSource.close();
    wsSocket.close();
    await app.close();
    restoreEnv();
  });

  /**
   * Tenant-scope fan-out.
   *
   * A single `POST /emit/tenant/acme` must land exactly once on the SSE
   * connection and exactly once on the WebSocket connection, proving one library
   * emit call reaches both transports without duplicating on either.
   */
  it('delivers a tenant emit exactly once on SSE and exactly once on WebSocket', async () => {
    const nonce = randomUUID();
    await emitTenant(nonce);
    await waitUntil(() => sseNonces.includes(nonce) && wsNonces.includes(nonce));
    await sleep(SETTLE_MS);
    expect(sseNonces.filter((value) => value === nonce)).toHaveLength(1);
    expect(wsNonces.filter((value) => value === nonce)).toHaveLength(1);
  });

  /**
   * User-scope fan-out.
   *
   * A single `POST /emit/user/ana@acme` must reach both of the user's own
   * connections, one per transport, exactly once each, proving user-scope emits
   * are transport-blind under the composite profile.
   */
  it('delivers a user emit exactly once on SSE and exactly once on WebSocket', async () => {
    const nonce = randomUUID();
    await emitUser(nonce);
    await waitUntil(() => sseNonces.includes(nonce) && wsNonces.includes(nonce));
    await sleep(SETTLE_MS);
    expect(sseNonces.filter((value) => value === nonce)).toHaveLength(1);
    expect(wsNonces.filter((value) => value === nonce)).toHaveLength(1);
  });

  /**
   * Room-scope fan-out.
   *
   * Both connections joined the same resource room in `beforeAll`; a single
   * `POST /emit/room/...` must reach each of them exactly once, proving room
   * membership fans out across transports identically to tenant and user scope.
   */
  it('delivers a room emit exactly once on SSE and exactly once on WebSocket', async () => {
    const nonce = randomUUID();
    await emitRoom(nonce);
    await waitUntil(() => sseNonces.includes(nonce) && wsNonces.includes(nonce));
    await sleep(SETTLE_MS);
    expect(sseNonces.filter((value) => value === nonce)).toHaveLength(1);
    expect(wsNonces.filter((value) => value === nonce)).toHaveLength(1);
  });

  /** Join a connection to the split-screen incident room as its owner. */
  function joinRoom(connectionId: string): Promise<unknown> {
    return request(app.getHttpServer())
      .post('/api/rooms/join')
      .set('Cookie', cookie)
      .send({ connectionId, resourceType: 'incident', resourceId: 'split-screen' })
      .expect(200);
  }

  /** POST a tenant emit to acme carrying the given dedup nonce. */
  function emitTenant(nonce: string): Promise<unknown> {
    return request(app.getHttpServer())
      .post('/api/emit/tenant/acme')
      .set('Cookie', cookie)
      .send({ event: EVENT, data: { nonce } })
      .expect(201);
  }

  /** POST a user emit to ana@acme carrying the given dedup nonce. */
  function emitUser(nonce: string): Promise<unknown> {
    return request(app.getHttpServer())
      .post(`/api/emit/user/${encodeURIComponent('ana@acme')}`)
      .set('Cookie', cookie)
      .send({ event: EVENT, data: { nonce } })
      .expect(201);
  }

  /** POST a room emit to the split-screen incident room carrying the dedup nonce. */
  function emitRoom(nonce: string): Promise<unknown> {
    return request(app.getHttpServer())
      .post(`/api/emit/room/${ROOM_ID}`)
      .set('Cookie', cookie)
      .send({ event: EVENT, data: { nonce } })
      .expect(201);
  }
});
