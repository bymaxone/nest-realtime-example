/**
 * @fileoverview End-to-end helpers for driving the SSE endpoint.
 * @layer test-support
 *
 * Wraps login (to obtain the session cookie), opening an `eventsource` client
 * with that cookie injected via a custom fetch (an `EventSource` cannot set
 * headers itself), and awaiting a single named event with a timeout.
 */

import type { INestApplication } from '@nestjs/common';
import { EventSource } from 'eventsource';
import request from 'supertest';

/** Default time to wait for an expected SSE event before failing. */
const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Log in a demo user and return the `session=<token>` cookie header.
 *
 * @param app - The running Nest application.
 * @param username - The demo username to log in.
 * @returns The `name=value` cookie string to replay on the stream.
 */
export async function login(app: INestApplication, username: string): Promise<string> {
  const response = await request(app.getHttpServer()).post('/api/auth/login').send({ username });
  const setCookie = response.headers['set-cookie'];
  const first = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return (first ?? '').split(';')[0] ?? '';
}

/**
 * Open an SSE connection with the session cookie injected via a custom fetch.
 *
 * @param url - The absolute SSE endpoint URL.
 * @param cookie - The `session=<token>` cookie header to send.
 * @returns The live EventSource client.
 */
export function openSse(url: string, cookie: string): EventSource {
  return new EventSource(url, {
    fetch: (input, init) => fetch(input, { ...init, headers: { ...init.headers, cookie } }),
  });
}

/**
 * Resolve with the parsed data of the first occurrence of a named SSE event.
 *
 * @param source - The EventSource to listen on.
 * @param eventName - The SSE event name to await.
 * @param timeoutMs - How long to wait before rejecting.
 * @returns The parsed JSON payload of the event.
 */
export function nextEvent(
  source: EventSource,
  eventName: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timed out waiting for ${eventName}`)),
      timeoutMs,
    );
    source.addEventListener(
      eventName,
      (event: MessageEvent<string>) => {
        clearTimeout(timer);
        resolve(JSON.parse(event.data) as Record<string, unknown>);
      },
      { once: true },
    );
  });
}
