/**
 * @fileoverview Minimal `EventSource` test double for exercising the real library hooks.
 * @layer test
 *
 * jsdom does not implement `EventSource`. Most component/page tests mock the
 * `@bymax-one/nest-realtime/react` module directly and never need this; a small
 * set of integration-style tests install this class as `globalThis.EventSource`
 * to exercise the real (patched) hook code against a controllable fake stream.
 */

/** One registered named-event listener. */
type EventHandler = (event: { data: string; lastEventId: string; type: string }) => void;

/** Minimal `EventSource` double: tracks instances and lets tests fire events by hand. */
export class MockEventSource {
  /** Every instance constructed since the last {@link MockEventSource.reset} call. */
  static instances: MockEventSource[] = [];

  /** Reset the instance registry between tests. */
  static reset(): void {
    MockEventSource.instances = [];
  }

  readonly url: string;
  readonly withCredentials: boolean;
  closed = false;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: EventHandler | null = null;
  private readonly listeners = new Map<string, EventHandler[]>();

  constructor(url: string, options?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = options?.withCredentials ?? false;
    MockEventSource.instances.push(this);
  }

  addEventListener(name: string, handler: EventHandler): void {
    const existing = this.listeners.get(name) ?? [];
    existing.push(handler);
    this.listeners.set(name, existing);
  }

  close(): void {
    this.closed = true;
  }

  /** Simulate the connection opening. */
  triggerOpen(): void {
    this.onopen?.();
  }

  /** Simulate a transport-level error (native `EventSource` error, no payload). */
  triggerError(): void {
    this.onerror?.();
  }

  /** Simulate a default (unnamed) `message` event. */
  triggerMessage(data: unknown, id = ''): void {
    this.onmessage?.({ data: JSON.stringify(data), lastEventId: id, type: 'message' });
  }

  /** Simulate a named SSE event, dispatched only to listeners registered for `name`. */
  triggerNamed(name: string, data: unknown, id = ''): void {
    const event = { data: JSON.stringify(data), lastEventId: id, type: name };
    for (const handler of this.listeners.get(name) ?? []) handler(event);
  }

  /** Number of listeners registered for a given named event. */
  listenerCount(name: string): number {
    return this.listeners.get(name)?.length ?? 0;
  }
}
