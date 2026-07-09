/**
 * End-to-end tests for the application bootstrap.
 *
 * Layer: e2e.
 * Goal: createApp() boots a working app whose liveness probe reports config.
 * Mocks: none; a real Nest application over the default HTTP adapter.
 */

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { APP_VERSION } from '../../src/app.constants';
import { createApp } from '../../src/main';

describe('Application bootstrap (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * Liveness contract.
   *
   * The excluded-from-prefix `/health` route must answer 200 with the config
   * defaults, proving createApp wired config, controllers and the prefix policy.
   */
  it('serves GET /health with the configured metadata', async () => {
    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      instance: 'app-a',
      transport: 'sse',
      version: APP_VERSION,
    });
  });

  /**
   * Prefix-exclusion guard.
   *
   * Health is deliberately kept off the `api` prefix, so the prefixed path must
   * not resolve; this pins the exclusion so a future prefix change is caught.
   */
  it('does not serve health under the api prefix', async () => {
    const response = await request(app.getHttpServer()).get('/api/health');

    expect(response.status).toBe(404);
  });
});
