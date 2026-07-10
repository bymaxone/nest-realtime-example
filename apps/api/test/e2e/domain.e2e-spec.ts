/**
 * End-to-end tests for the domain simulator routes.
 *
 * Layer: e2e.
 * Goal: each simulator burst runs for the caller's own tenant and acknowledges
 *       the named sequence.
 * Mocks: none; a real Nest application over supertest.
 */

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createApp } from '../../src/main';
import { login } from '../support/sse.fixture';

describe('Domain simulator routes (e2e)', () => {
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
   * Orders burst acknowledgement.
   *
   * The orders simulator drives a realistic order lifecycle to the caller's tenant
   * and acknowledges the sequence it ran.
   */
  it('simulates an orders burst for the caller tenant', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/domain/orders/simulate')
      .set('Cookie', cookie)
      .expect(201);

    expect(response.body).toEqual({ simulated: 'orders' });
  });

  /**
   * Deployments burst acknowledgement.
   *
   * The deployments simulator drives a deployment lifecycle to the caller's tenant
   * and acknowledges the sequence it ran.
   */
  it('simulates a deployments burst for the caller tenant', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/domain/deployments/simulate')
      .set('Cookie', cookie)
      .expect(201);

    expect(response.body).toEqual({ simulated: 'deployments' });
  });
});
