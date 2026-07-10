/**
 * End-to-end test for the per-instance cluster fan-out counters route.
 *
 * Layer: e2e.
 * Goal: a single-instance boot exposes the machine-readable fan-out counters the
 *       cluster lab reads; the cross-instance semantics are proven by the
 *       multi-instance cluster suite.
 * Mocks: none; a real Nest application over supertest.
 */

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createApp } from '../../src/main';
import { login } from '../support/sse.fixture';

describe('Cluster stats route (e2e)', () => {
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
   * Counter snapshot shape.
   *
   * The route reports this instance's name and its three numeric counters, with
   * `deliveredLocal` derived as `published + receivedRemote`; the values are the
   * boot defaults on a fresh, single-instance app.
   */
  it('reports the instance fan-out counters', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/labs/cluster/stats')
      .set('Cookie', cookie)
      .expect(200);

    expect(typeof response.body.instance).toBe('string');
    expect(typeof response.body.published).toBe('number');
    expect(typeof response.body.receivedRemote).toBe('number');
    expect(response.body.deliveredLocal).toBe(
      response.body.published + response.body.receivedRemote,
    );
  });
});
