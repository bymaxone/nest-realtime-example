/**
 * Cluster e2e tests for cross-instance fan-out and loop prevention.
 *
 * Layer: e2e (multi-instance, live compose stack).
 * Goal: one tenant emit reaches every client cluster-wide exactly once, the origin
 *       instance publishes exactly once, each peer receives exactly once, and a
 *       settle window shows no counter drift (no re-publish storm). The same holds
 *       through the nginx front door.
 * Mocks: none; real app-a (3001), app-b (3002) and nginx (8080) over HTTP + SSE.
 */

import type { EventSource } from 'eventsource';

import type { ClusterStats } from '../../src/connections/cluster-stats.service';
import { collectSeqEvents, nextEvent, waitUntil } from '../support/sse.fixture';

import {
  APP_A,
  APP_B,
  NGINX,
  clusterLogin,
  emitToTenant,
  openClusterSse,
  readStats,
  sleep,
} from './cluster.fixture';

const TENANT = 'acme';
const EVENT = 'order.created';
const SETTLE_MS = 5000;

/** Snapshot both instances' counters through their direct ports. */
async function bothStats(cookie: string): Promise<{ a: ClusterStats; b: ClusterStats }> {
  const [a, b] = await Promise.all([readStats(APP_A, cookie), readStats(APP_B, cookie)]);
  return { a, b };
}

describe('Cluster fan-out (e2e)', () => {
  let cookieAna: string;
  let cookieBob: string;

  beforeAll(async () => {
    // Two members of the same tenant; the cookie is portable across instances.
    cookieAna = await clusterLogin(APP_A, 'ana@acme');
    cookieBob = await clusterLogin(APP_B, 'bob@acme');
  });

  /**
   * Exactly-once fan-out with no storm, connected directly to each instance.
   *
   * With X on app-a and Y on app-b in one tenant, a single tenant emit on app-a
   * must reach X and Y exactly once each. app-a must show one publish and no remote
   * receive (its own echo is self-filtered), app-b must show one remote receive and
   * no publish, and a 5s settle window must add nothing, proving a remote delivery
   * is never re-published.
   */
  it('delivers one tenant emit exactly once per client with no counter drift', async () => {
    const before = await bothStats(cookieAna);
    const x: EventSource = openClusterSse(`${APP_A}/api/events`, cookieAna);
    const y: EventSource = openClusterSse(`${APP_B}/api/events`, cookieBob);
    try {
      // Attach both established waiters before awaiting either: the two instances
      // emit `connection:established` concurrently, so a listener added only after
      // the first resolves would miss the second.
      const established = Promise.all([
        nextEvent(x, 'connection:established'),
        nextEvent(y, 'connection:established'),
      ]);
      const onX = collectSeqEvents(x, EVENT);
      const onY = collectSeqEvents(y, EVENT);
      await established;
      // Let both tenant-room memberships settle before emitting.
      await sleep(300);

      await emitToTenant(APP_A, cookieAna, TENANT, EVENT, { seq: 1 });
      await waitUntil(() => onX.length >= 1 && onY.length >= 1, 8000);
      await sleep(300);

      // Each client received exactly one copy.
      expect(onX).toHaveLength(1);
      expect(onY).toHaveLength(1);

      const after = await bothStats(cookieAna);
      // Origin app-a: one publish, no remote receive (own echo self-filtered).
      expect(after.a.published - before.a.published).toBe(1);
      expect(after.a.receivedRemote - before.a.receivedRemote).toBe(0);
      // Peer app-b: one remote receive, no publish (no re-publish loop).
      expect(after.b.published - before.b.published).toBe(0);
      expect(after.b.receivedRemote - before.b.receivedRemote).toBe(1);

      // Settle: no further publishes or receives on either instance.
      await sleep(SETTLE_MS);
      const settled = await bothStats(cookieAna);
      expect(settled.a.published).toBe(after.a.published);
      expect(settled.a.receivedRemote).toBe(after.a.receivedRemote);
      expect(settled.b.published).toBe(after.b.published);
      expect(settled.b.receivedRemote).toBe(after.b.receivedRemote);
    } finally {
      x.close();
      y.close();
    }
  });

  /**
   * Identical behavior through the nginx front door.
   *
   * With both clients and the emit routed through nginx (round-robin across the
   * instances), each client must still receive exactly one copy, the cluster must
   * show exactly one publish and exactly one remote receive in total regardless of
   * placement, and the settle window must add nothing.
   */
  it('behaves identically when clients and emit go through nginx', async () => {
    const before = await bothStats(cookieAna);
    const x: EventSource = openClusterSse(`${NGINX}/api/events`, cookieAna);
    const y: EventSource = openClusterSse(`${NGINX}/api/events`, cookieBob);
    try {
      // Attach both established waiters before awaiting either (see above).
      const established = Promise.all([
        nextEvent(x, 'connection:established'),
        nextEvent(y, 'connection:established'),
      ]);
      const onX = collectSeqEvents(x, EVENT);
      const onY = collectSeqEvents(y, EVENT);
      await established;
      await sleep(300);

      await emitToTenant(NGINX, cookieAna, TENANT, EVENT, { seq: 2 });
      await waitUntil(() => onX.length >= 1 && onY.length >= 1, 8000);
      await sleep(300);

      expect(onX).toHaveLength(1);
      expect(onY).toHaveLength(1);

      const after = await bothStats(cookieAna);
      const publishedDelta =
        after.a.published - before.a.published + (after.b.published - before.b.published);
      const receivedDelta =
        after.a.receivedRemote -
        before.a.receivedRemote +
        (after.b.receivedRemote - before.b.receivedRemote);
      // Exactly one publish and one remote receive cluster-wide, wherever nginx
      // placed the clients and the emit.
      expect(publishedDelta).toBe(1);
      expect(receivedDelta).toBe(1);

      await sleep(SETTLE_MS);
      const settled = await bothStats(cookieAna);
      const settledPublished = settled.a.published + settled.b.published;
      const settledReceived = settled.a.receivedRemote + settled.b.receivedRemote;
      expect(settledPublished).toBe(after.a.published + after.b.published);
      expect(settledReceived).toBe(after.a.receivedRemote + after.b.receivedRemote);
    } finally {
      x.close();
      y.close();
    }
  });
});
