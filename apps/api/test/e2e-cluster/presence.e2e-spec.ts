/**
 * Cluster e2e test for cross-instance presence.
 *
 * Layer: e2e (multi-instance, live compose stack).
 * Goal: a user connected on one instance appears online when the roster is queried
 *       on another instance, and leaves the roster once their last connection closes.
 * Mocks: none; real app-a (3001) and app-b (3002) over HTTP + SSE.
 */

import type { EventSource } from 'eventsource';

import { nextEvent } from '../support/sse.fixture';

import {
  APP_A,
  APP_B,
  clusterLogin,
  openClusterSse,
  pollUntil,
  readPresence,
} from './cluster.fixture';

const TENANT = 'acme';

describe('Cluster presence (e2e)', () => {
  let cookieAna: string;
  let cookieBob: string;

  beforeAll(async () => {
    cookieAna = await clusterLogin(APP_A, 'ana@acme');
    cookieBob = await clusterLogin(APP_B, 'bob@acme');
  });

  /**
   * Cross-instance online visibility.
   *
   * A user connected on app-b must appear in the tenant roster queried on app-a
   * (shared presence storage), and must leave that roster once their connection
   * closes, proving presence is truthful across instances.
   */
  it('shows a user connected on app-b in the roster read from app-a', async () => {
    const connection: EventSource = openClusterSse(`${APP_B}/api/events`, cookieBob);
    try {
      await nextEvent(connection, 'connection:established');

      // The roster read on app-a must include the user connected on app-b.
      await pollUntil(async () =>
        (await readPresence(APP_A, cookieAna, TENANT)).includes('bob@acme'),
      );
      expect(await readPresence(APP_A, cookieAna, TENANT)).toContain('bob@acme');
    } finally {
      connection.close();
    }

    // Once the last connection closes, the user must leave the roster.
    await pollUntil(
      async () => !(await readPresence(APP_A, cookieAna, TENANT)).includes('bob@acme'),
    );
    expect(await readPresence(APP_A, cookieAna, TENANT)).not.toContain('bob@acme');
  });
});
