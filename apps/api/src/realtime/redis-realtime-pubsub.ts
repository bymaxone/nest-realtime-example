/**
 * @fileoverview Redis pub/sub implementation of the library's `IRealtimePubSub`.
 * @layer realtime
 *
 * This is a sanctioned consumer-side reference implementation: the library owns
 * the cross-instance fan-out logic (it delivers locally, then publishes once, and
 * its subscriber applies remote messages through `*Local` paths) and only calls
 * this contract to move a `RealtimePubSubMessage` between instances. Two Redis
 * connections are used because a client in subscriber mode cannot issue other
 * commands: the provided client publishes, and a lazily-created `duplicate()`
 * subscribes. Every published message is stamped with this instance's origin id
 * and the subscriber drops messages carrying its own origin before any handler
 * runs, so an instance never re-delivers its own emit (no A to B to A storm).
 * Malformed payloads are logged and skipped so one bad message never breaks the
 * bus. A minimal availability flag lets the liveness probe report whether
 * cross-instance fan-out is currently healthy.
 */

import { randomUUID } from 'node:crypto';

import type { IRealtimePubSub, RealtimePubSubMessage } from '@bymax-one/nest-realtime';
import { Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';

/** A subscriber callback invoked for every accepted remote message. */
type MessageHandler = (message: RealtimePubSubMessage) => void;

/** Default Redis pub/sub channel shared by every instance in the cluster. */
const DEFAULT_CHANNEL = 'realtime:fanout';

/** Construction options for {@link RedisRealtimePubSub}. */
export interface RedisRealtimePubSubOptions {
  /** The ioredis client used to publish; its `duplicate()` becomes the subscriber. */
  readonly client: Redis;
  /** The pub/sub channel name; every cluster instance must share the same value. */
  readonly channel?: string;
}

/**
 * Redis-backed `IRealtimePubSub` for horizontal SSE fan-out.
 *
 * The publishing client is provided; the subscriber is a `duplicate()` created on
 * the first `subscribe` and quit when the last handler unsubscribes. Own-origin
 * messages are filtered before handlers so a single emit is delivered exactly once
 * per client cluster-wide.
 */
export class RedisRealtimePubSub implements IRealtimePubSub {
  /** This instance's origin id, stamped on every published message. */
  public readonly instanceId: string = randomUUID();

  private readonly logger = new Logger(RedisRealtimePubSub.name);
  private readonly pub: Redis;
  private readonly channel: string;
  private readonly handlers = new Set<MessageHandler>();
  private subscriber: Redis | null = null;
  private subscribing: Promise<void> | null = null;
  private busAvailable = true;

  /**
   * Build the Redis pub/sub bus.
   *
   * @param options - The publishing client and the shared channel name.
   */
  constructor(options: RedisRealtimePubSubOptions) {
    this.pub = options.client;
    this.channel = options.channel ?? DEFAULT_CHANNEL;
  }

  /**
   * Report whether cross-instance fan-out is currently healthy.
   *
   * Reflects the last observed state of the subscriber connection and the last
   * publish outcome; consumed by the liveness probe to surface a degraded flag.
   *
   * @returns `true` while the bus is usable, `false` after a Redis outage.
   */
  get available(): boolean {
    return this.busAvailable;
  }

  /**
   * Stamp the message with this instance's origin and publish it to the channel.
   *
   * @param message - The cross-instance message to fan out.
   * @throws When the Redis `PUBLISH` command fails (the caller in the library
   *   catches this and degrades to single-instance delivery).
   */
  async publish(message: RealtimePubSubMessage): Promise<void> {
    const stamped: RealtimePubSubMessage = { ...message, origin: this.instanceId };
    try {
      await this.pub.publish(this.channel, JSON.stringify(stamped));
      this.busAvailable = true;
    } catch (error) {
      this.busAvailable = false;
      throw error;
    }
  }

  /**
   * Register a handler for accepted remote messages.
   *
   * The subscriber connection is created lazily on the first call; the returned
   * function removes this handler and quits the subscriber once the last handler
   * is gone.
   *
   * @param handler - Invoked for every remote message not originated here.
   * @returns An async unsubscribe handle.
   */
  async subscribe(handler: MessageHandler): Promise<() => Promise<void>> {
    this.handlers.add(handler);
    try {
      await this.ensureSubscriber();
    } catch (error) {
      this.handlers.delete(handler);
      throw error;
    }
    return async () => {
      this.handlers.delete(handler);
      if (this.handlers.size === 0) await this.close();
    };
  }

  /**
   * Quit the subscriber connection and drop every handler.
   *
   * Safe to call more than once; the publishing client is owned by the caller and
   * is intentionally left open.
   */
  async close(): Promise<void> {
    const subscriber = this.subscriber;
    this.subscriber = null;
    this.subscribing = null;
    this.handlers.clear();
    if (subscriber) {
      await subscriber.unsubscribe(this.channel);
      await subscriber.quit();
    }
  }

  /**
   * Create the single shared subscriber connection, idempotently under concurrency.
   *
   * On failure the cached init promise is cleared so a later call retries from
   * scratch and the bus is marked unavailable.
   */
  private ensureSubscriber(): Promise<void> {
    if (this.subscriber) return Promise.resolve();
    if (this.subscribing) return this.subscribing;
    this.subscribing = this.createSubscriber().catch((error: unknown) => {
      this.subscribing = null;
      this.busAvailable = false;
      throw error;
    });
    return this.subscribing;
  }

  /** Duplicate the client, wire connection listeners, and subscribe to the channel. */
  private async createSubscriber(): Promise<void> {
    const subscriber = this.pub.duplicate();
    subscriber.on('message', (channel: string, payload: string) => {
      this.dispatch(channel, payload);
    });
    subscriber.on('ready', () => {
      this.busAvailable = true;
    });
    subscriber.on('close', () => {
      this.busAvailable = false;
    });
    subscriber.on('end', () => {
      this.busAvailable = false;
    });
    try {
      await subscriber.subscribe(this.channel);
    } catch (error) {
      // Stop the orphaned clone from reconnecting forever behind a failed subscribe.
      subscriber.disconnect();
      throw error;
    }
    this.subscriber = subscriber;
    this.busAvailable = true;
  }

  /**
   * Decode one raw message, drop own-origin and malformed payloads, and fan the
   * rest to every handler without letting a throwing handler break the loop.
   */
  private dispatch(channel: string, payload: string): void {
    if (channel !== this.channel) return;
    const message = this.decode(payload);
    if (!message || message.origin === this.instanceId) return;
    for (const handler of this.handlers) {
      try {
        handler(message);
      } catch (error) {
        this.logger.warn(`pub/sub handler failed: ${(error as Error).message}`);
      }
    }
  }

  /** Parse a JSON payload into a message, logging and returning null when malformed. */
  private decode(payload: string): RealtimePubSubMessage | null {
    try {
      return JSON.parse(payload) as RealtimePubSubMessage;
    } catch (error) {
      this.logger.warn(`dropping malformed pub/sub payload: ${(error as Error).message}`);
      return null;
    }
  }
}
