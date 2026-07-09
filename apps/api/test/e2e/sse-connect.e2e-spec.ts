/**
 * End-to-end tests for the SSE connection at the configured endpoint.
 *
 * Layer: e2e.
 * Goal: a logged-in client connects at /api/events and receives a client-safe
 *       connection:established event; unauthenticated access is refused; the
 *       endpoint carries credentialed CORS for the configured web origin.
 * Mocks: none; a real Nest app over HTTP with the `eventsource` client.
 */

import type { INestApplication } from '@nestjs/common';

import { createApp } from '../../src/main';
import { login, nextEvent, openSse } from '../support/sse.fixture';

interface AddressInfo {
  readonly port: number;
}

describe('SSE connection (e2e)', () => {
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

  /**
   * First-connection contract.
   *
   * The stream must open at the configured `/api/events` and deliver
   * connection:established carrying exactly { connectionId, traits } where traits
   * are only { userId, tenantId, roles } - proving no metadata or secret leaks to
   * the client.
   */
  it('delivers connection:established with only client-safe traits', async () => {
    const source = openSse(`${baseUrl}/api/events`, cookie);
    try {
      const data = await nextEvent(source, 'connection:established');

      expect(Object.keys(data).sort()).toEqual(['connectionId', 'traits']);
      expect(typeof data.connectionId).toBe('string');
      expect(data.traits).toEqual({ userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] });
      const traits = data.traits as Record<string, unknown>;
      expect(Object.keys(traits).sort()).toEqual(['roles', 'tenantId', 'userId']);
      expect(traits).not.toHaveProperty('metadata');
    } finally {
      source.close();
    }
  });

  /**
   * Unauthenticated rejection.
   *
   * Without a session cookie the SSE endpoint must answer 401, proving auth is
   * enforced on the stream, not just the REST routes.
   */
  it('refuses the stream without a session cookie', async () => {
    const response = await fetch(`${baseUrl}/api/events`);
    await response.body?.cancel();

    expect(response.status).toBe(401);
  });

  /**
   * Credentialed CORS.
   *
   * The endpoint (a plain HTTP GET) must reflect the configured web origin and
   * allow credentials, which is how the browser EventSource sends the cookie.
   */
  it('applies credentialed CORS for the configured web origin', async () => {
    const controller = new AbortController();
    const response = await fetch(`${baseUrl}/api/events`, {
      headers: { cookie, origin: 'http://localhost:3000' },
      signal: controller.signal,
    });

    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
    controller.abort();
  });
});
