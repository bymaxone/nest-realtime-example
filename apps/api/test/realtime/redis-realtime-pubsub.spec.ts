/**
 * Unit tests for RedisRealtimePubSub.
 *
 * Layer: unit.
 * Goal: publish stamps the instance origin, the subscriber drops own-origin and
 *       malformed messages, cross-instance fan-in reaches every handler exactly
 *       once, unsubscribe tears the subscriber down, and the availability flag
 *       tracks the connection and publish outcomes.
 * Mocks: an in-memory pub/sub broker shared by two bus instances (fake-pubsub).
 */

import type { RealtimePubSubMessage } from '@bymax-one/nest-realtime';
import { Logger } from '@nestjs/common';

import { RedisRealtimePubSub } from '../../src/realtime/redis-realtime-pubsub';
import { asPubSubRedis, FakePubSubBroker, FakePubSubRedis } from '../support/fake-pubsub';

const CHANNEL = 'test:fanout';

/** Build a message with a placeholder origin the bus is expected to overwrite. */
function message(op: RealtimePubSubMessage['op'], args: unknown): RealtimePubSubMessage {
  return { op, args, origin: 'placeholder' };
}

/** Flush the microtask queue so synchronous fan-out settles before assertions. */
const flush = (): Promise<void> => Promise.resolve();

describe('RedisRealtimePubSub', () => {
  let broker: FakePubSubBroker;
  let pubA: FakePubSubRedis;
  let pubB: FakePubSubRedis;
  let busA: RedisRealtimePubSub;
  let busB: RedisRealtimePubSub;

  beforeEach(() => {
    broker = new FakePubSubBroker();
    pubA = new FakePubSubRedis(broker);
    pubB = new FakePubSubRedis(broker);
    busA = new RedisRealtimePubSub({ client: asPubSubRedis(pubA), channel: CHANNEL });
    busB = new RedisRealtimePubSub({ client: asPubSubRedis(pubB), channel: CHANNEL });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * Origin stamping.
   *
   * Every published message must carry this instance's origin id, overwriting any
   * placeholder, so remote instances can attribute and self-filter it.
   */
  it('stamps the instance origin on publish', async () => {
    const received: RealtimePubSubMessage[] = [];
    await busB.subscribe((msg) => received.push(msg));

    await busA.publish(message('broadcast', { event: 'x', data: 1, id: '1' }));
    await flush();

    expect(received).toHaveLength(1);
    expect(received[0]?.origin).toBe(busA.instanceId);
  });

  /**
   * Own-origin self-filter (no storm).
   *
   * An instance must drop the copy of its own emit that Redis echoes back, so it
   * never re-delivers locally: the emitting instance's handler is never called
   * while the peer instance's handler receives exactly one copy.
   */
  it('drops own-origin messages and fans out to the peer exactly once', async () => {
    const onA: RealtimePubSubMessage[] = [];
    const onB: RealtimePubSubMessage[] = [];
    await busA.subscribe((msg) => onA.push(msg));
    await busB.subscribe((msg) => onB.push(msg));

    await busA.publish(
      message('emitToTenant', { tenantId: 'acme', event: 'e', data: {}, id: '9' }),
    );
    await flush();

    expect(onA).toHaveLength(0);
    expect(onB).toHaveLength(1);
  });

  /**
   * Multi-handler fan-in.
   *
   * Every handler registered on an instance must receive each remote message, so a
   * feature can observe the bus without displacing another.
   */
  it('delivers a remote message to every registered handler', async () => {
    const first: RealtimePubSubMessage[] = [];
    const second: RealtimePubSubMessage[] = [];
    await busB.subscribe((msg) => first.push(msg));
    await busB.subscribe((msg) => second.push(msg));

    await busA.publish(message('broadcast', { event: 'e', data: {}, id: '1' }));
    await flush();

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
  });

  /**
   * Malformed payloads are skipped, not thrown.
   *
   * A non-JSON payload on the channel must be logged and dropped so one bad
   * message never breaks the bus for well-formed ones.
   */
  it('logs and skips a malformed payload without invoking handlers', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const received: RealtimePubSubMessage[] = [];
    await busB.subscribe((msg) => received.push(msg));

    // A raw publisher on the same channel emits an unparseable payload.
    await new FakePubSubRedis(broker).publish(CHANNEL, 'not-json{');
    await flush();

    expect(received).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('malformed'));
  });

  /**
   * Handler failure isolation.
   *
   * A throwing handler must be caught and logged so the remaining handlers still
   * receive the message.
   */
  it('isolates a throwing handler from the others', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const survivor: RealtimePubSubMessage[] = [];
    await busB.subscribe(() => {
      throw new Error('handler boom');
    });
    await busB.subscribe((msg) => survivor.push(msg));

    await busA.publish(message('broadcast', { event: 'e', data: {}, id: '1' }));
    await flush();

    expect(survivor).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('handler failed'));
  });

  /**
   * Channel isolation.
   *
   * A message delivered on a different channel than the bus subscribed to must be
   * ignored, guarding a shared subscriber from cross-channel bleed.
   */
  it('ignores messages delivered on a foreign channel', async () => {
    const subscriber = new FakePubSubRedis(broker);
    jest.spyOn(pubB, 'duplicate').mockReturnValue(subscriber);
    const received: RealtimePubSubMessage[] = [];
    await busB.subscribe((msg) => received.push(msg));

    subscriber.deliver('other:channel', JSON.stringify(message('broadcast', {})));

    expect(received).toHaveLength(0);
  });

  /**
   * Unsubscribe tears down the subscriber.
   *
   * Removing the last handler must unsubscribe and quit the duplicated subscriber
   * so a closed feature leaves no idle Redis connection behind.
   */
  it('unsubscribes and quits the subscriber when the last handler leaves', async () => {
    const subscriber = new FakePubSubRedis(broker);
    jest.spyOn(pubB, 'duplicate').mockReturnValue(subscriber);

    const off = await busB.subscribe(() => undefined);
    await off();

    expect(subscriber.unsubscribed).toContain(CHANNEL);
    expect(subscriber.quitCalls).toBe(1);
  });

  /**
   * Subscriber reuse across handlers.
   *
   * A second handler must reuse the existing subscriber connection rather than
   * duplicating a new one, and removing one handler must not tear the bus down
   * while another remains.
   */
  it('reuses one subscriber for multiple handlers', async () => {
    const subscriber = new FakePubSubRedis(broker);
    const duplicate = jest.spyOn(pubB, 'duplicate').mockReturnValue(subscriber);

    const offFirst = await busB.subscribe(() => undefined);
    await busB.subscribe(() => undefined);
    await offFirst();

    expect(duplicate).toHaveBeenCalledTimes(1);
    expect(subscriber.quitCalls).toBe(0);
  });

  /**
   * Concurrent subscribe is idempotent.
   *
   * Two overlapping subscribe calls must create exactly one subscriber connection,
   * so a burst of feature registrations never opens redundant Redis clients.
   */
  it('creates a single subscriber under concurrent subscribe calls', async () => {
    const subscriber = new FakePubSubRedis(broker);
    const duplicate = jest.spyOn(pubB, 'duplicate').mockReturnValue(subscriber);

    await Promise.all([busB.subscribe(() => undefined), busB.subscribe(() => undefined)]);

    expect(duplicate).toHaveBeenCalledTimes(1);
  });

  /**
   * Publish failure degrades availability.
   *
   * When the publishing client rejects (Redis down), the bus must mark itself
   * unavailable and rethrow so the library can log the degradation and keep
   * serving locally.
   */
  it('marks the bus unavailable and rethrows when publish fails', async () => {
    pubA.armPublishFailure();

    await expect(busA.publish(message('broadcast', {}))).rejects.toThrow('publish failed');
    expect(busA.isAvailable).toBe(false);
  });

  /**
   * Publish success restores availability.
   *
   * A successful publish after a failure must flip the availability flag back so
   * the liveness probe reports recovery.
   */
  it('restores availability on a successful publish', async () => {
    pubA.armPublishFailure();
    await expect(busA.publish(message('broadcast', {}))).rejects.toThrow();

    await busA.publish(message('broadcast', {}));

    expect(busA.isAvailable).toBe(true);
  });

  /**
   * Subscribe failure rolls back.
   *
   * When the subscriber cannot be created, the handler registration must be rolled
   * back, the orphaned clone disconnected, the bus marked unavailable, and the
   * error surfaced so a later subscribe retries from scratch.
   */
  it('rolls back and disconnects when the subscriber cannot be created', async () => {
    const subscriber = new FakePubSubRedis(broker);
    subscriber.armSubscribeFailure();
    jest.spyOn(pubB, 'duplicate').mockReturnValue(subscriber);

    await expect(busB.subscribe(() => undefined)).rejects.toThrow('subscribe failed');
    expect(busB.isAvailable).toBe(false);
    expect(subscriber.disconnectCalls).toBe(1);
  });

  /**
   * Connection events drive availability.
   *
   * A dropped subscriber connection must flip availability to false, and a
   * re-established connection back to true, so the probe reflects a live Redis
   * outage and its recovery without needing an emit.
   */
  it('tracks availability from subscriber connection events', async () => {
    const subscriber = new FakePubSubRedis(broker);
    jest.spyOn(pubB, 'duplicate').mockReturnValue(subscriber);
    await busB.subscribe(() => undefined);
    expect(busB.isAvailable).toBe(true);

    subscriber.emit('close');
    expect(busB.isAvailable).toBe(false);

    subscriber.emit('ready');
    expect(busB.isAvailable).toBe(true);

    subscriber.emit('end');
    expect(busB.isAvailable).toBe(false);
  });

  /**
   * Idempotent close.
   *
   * Closing a bus that never subscribed must be a safe no-op, so shutdown paths
   * can call close unconditionally.
   */
  it('closes safely when no subscriber was ever created', async () => {
    await expect(busB.close()).resolves.toBeUndefined();
  });
});
