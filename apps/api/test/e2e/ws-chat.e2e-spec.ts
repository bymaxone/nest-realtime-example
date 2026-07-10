/**
 * End-to-end tests for the incident chat over WebSocket.
 *
 * Layer: e2e.
 * Goal: two clients joined to an incident room exchange chat messages while a third
 *       client outside the room receives nothing, the fanned-out message carries the
 *       authenticated sender identity, and a malformed payload is dropped without
 *       killing the gateway.
 * Mocks: none; three real bearer-authenticated socket.io-client connections.
 */

import type { INestApplication } from '@nestjs/common';
import type { Socket } from 'socket.io-client';
import request from 'supertest';

import { APP_CONFIG } from '../../src/config/config.tokens';
import type { AppConfig } from '../../src/config/env.loader';
import { setEnv } from '../support/env.fixture';
import { login } from '../support/sse.fixture';
import { mintWsToken, openWs } from '../support/ws.fixture';

interface AddressInfo {
  readonly port: number;
}

const ROOM_ID = 'resource:incident:i1';
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** A connected member: its authenticated socket and server connection id. */
interface Member {
  readonly socket: Socket;
  readonly connectionId: string;
}

describe('Incident chat over WebSocket (e2e)', () => {
  let app: INestApplication;
  let namespaceUrl: string;
  let ana: Member;
  let bob: Member;
  let gil: Member;
  let restoreEnv: () => void;

  beforeAll(async () => {
    restoreEnv = setEnv({ REALTIME_TRANSPORT: 'websocket', REAUTH_INTERVAL_SECONDS: '3600' });
    const { createApp } = await import('../../src/main');
    app = await createApp();
    await app.listen(0);
    const port = (app.getHttpServer().address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}`;
    namespaceUrl = `${baseUrl}${app.get<AppConfig>(APP_CONFIG).realtime.wsNamespace}`;

    ana = await connect('ana@acme');
    bob = await connect('bob@acme');
    gil = await connect('gil@globex');

    // ana and bob join the incident room; gil deliberately does not.
    await joinIncident('ana@acme', ana.connectionId);
    await joinIncident('bob@acme', bob.connectionId);
  });

  afterAll(async () => {
    ana.socket.close();
    bob.socket.close();
    gil.socket.close();
    await app.close();
    restoreEnv();
  });

  /** Log a user in, mint a bearer, and open an authenticated WebSocket. */
  async function connect(username: string): Promise<Member> {
    const cookie = await login(app, username);
    const token = await mintWsToken(app, cookie);
    const { socket, established } = await openWs(namespaceUrl, token);
    return { socket, connectionId: established.connectionId as string };
  }

  /** Join the incident room for a connection, authorized by the user's session. */
  function joinIncident(username: string, connectionId: string): Promise<unknown> {
    return login(app, username).then((cookie) =>
      request(app.getHttpServer())
        .post('/api/rooms/join')
        .set('Cookie', cookie)
        .send({ connectionId, resourceType: 'incident', resourceId: 'i1' })
        .expect(200),
    );
  }

  /** Collect every `chat.message` payload a socket receives. */
  function collect(socket: Socket): Array<Record<string, unknown>> {
    const received: Array<Record<string, unknown>> = [];
    socket.on('chat.message', (m: Record<string, unknown>) => received.push(m));
    return received;
  }

  /**
   * Room-scoped fan-out with the authenticated sender identity.
   *
   * A message from ana must reach bob (a room member) exactly once carrying ana's
   * authenticated identity (not any client-supplied value), and must never reach
   * gil, who never joined the room, proving room isolation holds over WebSocket.
   */
  it('fans a member message to the room while excluding a non-member', async () => {
    const bobReceived = collect(bob.socket);
    const gilReceived = collect(gil.socket);

    ana.socket.emit('chat.message', { roomId: ROOM_ID, body: 'incident update', from: 'spoofed' });
    await sleep(400);

    expect(bobReceived).toHaveLength(1);
    expect(bobReceived[0]).toMatchObject({
      roomId: ROOM_ID,
      from: 'ana@acme',
      tenantId: 'acme',
      body: 'incident update',
    });
    expect(typeof bobReceived[0]?.['at']).toBe('string');
    expect(gilReceived).toHaveLength(0);
  });

  /**
   * Malformed payload is survivable.
   *
   * A malformed `chat.message` must be dropped without delivery and without killing
   * the gateway, so a following well-formed message from the same client is still
   * fanned out.
   */
  it('drops a malformed message yet keeps serving the next valid one', async () => {
    const bobReceived = collect(bob.socket);

    ana.socket.emit('chat.message', { roomId: 'tenant:acme', body: 'not allowed' });
    ana.socket.emit('chat.message', { roomId: ROOM_ID, body: 'still working' });
    await sleep(400);

    expect(bobReceived).toHaveLength(1);
    expect(bobReceived[0]).toMatchObject({ body: 'still working', from: 'ana@acme' });
  });
});
