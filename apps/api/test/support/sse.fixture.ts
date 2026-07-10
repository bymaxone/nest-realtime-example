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
 * Open an SSE connection replaying from a given `Last-Event-ID`.
 *
 * An `EventSource` sends `Last-Event-ID` only on its own automatic reconnect, so
 * the fixture injects it via the custom fetch to drive replay from a chosen
 * cursor (including the `0` sentinel that drains a whole offline queue).
 *
 * @param url - The absolute SSE endpoint URL.
 * @param cookie - The `session=<token>` cookie header to send.
 * @param lastEventId - The `Last-Event-ID` value to replay from.
 * @returns The live EventSource client.
 */
export function openSseReplay(url: string, cookie: string, lastEventId: string): EventSource {
  return new EventSource(url, {
    fetch: (input, init) =>
      fetch(input, {
        ...init,
        headers: { ...init.headers, cookie, 'last-event-id': lastEventId },
      }),
  });
}

/** One received SSE event reduced to its sequence number and id. */
export interface CollectedEvent {
  readonly seq: number;
  readonly id: string;
}

/**
 * Accumulate `{ seq, id }` for every occurrence of a named event, in arrival order.
 *
 * @param source - The EventSource to listen on.
 * @param eventName - The SSE event name to collect.
 * @returns A live array appended to as events arrive.
 */
export function collectSeqEvents(source: EventSource, eventName: string): CollectedEvent[] {
  const received: CollectedEvent[] = [];
  source.addEventListener(eventName, (event: MessageEvent<string>) => {
    const payload = JSON.parse(event.data) as { seq: number };
    received.push({ seq: payload.seq, id: event.lastEventId });
  });
  return received;
}

/**
 * Resolve once a predicate holds, polling on a short interval.
 *
 * @param predicate - The condition to await.
 * @param timeoutMs - How long to wait before rejecting.
 * @returns A promise that resolves when the predicate first holds.
 */
export function waitUntil(
  predicate: () => boolean,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const tick = (): void => {
      if (predicate()) {
        resolve();
        return;
      }
      if (Date.now() > deadline) {
        reject(new Error('timed out waiting for condition'));
        return;
      }
      setTimeout(tick, 25);
    };
    tick();
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

/**
 * Resolve once the SSE stream opens (the EventSource `open` event fires).
 *
 * Useful when the `connection:established` event is disabled but the test still
 * needs to know the stream is live before emitting.
 *
 * @param source - The EventSource to watch.
 * @param timeoutMs - How long to wait before rejecting.
 * @returns A promise that resolves when the stream is open.
 */
export function waitForOpen(
  source: EventSource,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for open')), timeoutMs);
    source.addEventListener(
      'open',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * Resolve once the server closes the stream (the EventSource errors), then close
 * the client so it does not silently reconnect and reopen the connection.
 *
 * @param source - The EventSource to watch.
 * @param timeoutMs - How long to wait before rejecting.
 * @returns A promise that resolves when the stream is torn down server-side.
 */
export function waitForClose(
  source: EventSource,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for close')), timeoutMs);
    source.addEventListener(
      'error',
      () => {
        clearTimeout(timer);
        source.close();
        resolve();
      },
      { once: true },
    );
  });
}
