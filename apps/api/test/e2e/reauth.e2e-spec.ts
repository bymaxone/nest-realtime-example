/**
 * End-to-end tests for the reauthentication lab (both failure modes).
 *
 * Layer: e2e.
 * Goal: after an admin revokes a user, the next reauth cycle either closes the
 *       stream silently ('disconnect' mode) or first delivers
 *       connection:reauthentication-failed ('event' mode); the audit feed records
 *       the failure.
 * Mocks: none; a real Nest app over HTTP with a live Redis revocation set. A short
 *        1s reauth interval and a disabled positive cache make the effect prompt.
 */

import type { INestApplication } from '@nestjs/common';
import type { EventSource } from 'eventsource';
import request from 'supertest';

import { createApp } from '../../src/main';
import { login, nextEvent, openSse, waitForClose } from '../support/sse.fixture';

interface AddressInfo {
  readonly port: number;
}

const USER = 'ana@acme';

/** Resolve once the predicate holds, or reject after the timeout. */
async function waitUntil(predicate: () => Promise<boolean>, timeoutMs = 6000): Promise<void> {
  const start = Date.now();
  while (!(await predicate())) {
    if (Date.now() - start > timeoutMs) throw new Error('condition not met in time');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/** Set the reauth env for a boot and return a restore function. */
function withReauthEnv(onFailure: 'disconnect' | 'event'): () => void {
  const keys = ['REAUTH_INTERVAL_SECONDS', 'REAUTH_ON_FAILURE', 'REAUTH_CACHE_TTL_MS'] as const;
  const saved = keys.map((key) => [key, process.env[key]] as const);
  process.env.REAUTH_INTERVAL_SECONDS = '1';
  process.env.REAUTH_ON_FAILURE = onFailure;
  process.env.REAUTH_CACHE_TTL_MS = '0';
  return () => {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

describe('Reauthentication lab (e2e)', () => {
  describe("'disconnect' mode", () => {
    let app: INestApplication;
    let baseUrl: string;
    let cookie: string;
    let restoreEnv: () => void;

    beforeAll(async () => {
      restoreEnv = withReauthEnv('disconnect');
      app = await createApp();
      await app.listen(0);
      baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
      cookie = await login(app, USER);
    });

    afterAll(async () => {
      await request(app.getHttpServer()).delete(`/api/auth/revoke/${USER}`).set('Cookie', cookie);
      await app.close();
      restoreEnv();
    });

    /**
     * Revocation closes the stream.
     *
     * With a valid session the stream stays open; once the user is revoked the next
     * reauth cycle must close it (no reason event in 'disconnect' mode), and the
     * failure must land in the audit feed.
     */
    it('closes a revoked stream and records reauth-failed', async () => {
      await request(app.getHttpServer())
        .delete(`/api/auth/revoke/${USER}`)
        .set('Cookie', cookie)
        .expect(200);
      const source = openSse(`${baseUrl}/api/events`, cookie);
      await nextEvent(source, 'connection:established');

      const closed = waitForClose(source, 8000);
      await request(app.getHttpServer())
        .post(`/api/auth/revoke/${USER}`)
        .set('Cookie', cookie)
        .expect(201);
      await closed;

      await waitUntil(async () => {
        const feed = await request(app.getHttpServer())
          .get('/api/audit/feed?kind=reauth-failed')
          .set('Cookie', cookie);
        const entries = (feed.body as { entries: { userId?: string }[] }).entries;
        return entries.some((entry) => entry.userId === USER);
      });
    });
  });

  describe("'event' mode", () => {
    let app: INestApplication;
    let baseUrl: string;
    let cookie: string;
    let restoreEnv: () => void;

    beforeAll(async () => {
      restoreEnv = withReauthEnv('event');
      app = await createApp();
      await app.listen(0);
      baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
      cookie = await login(app, USER);
    });

    afterAll(async () => {
      await request(app.getHttpServer()).delete(`/api/auth/revoke/${USER}`).set('Cookie', cookie);
      await app.close();
      restoreEnv();
    });

    /**
     * Reason delivered before close.
     *
     * In 'event' mode the client must receive connection:reauthentication-failed
     * carrying a reason before the stream is torn down, so a UI can explain why the
     * session ended.
     */
    it('delivers connection:reauthentication-failed with a reason', async () => {
      await request(app.getHttpServer())
        .delete(`/api/auth/revoke/${USER}`)
        .set('Cookie', cookie)
        .expect(200);
      let source: EventSource | undefined;
      try {
        source = openSse(`${baseUrl}/api/events`, cookie);
        await nextEvent(source, 'connection:established');

        const failed = nextEvent(source, 'connection:reauthentication-failed', 8000);
        await request(app.getHttpServer())
          .post(`/api/auth/revoke/${USER}`)
          .set('Cookie', cookie)
          .expect(201);
        const payload = await failed;

        expect(typeof payload.reason).toBe('string');
      } finally {
        source?.close();
      }
    });
  });
});
