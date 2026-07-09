/**
 * End-to-end tests proving the SSE heartbeat is an honest comment.
 *
 * Layer: e2e.
 * Goal: a raw capture over more than two heartbeat intervals shows `: keepalive`
 *       comment lines that carry no id or event field, and a parallel eventsource
 *       client registered for every app event receives none during the silence.
 * Mocks: none; the heartbeat interval is lowered to the library minimum.
 */

import type { INestApplication } from '@nestjs/common';

import { APP_EVENT_NAMES } from '../../src/domain/events';
import { createApp } from '../../src/main';
import { login, nextEvent, openSse } from '../support/sse.fixture';

interface AddressInfo {
  readonly port: number;
}

const HEARTBEAT_MS = 5000;

/** Capture the raw bytes of an SSE stream for a fixed window. */
async function captureRaw(url: string, cookie: string, durationMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), durationMs);
  let raw = '';
  try {
    const response = await fetch(url, { headers: { cookie }, signal: controller.signal });
    const body = response.body;
    if (!body) return raw;
    const reader = body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      raw += decoder.decode(value, { stream: true });
    }
  } catch {
    // The abort at the end of the window rejects the pending read; that is expected.
  } finally {
    clearTimeout(timer);
  }
  return raw;
}

describe('SSE heartbeat honesty (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let captureCookie: string;
  let listenerCookie: string;
  const originalHeartbeat = process.env.REALTIME_HEARTBEAT_MS;

  beforeAll(async () => {
    process.env.REALTIME_HEARTBEAT_MS = String(HEARTBEAT_MS);
    app = await createApp();
    await app.listen(0);
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
    captureCookie = await login(app, 'ana@acme');
    listenerCookie = await login(app, 'bob@acme');
  });

  afterAll(async () => {
    await app.close();
    if (originalHeartbeat === undefined) delete process.env.REALTIME_HEARTBEAT_MS;
    else process.env.REALTIME_HEARTBEAT_MS = originalHeartbeat;
  });

  /**
   * Heartbeat honesty.
   *
   * Over more than two intervals the raw stream must show at least two
   * `: keepalive` comment lines, none carrying an id or event field, while a
   * parallel client subscribed to every app event receives none - proving the
   * heartbeat is a comment that fires no listeners.
   */
  it('sends keepalive comments that fire no listeners', async () => {
    const listener = openSse(`${baseUrl}/api/events`, listenerCookie);
    await nextEvent(listener, 'connection:established');
    let appEvents = 0;
    for (const name of Object.values(APP_EVENT_NAMES)) {
      listener.addEventListener(name, () => {
        appEvents += 1;
      });
    }

    const raw = await captureRaw(`${baseUrl}/api/events`, captureCookie, HEARTBEAT_MS * 2 + 2000);
    listener.close();

    const keepaliveFrames = raw.split('\n\n').filter((frame) => /^: keepalive$/m.test(frame));
    expect(keepaliveFrames.length).toBeGreaterThanOrEqual(2);
    for (const frame of keepaliveFrames) {
      expect(frame).not.toContain('id:');
      expect(frame).not.toContain('event:');
    }
    expect(appEvents).toBe(0);
  }, 20000);
});
