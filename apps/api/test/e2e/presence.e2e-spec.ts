/**
 * End-to-end tests for the tenant presence roster route.
 *
 * Layer: e2e.
 * Goal: a caller reads its own tenant's roster (an array of online user ids) but
 *       is forbidden from reading another tenant's roster (anti-IDOR).
 * Mocks: none; a real Nest application over supertest.
 */

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createApp } from '../../src/main';
import { login } from '../support/sse.fixture';

describe('Presence roster (e2e)', () => {
  let app: INestApplication;
  let anaCookie: string;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    anaCookie = await login(app, 'ana@acme');
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * Own-tenant roster read.
   *
   * A caller may read the online roster of its own tenant; with no live SSE
   * connection the roster is simply empty, and the response names the tenant.
   */
  it("returns the caller's own tenant roster as an array", async () => {
    const response = await request(app.getHttpServer())
      .get('/api/presence/acme')
      .set('Cookie', anaCookie)
      .expect(200);

    expect(response.body.tenantId).toBe('acme');
    expect(Array.isArray(response.body.online)).toBe(true);
  });

  /**
   * Cross-tenant roster is forbidden.
   *
   * A session may never enumerate who is online in another tenant, so reading a
   * foreign tenant's roster is refused with 403 (anti-IDOR).
   */
  it('forbids reading another tenant roster with 403', async () => {
    await request(app.getHttpServer())
      .get('/api/presence/globex')
      .set('Cookie', anaCookie)
      .expect(403);
  });
});
