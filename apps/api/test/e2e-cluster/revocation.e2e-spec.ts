/**
 * Cluster e2e test for cross-instance connection revocation.
 *
 * Layer: e2e (multi-instance, live compose stack).
 * Goal: a kill switch invoked on one instance closes a connection owned on another
 *       (via the library's `op:'disconnect'` fan-out), and stays anti-IDOR
 *       cluster-wide.
 * Mocks: none; real app-a (3001) and app-b (3002) over HTTP + SSE.
 */

import type { EventSource } from 'eventsource';

import { nextEvent, waitForClose } from '../support/sse.fixture';

import {
  APP_A,
  APP_B,
  clusterLogin,
  disconnectConnection,
  openClusterSse,
  pollUntil,
  readPresence,
} from './cluster.fixture';

const TENANT = 'acme';

describe('Cross-instance revocation (e2e)', () => {
  let cookieAna: string;
  let cookieBob: string;

  beforeAll(async () => {
    cookieAna = await clusterLogin(APP_A, 'ana@acme');
    cookieBob = await clusterLogin(APP_B, 'bob@acme');
  });

  /**
   * Cross-instance kill switch.
   *
   * Bob connects on app-b; invoking the disconnect on app-a must close that stream,
   * proving the revocation crosses instances over the pub/sub `op:'disconnect'` path.
   */
  it('closes a connection owned on app-b when revoked via app-a', async () => {
    const connection: EventSource = openClusterSse(`${APP_B}/api/events`, cookieBob);
    const established = await nextEvent(connection, 'connection:established');
    const connectionId = established['connectionId'] as string;

    // The owner index must know the connection before app-a can authorize the kill.
    await pollUntil(async () =>
      (await readPresence(APP_B, cookieBob, TENANT)).includes('bob@acme'),
    );

    const closed = waitForClose(connection, 8000);
    const response = await disconnectConnection(APP_A, cookieBob, connectionId);
    expect(response.status).toBe(200);

    // The far instance closes the stream (waitForClose also closes the client).
    await closed;
  });

  /**
   * Cross-instance anti-IDOR.
   *
   * Another user must not revoke bob's connection: app-a cannot confirm ana owns
   * bob's connection id, so the kill switch 404s and the stream stays open.
   */
  it('refuses a cross-instance disconnect of a connection the caller does not own', async () => {
    const connection: EventSource = openClusterSse(`${APP_B}/api/events`, cookieBob);
    try {
      const established = await nextEvent(connection, 'connection:established');
      const connectionId = established['connectionId'] as string;
      await pollUntil(async () =>
        (await readPresence(APP_B, cookieBob, TENANT)).includes('bob@acme'),
      );

      const response = await disconnectConnection(APP_A, cookieAna, connectionId);
      expect(response.status).toBe(404);
    } finally {
      connection.close();
    }
  });
});
