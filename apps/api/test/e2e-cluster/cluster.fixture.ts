/**
 * @fileoverview HTTP/SSE helpers for driving the live cluster stack.
 * @layer test-support
 *
 * The cluster e2e talks to the running compose stack over real HTTP, so these
 * helpers use `fetch` against absolute instance URLs (app-a on 3001, app-b on
 * 3002, nginx on 8080) rather than an in-memory Nest app. The session cookie is
 * portable across instances because every instance signs with the same demo
 * secret, so a login on one is accepted on the other.
 *
 * Because every spec hits the same fixed origins, SSE streams must not leave a
 * half-read socket in the fetch keep-alive pool: {@link openClusterSse} owns an
 * `AbortController` and aborts it on close so the underlying socket is destroyed
 * rather than reused by the next connection (which would otherwise hang). The
 * single-instance suites never need this because each of their tests binds a fresh
 * ephemeral port.
 */

import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

import { EventSource } from 'eventsource';

import type { ClusterStats } from '../../src/connections/cluster-stats.service';

/** Promise-returning `execFile` for driving the docker CLI from the suite. */
const execFileAsync = promisify(execFile);

/** Path to the compose file, resolved from the api package (jest's working dir). */
const COMPOSE_FILE = resolve(process.cwd(), '../../docker-compose.yml');

/** Direct base URL of the first api instance. */
export const APP_A = 'http://127.0.0.1:3001';
/** Direct base URL of the second api instance. */
export const APP_B = 'http://127.0.0.1:3002';
/** Base URL of the nginx front door that round-robins across both instances. */
export const NGINX = 'http://127.0.0.1:8080';

/**
 * Log in a demo user against one instance and return the session cookie.
 *
 * @param baseUrl - The instance base URL to authenticate against.
 * @param username - The demo username to log in.
 * @returns The `session=<token>` cookie string, portable across instances.
 */
export async function clusterLogin(baseUrl: string, username: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  if (!response.ok) throw new Error(`login failed (${response.status}) at ${baseUrl}`);
  const setCookie = response.headers.get('set-cookie') ?? '';
  return setCookie.split(';')[0] ?? '';
}

/**
 * Read one instance's fan-out counters.
 *
 * @param baseUrl - The instance base URL to read from.
 * @param cookie - The session cookie authorizing the read.
 * @returns The instance's {@link ClusterStats} snapshot.
 */
export async function readStats(baseUrl: string, cookie: string): Promise<ClusterStats> {
  const response = await fetch(`${baseUrl}/api/labs/cluster/stats`, { headers: { cookie } });
  if (!response.ok) throw new Error(`stats failed (${response.status}) at ${baseUrl}`);
  return (await response.json()) as ClusterStats;
}

/**
 * Emit an event to every connection in a tenant via one instance.
 *
 * @param baseUrl - The instance base URL to emit through.
 * @param cookie - The session cookie of a member of the tenant.
 * @param tenantId - The target tenant.
 * @param event - The event name.
 * @param data - The event payload.
 */
export async function emitToTenant(
  baseUrl: string,
  cookie: string,
  tenantId: string,
  event: string,
  data: unknown,
): Promise<void> {
  const response = await fetch(`${baseUrl}/api/emit/tenant/${encodeURIComponent(tenantId)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ event, data }),
  });
  if (!response.ok) throw new Error(`emit failed (${response.status}) at ${baseUrl}`);
}

/**
 * Read a tenant's online presence roster via one instance.
 *
 * @param baseUrl - The instance base URL to read from.
 * @param cookie - The session cookie of a member of the tenant.
 * @param tenantId - The tenant whose roster is requested.
 * @returns The online user ids reported by that instance.
 */
export async function readPresence(
  baseUrl: string,
  cookie: string,
  tenantId: string,
): Promise<string[]> {
  const response = await fetch(`${baseUrl}/api/presence/${encodeURIComponent(tenantId)}`, {
    headers: { cookie },
  });
  if (!response.ok) throw new Error(`presence failed (${response.status}) at ${baseUrl}`);
  const body = (await response.json()) as { online: string[] };
  return body.online;
}

/**
 * Poll an async predicate until it holds or the deadline passes.
 *
 * @param predicate - The async condition to await.
 * @param timeoutMs - How long to poll before rejecting.
 * @returns A promise resolving once the predicate first holds.
 */
export async function pollUntil(
  predicate: () => Promise<boolean>,
  timeoutMs = 8000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await predicate()) return;
    if (Date.now() > deadline) throw new Error('timed out waiting for condition');
    await sleep(100);
  }
}

/**
 * Open an SSE connection whose socket is destroyed on close.
 *
 * The session cookie is injected via a custom fetch (an `EventSource` cannot set
 * headers), and a dedicated `AbortController` is aborted when the stream is closed
 * so the keep-alive pool never reuses a half-read SSE socket for the next connection.
 *
 * @param url - The absolute SSE endpoint URL.
 * @param cookie - The `session=<token>` cookie to send.
 * @returns The live EventSource client.
 */
export function openClusterSse(url: string, cookie: string): EventSource {
  const controller = new AbortController();
  const source = new EventSource(url, {
    fetch: (input, init) =>
      fetch(input, { ...init, headers: { ...init.headers, cookie }, signal: controller.signal }),
  });
  const close = source.close.bind(source);
  source.close = (): void => {
    close();
    controller.abort();
  };
  return source;
}

/**
 * Force-disconnect a connection via one instance's kill switch.
 *
 * @param baseUrl - The instance base URL to send the disconnect through.
 * @param cookie - The session cookie of the connection's owner.
 * @param connectionId - The connection id to close (may live on another instance).
 * @returns The HTTP response so the caller can assert its status.
 */
export function disconnectConnection(
  baseUrl: string,
  cookie: string,
  connectionId: string,
): Promise<Response> {
  return fetch(`${baseUrl}/api/connections/${encodeURIComponent(connectionId)}/disconnect`, {
    method: 'POST',
    headers: { cookie },
  });
}

/**
 * Read an instance's liveness payload (unauthenticated, outside the api prefix).
 *
 * @param baseUrl - The instance base URL to probe.
 * @returns The instance name and its pub/sub health flag.
 */
export async function readHealth(baseUrl: string): Promise<{ instance: string; pubsub: string }> {
  const response = await fetch(`${baseUrl}/health`);
  if (!response.ok) throw new Error(`health failed (${response.status}) at ${baseUrl}`);
  return (await response.json()) as { instance: string; pubsub: string };
}

/**
 * Emit an event to every connection of a user via one instance.
 *
 * @param baseUrl - The instance base URL to emit through.
 * @param cookie - The session cookie of an authenticated caller.
 * @param userId - The target user id.
 * @param event - The event name.
 * @param data - The event payload.
 */
export async function emitToUser(
  baseUrl: string,
  cookie: string,
  userId: string,
  event: string,
  data: unknown,
): Promise<void> {
  const response = await fetch(`${baseUrl}/api/emit/user/${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ event, data }),
  });
  if (!response.ok) throw new Error(`emit user failed (${response.status}) at ${baseUrl}`);
}

/**
 * Mint a short-lived WebSocket bearer token via one instance.
 *
 * @param baseUrl - The instance base URL to mint through.
 * @param cookie - The session cookie authorizing the mint.
 * @returns The signed bearer for the Socket.IO `handshake.auth.token`.
 */
export async function mintClusterWsToken(baseUrl: string, cookie: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/ws-token`, {
    method: 'POST',
    headers: { cookie },
  });
  if (!response.ok) throw new Error(`ws-token failed (${response.status}) at ${baseUrl}`);
  return ((await response.json()) as { token: string }).token;
}

/**
 * Join a connection to the incident room via one instance.
 *
 * @param baseUrl - The instance base URL owning the connection.
 * @param cookie - The session cookie of the connection's owner.
 * @param connectionId - The connection to join.
 * @param resourceId - The incident id (the room is `resource:incident:{id}`).
 */
export async function joinIncidentRoom(
  baseUrl: string,
  cookie: string,
  connectionId: string,
  resourceId: string,
): Promise<void> {
  const response = await fetch(`${baseUrl}/api/rooms/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ connectionId, resourceType: 'incident', resourceId }),
  });
  if (!response.ok) throw new Error(`join failed (${response.status}) at ${baseUrl}`);
}

/** Stop the cluster's Redis container to simulate a pub/sub outage. */
export async function stopRedis(): Promise<void> {
  await execFileAsync('docker', ['compose', '-f', COMPOSE_FILE, 'stop', 'redis']);
}

/** Start the cluster's Redis container again to restore cross-instance fan-out. */
export async function startRedis(): Promise<void> {
  await execFileAsync('docker', ['compose', '-f', COMPOSE_FILE, 'start', 'redis']);
}

/** Sleep for a fixed number of milliseconds. */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
