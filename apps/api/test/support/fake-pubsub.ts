/**
 * @fileoverview In-memory ioredis pub/sub double for the cluster unit tests.
 * @layer test-support
 *
 * Models the surface `RedisRealtimePubSub` touches: `publish`, `duplicate`,
 * `subscribe`, `unsubscribe`, `quit`, and the connection `on(event)` listeners.
 * Every client built from the same {@link FakePubSubBroker} shares one message
 * bus, so two `RedisRealtimePubSub` instances fan out to each other exactly as
 * they would across a real Redis, letting the unit tests prove origin self-filter
 * and cross-instance fan-in deterministically. The cast to `Redis` at each use
 * site is a deliberate partial double, not a laundered type error.
 */

import type { Redis } from 'ioredis';

/** A connection lifecycle event a fake client can emit. */
type ConnectionEvent = 'ready' | 'close' | 'end';

/** A raw message listener registered via `on('message', ...)`. */
type MessageListener = (channel: string, payload: string) => void;

/** Shared message bus every fake client built from it publishes onto. */
export class FakePubSubBroker {
  private readonly subscribers = new Map<string, Set<FakePubSubRedis>>();

  /**
   * Register a client as a subscriber of a channel.
   *
   * @param channel - The channel to subscribe to.
   * @param client - The subscribing fake client.
   */
  register(channel: string, client: FakePubSubRedis): void {
    const set = this.subscribers.get(channel) ?? new Set<FakePubSubRedis>();
    set.add(client);
    this.subscribers.set(channel, set);
  }

  /**
   * Remove a client from a channel's subscriber set.
   *
   * @param channel - The channel to unsubscribe from.
   * @param client - The client to remove.
   */
  unregister(channel: string, client: FakePubSubRedis): void {
    this.subscribers.get(channel)?.delete(client);
  }

  /**
   * Deliver a payload to every client subscribed to the channel.
   *
   * @param channel - The published channel.
   * @param payload - The raw string payload.
   * @returns The number of clients the payload reached.
   */
  publish(channel: string, payload: string): number {
    const set = this.subscribers.get(channel);
    if (!set) return 0;
    for (const client of set) client.deliver(channel, payload);
    return set.size;
  }
}

/** Minimal in-memory stand-in for an ioredis client with pub/sub. */
export class FakePubSubRedis {
  private readonly messageListeners = new Set<MessageListener>();
  private readonly connectionListeners = new Map<ConnectionEvent, Set<() => void>>();

  /** Channels this client has been asked to fail `subscribe` for. */
  private failSubscribe = false;
  /** Whether the next `publish` should reject. */
  private failPublish = false;

  /** Count of `quit()` calls, for teardown assertions. */
  quitCalls = 0;
  /** Count of `disconnect()` calls, for rollback assertions. */
  disconnectCalls = 0;
  /** Channels this client unsubscribed from, for assertions. */
  readonly unsubscribed: string[] = [];

  /**
   * Build a fake client bound to a shared broker.
   *
   * @param broker - The message bus this client publishes onto and subscribes from.
   */
  constructor(private readonly broker: FakePubSubBroker) {}

  /** Arm the next `subscribe` call to reject, simulating an unreachable Redis. */
  armSubscribeFailure(): void {
    this.failSubscribe = true;
  }

  /** Arm the next `publish` call to reject, simulating a Redis outage. */
  armPublishFailure(): void {
    this.failPublish = true;
  }

  /**
   * Publish a payload to the broker, or reject when armed to fail.
   *
   * @param channel - The channel to publish to.
   * @param payload - The raw string payload.
   * @returns The number of receivers.
   */
  publish(channel: string, payload: string): Promise<number> {
    if (this.failPublish) {
      this.failPublish = false;
      return Promise.reject(new Error('publish failed: connection is closed'));
    }
    return Promise.resolve(this.broker.publish(channel, payload));
  }

  /**
   * Create an independent client sharing the same broker (the subscriber clone).
   *
   * @returns A new fake client on the same bus.
   */
  duplicate(): FakePubSubRedis {
    return new FakePubSubRedis(this.broker);
  }

  /**
   * Subscribe this client to a channel, or reject when armed to fail.
   *
   * @param channel - The channel to subscribe to.
   * @returns The number of channels now subscribed.
   */
  subscribe(channel: string): Promise<number> {
    if (this.failSubscribe) {
      this.failSubscribe = false;
      return Promise.reject(new Error('subscribe failed: connection is closed'));
    }
    this.broker.register(channel, this);
    return Promise.resolve(1);
  }

  /**
   * Unsubscribe this client from a channel.
   *
   * @param channel - The channel to unsubscribe from.
   * @returns The number of channels still subscribed.
   */
  unsubscribe(channel: string): Promise<number> {
    this.unsubscribed.push(channel);
    this.broker.unregister(channel, this);
    return Promise.resolve(0);
  }

  /**
   * Quit the client, dropping every listener.
   *
   * @returns The literal `OK`, as ioredis resolves.
   */
  quit(): Promise<'OK'> {
    this.quitCalls += 1;
    return Promise.resolve('OK');
  }

  /** Synchronously stop the client, as ioredis `disconnect()` does. */
  disconnect(): void {
    this.disconnectCalls += 1;
  }

  /**
   * Register a `message` or connection-lifecycle listener.
   *
   * @param event - The event name.
   * @param listener - The callback to register.
   * @returns This client for chaining, as ioredis returns.
   */
  on(event: string, listener: (...args: never[]) => void): this {
    if (event === 'message') {
      this.messageListeners.add(listener as MessageListener);
      return this;
    }
    const connectionEvent = event as ConnectionEvent;
    const set = this.connectionListeners.get(connectionEvent) ?? new Set<() => void>();
    set.add(listener as () => void);
    this.connectionListeners.set(connectionEvent, set);
    return this;
  }

  /**
   * Deliver a raw message to every registered `message` listener.
   *
   * @param channel - The channel the message arrived on.
   * @param payload - The raw string payload.
   */
  deliver(channel: string, payload: string): void {
    for (const listener of this.messageListeners) listener(channel, payload);
  }

  /**
   * Fire a connection-lifecycle event to its registered listeners.
   *
   * @param event - The lifecycle event to emit.
   */
  emit(event: ConnectionEvent): void {
    for (const listener of this.connectionListeners.get(event) ?? []) listener();
  }
}

/**
 * View a fake pub/sub client as the ioredis `Redis` type the bus expects.
 *
 * @param fake - The in-memory double.
 * @returns The same object typed as `Redis`.
 */
export function asPubSubRedis(fake: FakePubSubRedis): Redis {
  return fake as unknown as Redis;
}
