/**
 * End-to-end tests for the WebSocket connection at the configured namespace.
 *
 * Layer: e2e.
 * Goal: booting the websocket profile, a logged-in client mints a bearer, connects
 *       to the config-driven namespace with `auth.token`, and receives a
 *       client-safe connection:established; a missing token and a wrong namespace
 *       are both refused. The bearer is a credential and is never asserted on.
 * Mocks: none; a real Nest app over HTTP with the `socket.io-client` client.
 */

import type { INestApplication } from '@nestjs/common';

import { APP_CONFIG } from '../../src/config/config.tokens';
import type { AppConfig } from '../../src/config/env.loader';
import { setEnv } from '../support/env.fixture';
import { login } from '../support/sse.fixture';
import { awaitWsRejection, mintWsToken, openWs } from '../support/ws.fixture';

interface AddressInfo {
  readonly port: number;
}

describe('WebSocket connection (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let namespaceUrl: string;
  let cookie: string;
  let token: string;
  let restoreEnv: () => void;

  beforeAll(async () => {
    restoreEnv = setEnv({ REALTIME_TRANSPORT: 'websocket' });
    const { createApp } = await import('../../src/main');
    app = await createApp();
    await app.listen(0);
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
    const config = app.get<AppConfig>(APP_CONFIG);
    namespaceUrl = `${baseUrl}${config.realtime.wsNamespace}`;
    cookie = await login(app, 'ana@acme');
    token = await mintWsToken(app, cookie);
  });

  afterAll(async () => {
    await app.close();
    restoreEnv();
  });

  /**
   * First-connection contract over WebSocket.
   *
   * A bearer-authenticated handshake to the configured namespace must deliver
   * connection:established carrying exactly { connectionId, traits } where traits
   * are only { userId, tenantId, roles }, the identical client-safe shape the SSE
   * transport delivers, proving no metadata or secret leaks over either transport.
   */
  it('delivers connection:established with only client-safe traits', async () => {
    const { socket, established } = await openWs(namespaceUrl, token);
    try {
      expect(Object.keys(established).sort()).toEqual(['connectionId', 'traits']);
      expect(typeof established.connectionId).toBe('string');
      expect(established.traits).toEqual({
        userId: 'ana@acme',
        tenantId: 'acme',
        roles: ['admin'],
      });
      const traits = established.traits as Record<string, unknown>;
      expect(Object.keys(traits).sort()).toEqual(['roles', 'tenantId', 'userId']);
      expect(traits).not.toHaveProperty('metadata');
    } finally {
      socket.close();
    }
  });

  /**
   * Missing-credential rejection.
   *
   * A handshake without a bearer token must be refused (the gateway disconnects
   * the socket), proving auth is enforced on the WebSocket handshake, not only on
   * the REST routes.
   */
  it('refuses a handshake with no bearer token', async () => {
    const reason = await awaitWsRejection(namespaceUrl, undefined);

    expect(reason).toContain('disconnect');
  });

  /**
   * Wrong-namespace rejection.
   *
   * Connecting to a namespace the gateway is not bound to must fail with an
   * "Invalid namespace" connect error, proving the namespace is config-driven and
   * only the configured one serves clients.
   */
  it('refuses a connection to a namespace other than the configured one', async () => {
    const reason = await awaitWsRejection(`${baseUrl}/not-live`, token);

    expect(reason).toContain('Invalid namespace');
  });
});
