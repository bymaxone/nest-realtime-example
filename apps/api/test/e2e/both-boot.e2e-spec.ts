/**
 * End-to-end tests for the 'both' composite boot profile.
 *
 * Layer: e2e.
 * Goal: booting REALTIME_TRANSPORT=both serves the SSE endpoint and the WebSocket
 *       namespace from the same process; the liveness probe reports the composite
 *       transport; a cookie-authenticated SSE client and a bearer-authenticated WS
 *       client both reach connection:established concurrently against one `app`.
 * Mocks: none; a real Nest app with an `eventsource` client and a `socket.io-client`.
 */

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { APP_VERSION } from '../../src/app.constants';
import { APP_CONFIG } from '../../src/config/config.tokens';
import type { AppConfig } from '../../src/config/env.loader';
import { setEnv } from '../support/env.fixture';
import { login, nextEvent, openSse } from '../support/sse.fixture';
import { mintWsToken, openWs } from '../support/ws.fixture';

interface AddressInfo {
  readonly port: number;
}

describe('Both-mode composite boot (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let namespaceUrl: string;
  let restoreEnv: () => void;

  beforeAll(async () => {
    restoreEnv = setEnv({ REALTIME_TRANSPORT: 'both' });
    const { createApp } = await import('../../src/main');
    app = await createApp();
    await app.listen(0);
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
    const config = app.get<AppConfig>(APP_CONFIG);
    namespaceUrl = `${baseUrl}${config.realtime.wsNamespace}`;
  });

  afterAll(async () => {
    await app.close();
    restoreEnv();
  });

  /**
   * Liveness contract under the composite profile.
   *
   * `GET /health` must report `transport: 'both'`, so operators and the cluster
   * labs can tell a composite instance apart from an SSE-only or WS-only one.
   */
  it('reports transport: both on the liveness probe', async () => {
    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      instance: 'app-a',
      transport: 'both',
      version: APP_VERSION,
      pubsub: 'ok',
    });
  });

  /**
   * Double boot, one process.
   *
   * A cookie-authenticated SSE client and a bearer-authenticated WebSocket client
   * both reach `connection:established` against the SAME running `app`, proving
   * the composite profile serves both endpoints concurrently rather than picking
   * one transport at boot time. The two connection ids differ, confirming each
   * client is a distinct, independently tracked connection.
   */
  it('accepts a cookie SSE connection and a bearer WebSocket connection concurrently', async () => {
    const cookie = await login(app, 'ana@acme');
    const token = await mintWsToken(app, cookie);

    const source = openSse(`${baseUrl}/api/events`, cookie);
    try {
      const [sseEstablished, wsResult] = await Promise.all([
        nextEvent(source, 'connection:established'),
        openWs(namespaceUrl, token),
      ]);
      try {
        expect(typeof sseEstablished.connectionId).toBe('string');
        expect(typeof wsResult.established.connectionId).toBe('string');
        expect(sseEstablished.connectionId).not.toBe(wsResult.established.connectionId);
      } finally {
        wsResult.socket.close();
      }
    } finally {
      source.close();
    }
  });
});
