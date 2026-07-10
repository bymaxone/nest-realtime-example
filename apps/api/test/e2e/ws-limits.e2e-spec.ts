/**
 * End-to-end tests for the WebSocket guardrails: payload cap, CORS and error audit.
 *
 * Layer: e2e.
 * Goal: an oversized frame is dropped by Socket.IO (the handler never runs, the
 *       connection closes) and surfaced to the audit as REALTIME_PAYLOAD_TOO_LARGE;
 *       the WebSocket CORS rejects a disallowed origin at the handshake while HTTP
 *       CORS remains governed separately by the Nest config.
 * Mocks: none; real bearer-authenticated socket.io-client connections.
 *
 * Reconciliation: the installed library surfaces no client-facing `error` reserved
 * event for WebSocket transport errors (it wires `hooks.onError` only for SSE), and
 * the example never emits library-reserved event names, so the transport error is
 * asserted on the audit (`hooks.onError`) side rather than as a client `error` event.
 * The CORS origin is a single string, which Socket.IO and Nest both pin as the
 * allow-origin header (browser-enforced) rather than rejecting a foreign origin at
 * the server; the tests assert that pinning, on the two distinct mechanisms (the
 * Socket.IO handshake option and the Nest app-level config).
 */

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { APP_CONFIG } from '../../src/config/config.tokens';
import type { AppConfig } from '../../src/config/env.loader';
import { setEnv } from '../support/env.fixture';
import { login } from '../support/sse.fixture';
import { mintWsToken, openWs } from '../support/ws.fixture';

interface AddressInfo {
  readonly port: number;
}

/** One audit feed entry the error assertions read. */
interface AuditEntry {
  readonly transport?: string;
  readonly extra?: { readonly message?: string };
}

const ROOM_ID = 'resource:incident:i1';
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('WebSocket guardrails (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let namespaceUrl: string;
  let webOrigin: string;
  let anaCookie: string;
  let restoreEnv: () => void;

  beforeAll(async () => {
    restoreEnv = setEnv({
      REALTIME_TRANSPORT: 'websocket',
      REALTIME_WS_MAX_BUFFER_BYTES: '16384',
      REAUTH_INTERVAL_SECONDS: '3600',
    });
    const { createApp } = await import('../../src/main');
    app = await createApp();
    await app.listen(0);
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    const config = app.get<AppConfig>(APP_CONFIG);
    namespaceUrl = `${baseUrl}${config.realtime.wsNamespace}`;
    webOrigin = config.webOrigin;
    anaCookie = await login(app, 'ana@acme');
  });

  afterAll(async () => {
    await app.close();
    restoreEnv();
  });

  /** Read the audit error entries via the authenticated feed. */
  async function errorAudit(): Promise<AuditEntry[]> {
    const response = await request(app.getHttpServer())
      .get('/api/audit/feed?kind=error')
      .set('Cookie', anaCookie);
    return (response.body as { entries: AuditEntry[] }).entries;
  }

  /**
   * Oversized payload dropped and audited.
   *
   * A `chat.message` whose body exceeds `maxHttpBufferSize` must never reach the
   * handler (a co-member receives nothing), and the transport-level drop must be
   * surfaced to the audit feed as a REALTIME_PAYLOAD_TOO_LARGE error over WebSocket.
   */
  it('drops an oversized payload and records REALTIME_PAYLOAD_TOO_LARGE in the audit', async () => {
    const anaToken = await mintWsToken(app, anaCookie);
    const bobCookie = await login(app, 'bob@acme');
    const bobToken = await mintWsToken(app, bobCookie);
    const ana = await openWs(namespaceUrl, anaToken);
    const bob = await openWs(namespaceUrl, bobToken);
    await joinIncident(anaCookie, ana.established.connectionId as string);
    await joinIncident(bobCookie, bob.established.connectionId as string);

    const bobReceived: unknown[] = [];
    bob.socket.on('chat.message', (m: unknown) => bobReceived.push(m));

    ana.socket.emit('chat.message', { roomId: ROOM_ID, body: 'x'.repeat(32000) });
    await pollUntil(async () =>
      (await errorAudit()).some(
        (e) => e.transport === 'websocket' && e.extra?.message === 'REALTIME_PAYLOAD_TOO_LARGE',
      ),
    );

    expect(bobReceived).toHaveLength(0);
    bob.socket.close();
  });

  /**
   * WebSocket CORS is Socket.IO's own option, applied on the handshake.
   *
   * The Socket.IO transport endpoint (`/socket.io/`) is served by the engine, not a
   * Nest route, and carries the allow-origin header from `websocket.cors`. It is
   * restrictive: it echoes only the configured origin and never a foreign one, so a
   * browser page at a foreign origin is refused the handshake.
   */
  it('applies a restrictive websocket cors on the handshake, pinned to the configured origin', async () => {
    const allowed = await request(app.getHttpServer())
      .get('/socket.io/?EIO=4&transport=polling')
      .set('Origin', webOrigin);
    expect(allowed.headers['access-control-allow-origin']).toBe(webOrigin);

    const foreign = await request(app.getHttpServer())
      .get('/socket.io/?EIO=4&transport=polling')
      .set('Origin', 'http://evil.example');
    expect(foreign.headers['access-control-allow-origin']).not.toBe('http://evil.example');
  });

  /**
   * HTTP CORS is governed separately by the Nest app-level config.
   *
   * A plain HTTP route carries the allow-origin header from `app.enableCors`, pinned
   * to the configured web origin, proving HTTP CORS is a distinct mechanism from the
   * Socket.IO handshake CORS even though both derive from the same origin.
   */
  it('governs HTTP cors through the Nest config, pinned to the configured origin', async () => {
    const allowed = await request(app.getHttpServer()).get('/health').set('Origin', webOrigin);
    expect(allowed.status).toBe(200);
    expect(allowed.headers['access-control-allow-origin']).toBe(webOrigin);

    const foreign = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'http://evil.example');
    expect(foreign.headers['access-control-allow-origin']).not.toBe('http://evil.example');
  });

  /** Join the incident room for a connection, authorized by the user's session. */
  function joinIncident(cookie: string, connectionId: string): Promise<unknown> {
    return request(app.getHttpServer())
      .post('/api/rooms/join')
      .set('Cookie', cookie)
      .send({ connectionId, resourceType: 'incident', resourceId: 'i1' })
      .expect(200);
  }

  /** Poll an async predicate until it holds or the deadline passes. */
  async function pollUntil(predicate: () => Promise<boolean>, timeoutMs = 8000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      if (await predicate()) return;
      if (Date.now() > deadline) throw new Error('timed out waiting for condition');
      await sleep(100);
    }
  }
});
