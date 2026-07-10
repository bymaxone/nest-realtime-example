/**
 * Cluster e2e test for pub/sub degradation and recovery.
 *
 * Layer: e2e (multi-instance, live compose stack).
 * Goal: losing Redis degrades each instance to single-instance mode (health flag
 *       flips, local delivery still works, cross-instance delivery pauses) without
 *       crashing, and restarting Redis restores cross-instance fan-out.
 * Mocks: none; real app-a (3001), app-b (3002) and the Redis container via docker.
 *
 * This spec manipulates the shared Redis container, so it always restores it in a
 * finally block; the cluster suite runs alone, one compose stack at a time.
 */

import type { EventSource } from 'eventsource';

import { collectSeqEvents, nextEvent, waitUntil } from '../support/sse.fixture';

import {
  APP_A,
  APP_B,
  clusterLogin,
  emitToTenant,
  emitToUser,
  openClusterSse,
  pollUntil,
  readHealth,
  sleep,
  startRedis,
  stopRedis,
} from './cluster.fixture';

const TENANT = 'acme';
const LOCAL_EVENT = 'degradation.local';
const CROSS_EVENT = 'degradation.cross';

/** Whether both instances report the given pub/sub health. */
async function bothPubsub(state: 'ok' | 'degraded'): Promise<boolean> {
  const [a, b] = await Promise.all([readHealth(APP_A), readHealth(APP_B)]);
  return a.pubsub === state && b.pubsub === state;
}

describe('Pub/sub degradation (e2e)', () => {
  let cookieAna: string;
  let cookieBob: string;

  beforeAll(async () => {
    cookieAna = await clusterLogin(APP_A, 'ana@acme');
    cookieBob = await clusterLogin(APP_B, 'bob@acme');
  });

  afterAll(async () => {
    // Never leave the shared Redis stopped for any later run.
    await startRedis();
  });

  /**
   * Degrade and recover.
   *
   * With a local client on app-a and a remote client on app-b, stopping Redis must
   * flip both health flags to degraded while local delivery keeps working, and
   * restarting Redis must return both flags to ok and resume cross-instance delivery
   * to the remote client. The apps must never crash through the outage.
   */
  it('degrades to single-instance on redis loss and recovers cross-instance fan-out', async () => {
    expect(await bothPubsub('ok')).toBe(true);

    const local: EventSource = openClusterSse(`${APP_A}/api/events`, cookieAna);
    const remote: EventSource = openClusterSse(`${APP_B}/api/events`, cookieBob);
    try {
      await Promise.all([
        nextEvent(local, 'connection:established'),
        nextEvent(remote, 'connection:established'),
      ]);
      const onLocal = collectSeqEvents(local, LOCAL_EVENT);
      const onRemote = collectSeqEvents(remote, CROSS_EVENT);
      await sleep(300);

      // Outage: both instances must report degraded pub/sub.
      await stopRedis();
      await pollUntil(() => bothPubsub('degraded'), 20000);

      // Local delivery on app-a still reaches its local client during the outage.
      await emitToUser(APP_A, cookieAna, 'ana@acme', LOCAL_EVENT, { seq: 1 });
      await waitUntil(() => onLocal.length >= 1, 8000);
      expect(onLocal.length).toBeGreaterThanOrEqual(1);

      // Recovery: both instances must report ok pub/sub again.
      await startRedis();
      await pollUntil(() => bothPubsub('ok'), 30000);

      // Cross-instance fan-out resumes; re-emit until the subscriber has
      // re-subscribed and the remote client receives the tenant emit.
      await pollUntil(async () => {
        await emitToTenant(APP_A, cookieAna, TENANT, CROSS_EVENT, { seq: 2 });
        await sleep(500);
        return onRemote.length >= 1;
      }, 20000);
      expect(onRemote.length).toBeGreaterThanOrEqual(1);
    } finally {
      local.close();
      remote.close();
      await startRedis();
    }
  }, 90000);
});
