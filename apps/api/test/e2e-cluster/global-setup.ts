/**
 * @fileoverview Fails the cluster e2e fast when the compose stack is not up.
 * @layer test-support
 *
 * The cluster suite has no in-memory fallback: it needs the real stack listening
 * on 3001, 3002 and 8080. This global setup probes every instance's liveness and
 * throws a single actionable message when any is unreachable, so a forgotten
 * `docker compose --profile cluster up` fails with guidance instead of a wall of
 * connection errors.
 */

import { APP_A, APP_B, NGINX } from './cluster.fixture';

/** The liveness endpoints that must all answer before the suite runs. */
const HEALTH_URLS: readonly string[] = [`${APP_A}/health`, `${APP_B}/health`, `${NGINX}/health`];

/** Probe one liveness URL, returning whether it answered `ok`. */
async function isUp(url: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Assert the cluster stack is reachable before any spec runs.
 *
 * @throws When any instance or the proxy is unreachable, with the command to bring
 *   the stack up.
 */
export default async function globalSetup(): Promise<void> {
  const results = await Promise.all(HEALTH_URLS.map((url) => isUp(url)));
  const down = HEALTH_URLS.filter((_, index) => !results[index]);
  if (down.length > 0) {
    throw new Error(
      `Cluster stack is not reachable at: ${down.join(', ')}. ` +
        'Bring it up first: docker compose --profile cluster up -d --build',
    );
  }
}
