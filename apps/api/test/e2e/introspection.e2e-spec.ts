/**
 * End-to-end test for the realtime wiring introspection route.
 *
 * Layer: e2e.
 * Goal: the admin introspection route reads the library's exported Symbol DI tokens
 *       and reports the wiring the module resolved at boot (transport, scalar SSE
 *       tunables and collaborator class names), while a non-admin session is
 *       forbidden.
 * Mocks: none; a real single-instance Nest application over supertest.
 */

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createApp } from '../../src/main';
import { login } from '../support/sse.fixture';

describe('Realtime introspection route (e2e)', () => {
  let app: INestApplication;
  let adminCookie: string;
  let memberCookie: string;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    adminCookie = await login(app, 'ana@acme');
    memberCookie = await login(app, 'bob@acme');
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * Resolved wiring snapshot.
   *
   * The route reports the transport mode and kind the library selected, a populated
   * SSE block (single-instance boot serves SSE), and the class names of the
   * collaborators the example wired: the composite authenticator and hooks, the
   * in-memory pub/sub default, and the presence storage, which is provisioned on
   * every profile so a single instance still has a roster.
   */
  it('reports the resolved realtime wiring to an admin', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/connections/introspection')
      .set('Cookie', adminCookie)
      .expect(200);

    expect(typeof response.body.instanceId).toBe('string');
    expect(response.body.transport).toBe('sse');
    expect(response.body.transportKind).toBe('sse');
    expect(typeof response.body.sse.endpoint).toBe('string');
    expect(response.body.sse.endpoint.length).toBeGreaterThan(0);
    expect(typeof response.body.sse.heartbeatMs).toBe('number');
    expect(response.body.providers).toEqual({
      authenticator: 'CompositeAuthenticator',
      hooks: 'CompositeLifecycleHooks',
      pubsub: 'InMemoryPubSub',
      presence: 'RedisPresenceStorage',
    });
  });

  /**
   * Admin-only exposure.
   *
   * The snapshot reveals the resolved wiring, so a valid but non-admin session must
   * be rejected with 403; the anonymous-401 guarantee is covered by the route
   * inventory suite.
   */
  it('forbids a non-admin session', async () => {
    await request(app.getHttpServer())
      .get('/api/connections/introspection')
      .set('Cookie', memberCookie)
      .expect(403);
  });
});
