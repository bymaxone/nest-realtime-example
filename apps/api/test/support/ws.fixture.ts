/**
 * @fileoverview End-to-end helpers for driving the WebSocket transport.
 * @layer test-support
 *
 * Wraps minting a short-lived bearer from a session cookie (the WebSocket-only
 * credential), opening a `socket.io-client` connection that carries the bearer as
 * the Socket.IO `handshake.auth.token`, and observing the two success and failure
 * shapes: a `connection:established` event for an accepted handshake, or a
 * `connect_error` / server `disconnect` for a rejected one. These helpers never
 * import the application bootstrap so a suite can set its transport profile in the
 * environment before dynamically importing `createApp`.
 */

import type { INestApplication } from '@nestjs/common';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';

/** Default time to wait for an expected WebSocket outcome before failing. */
const DEFAULT_TIMEOUT_MS = 8000;

/** A minted bearer token response from the ws-token endpoint. */
interface WsTokenResponse {
  readonly token: string;
}

/**
 * Mint a short-lived WebSocket bearer token for a logged-in session.
 *
 * @param app - The running Nest application.
 * @param cookie - The `session=<token>` cookie from {@link login}.
 * @returns The signed bearer token to place in `handshake.auth.token`.
 */
export async function mintWsToken(app: INestApplication, cookie: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/api/auth/ws-token')
    .set('cookie', cookie);
  return (response.body as WsTokenResponse).token;
}

/**
 * Open a WebSocket to the namespace, authenticating with the bearer token.
 *
 * @param url - The absolute namespace URL (base URL plus the configured namespace).
 * @param token - The bearer placed in `auth.token`, or `undefined` to omit it.
 * @param timeoutMs - How long to wait for `connection:established` before failing.
 * @returns The live socket and the parsed `connection:established` payload.
 * @throws when the handshake is rejected or no event arrives before the timeout.
 */
export function openWs(
  url: string,
  token: string | undefined,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<{ socket: Socket; established: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const socket = buildSocket(url, token);
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('timed out waiting for connection:established'));
    }, timeoutMs);
    socket.on('connection:established', (payload: Record<string, unknown>) => {
      clearTimeout(timer);
      resolve({ socket, established: payload });
    });
    socket.on('connect_error', (err: Error) => {
      clearTimeout(timer);
      socket.close();
      reject(new Error(`connect_error: ${err.message}`));
    });
    socket.on('disconnect', (reason: string) => {
      clearTimeout(timer);
      reject(new Error(`disconnect: ${reason}`));
    });
  });
}

/**
 * Await the failure outcome of a handshake expected to be rejected.
 *
 * @param url - The absolute namespace URL.
 * @param token - The bearer placed in `auth.token`, or `undefined` to omit it.
 * @param timeoutMs - How long to wait for a rejection before failing.
 * @returns The rejection reason (a `connect_error` message or a disconnect reason).
 * @throws when the handshake unexpectedly establishes or nothing happens in time.
 */
export function awaitWsRejection(
  url: string,
  token: string | undefined,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = buildSocket(url, token);
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('timed out waiting for a rejection'));
    }, timeoutMs);
    socket.on('connection:established', () => {
      clearTimeout(timer);
      socket.close();
      reject(new Error('handshake unexpectedly established'));
    });
    socket.on('connect_error', (err: Error) => {
      clearTimeout(timer);
      socket.close();
      resolve(`connect_error: ${err.message}`);
    });
    socket.on('disconnect', (reason: string) => {
      clearTimeout(timer);
      socket.close();
      resolve(`disconnect: ${reason}`);
    });
  });
}

/**
 * Resolve with the first payload of a named event on an open socket.
 *
 * @param socket - A connected socket.
 * @param event - The event name to await.
 * @param timeoutMs - How long to wait before failing.
 * @returns The event payload.
 * @throws when the event does not arrive before the timeout.
 */
export function nextWsEvent(
  socket: Socket,
  event: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), timeoutMs);
    socket.once(event, (payload: unknown) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/** Build a non-reconnecting WebSocket-only client, optionally carrying a bearer. */
function buildSocket(url: string, token: string | undefined): Socket {
  return io(url, {
    transports: ['websocket'],
    auth: token === undefined ? {} : { token },
    reconnection: false,
  });
}
