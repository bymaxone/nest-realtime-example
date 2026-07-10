/**
 * End-to-end tests for the audit feed and decorator-stats routes.
 *
 * Layer: e2e.
 * Goal: the feed returns the service identity plus newest-first entries, rejects
 *       an invalid `kind` filter with 400, and the decorator-stats route reports
 *       the lifecycle counters.
 * Mocks: none; a real Nest application over supertest.
 */

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { APP_SERVICE_NAME, APP_VERSION } from '../../src/app.constants';
import { createApp } from '../../src/main';
import { login } from '../support/sse.fixture';

describe('Audit routes (e2e)', () => {
  let app: INestApplication;
  let cookie: string;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    cookie = await login(app, 'ana@acme');
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * Feed identity and shape.
   *
   * The feed wraps its entries with the service name and version so the UI can
   * label which service produced them; entries are an array (empty at boot).
   */
  it('returns the service identity and an entries array', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/audit/feed')
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body.service).toEqual({ name: APP_SERVICE_NAME, version: APP_VERSION });
    expect(Array.isArray(response.body.entries)).toBe(true);
  });

  /**
   * Feed filter validation.
   *
   * A `kind` query that is not a known audit kind must be refused with 400, so a
   * typo can never silently return an unfiltered feed.
   */
  it('rejects an unknown kind filter with 400', async () => {
    await request(app.getHttpServer())
      .get('/api/audit/feed?kind=bogus')
      .set('Cookie', cookie)
      .expect(400);
  });

  /**
   * Decorator lifecycle counters.
   *
   * The decorator-stats route reports the aggregate connect/disconnect counts the
   * `@OnConnect` / `@OnDisconnect` handlers maintain; both are numbers at boot.
   */
  it('reports the decorator connect and disconnect counters', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/audit/decorator-stats')
      .set('Cookie', cookie)
      .expect(200);

    expect(typeof response.body.connects).toBe('number');
    expect(typeof response.body.disconnects).toBe('number');
  });
});
