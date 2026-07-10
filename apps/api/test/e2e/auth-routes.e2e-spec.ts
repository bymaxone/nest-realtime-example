/**
 * End-to-end tests for the demo authentication routes.
 *
 * Layer: e2e.
 * Goal: login issues a session cookie and echoes client-safe traits, rejects an
 *       unknown user and a malformed body; logout clears the cookie; `/me` and
 *       `/ws-token` answer for an authenticated caller.
 * Mocks: none; a real Nest application over supertest.
 */

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createApp } from '../../src/main';
import { login } from '../support/sse.fixture';

/** Extract the session cookie header from a login response's `set-cookie`. */
function sessionCookie(setCookie: string | string[] | undefined): string {
  const first = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return (first ?? '').split(';')[0] ?? '';
}

describe('Auth routes (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * Login happy path.
   *
   * A known demo username returns the client-safe traits (never the raw token)
   * and sets the signed HttpOnly session cookie the rest of the API relies on.
   */
  it('logs in a demo user, setting the session cookie and returning traits', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'ana@acme' })
      .expect(201);

    expect(response.body).toEqual({ userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] });
    expect(sessionCookie(response.headers['set-cookie'])).toContain('session=');
  });

  /**
   * Login credential rejection.
   *
   * A syntactically valid but unknown username must fail authentication with 401,
   * proving the endpoint checks the identity against the demo directory.
   */
  it('rejects an unknown demo user with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'nobody@nowhere' })
      .expect(401);
  });

  /**
   * Login body validation.
   *
   * A missing username violates the login schema, so the ZodValidationPipe must
   * reject the request with 400 before any credential lookup.
   */
  it('rejects a login with no username with 400', async () => {
    await request(app.getHttpServer()).post('/api/auth/login').send({}).expect(400);
  });

  /**
   * Logout clears the session.
   *
   * Logout always succeeds and instructs the browser to drop the session cookie,
   * so a later request carries no credential.
   */
  it('clears the session cookie on logout', async () => {
    const response = await request(app.getHttpServer()).post('/api/auth/logout').expect(201);

    expect(response.body).toEqual({ ok: true });
    const cleared = response.headers['set-cookie'];
    const header = Array.isArray(cleared) ? cleared[0] : cleared;
    expect(header ?? '').toContain('session=');
  });

  /**
   * Identity echo for an authenticated caller.
   *
   * `/me` returns exactly the guard-resolved client-safe traits, the contract the
   * web app reads to learn who it is signed in as.
   */
  it('returns the current traits from /me for a logged-in caller', async () => {
    const cookie = await login(app, 'gil@globex');

    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body).toEqual({ userId: 'gil@globex', tenantId: 'globex', roles: ['admin'] });
  });

  /**
   * WebSocket bearer mint.
   *
   * An authenticated caller receives a signed bearer and its absolute expiry, the
   * token a Socket.IO handshake places in `auth.token`.
   */
  it('mints a WebSocket bearer for a logged-in caller', async () => {
    const cookie = await login(app, 'ana@acme');

    const response = await request(app.getHttpServer())
      .post('/api/auth/ws-token')
      .set('Cookie', cookie)
      .expect(201);

    expect(typeof response.body.token).toBe('string');
    expect((response.body.token as string).length).toBeGreaterThan(0);
    expect(typeof response.body.expiresAt).toBe('string');
  });
});
