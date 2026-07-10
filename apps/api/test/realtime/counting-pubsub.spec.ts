/**
 * Unit tests for CountingRealtimePubSub.
 *
 * Layer: unit.
 * Goal: publishes are counted only when accepted, and every remote message the
 *       inner bus forwards is counted and passed through to the handler.
 * Mocks: a stub inner IRealtimePubSub plus a real ClusterStatsService.
 */

import type { IRealtimePubSub, RealtimePubSubMessage } from '@bymax-one/nest-realtime';

import { ClusterStatsService } from '../../src/connections/cluster-stats.service';
import { CountingRealtimePubSub } from '../../src/realtime/counting-pubsub';
import { buildTestConfig } from '../support/config.fixture';

const message: RealtimePubSubMessage = { op: 'broadcast', args: {}, origin: 'peer' };

describe('CountingRealtimePubSub', () => {
  let stats: ClusterStatsService;

  beforeEach(() => {
    stats = new ClusterStatsService(buildTestConfig({ instanceName: 'app-a' }));
  });

  /**
   * Publish counts only on success.
   *
   * A message accepted by the inner bus must increment the published counter once,
   * so the origin instance reads exactly one publish per emit.
   */
  it('delegates publish and counts it once accepted', async () => {
    const inner: IRealtimePubSub = {
      publish: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn(),
    };
    const counting = new CountingRealtimePubSub(inner, stats);

    await counting.publish(message);

    expect(inner.publish).toHaveBeenCalledWith(message);
    expect(stats.snapshot().published).toBe(1);
  });

  /**
   * Failed publish is not counted.
   *
   * When the inner bus rejects (Redis outage), the error must propagate and the
   * published counter must stay put, since nothing fanned out.
   */
  it('does not count a rejected publish', async () => {
    const inner: IRealtimePubSub = {
      publish: jest.fn().mockRejectedValue(new Error('bus down')),
      subscribe: jest.fn(),
    };
    const counting = new CountingRealtimePubSub(inner, stats);

    await expect(counting.publish(message)).rejects.toThrow('bus down');
    expect(stats.snapshot().published).toBe(0);
  });

  /**
   * Remote deliveries are counted and passed through.
   *
   * Every message the inner bus forwards (already past its own-origin filter) must
   * increment the remote counter and still reach the library handler unchanged.
   */
  it('counts each forwarded remote message and passes it to the handler', async () => {
    let forward: ((msg: RealtimePubSubMessage) => void) | undefined;
    const unsubscribe = jest.fn().mockResolvedValue(undefined);
    const inner: IRealtimePubSub = {
      publish: jest.fn(),
      subscribe: jest.fn().mockImplementation((handler: (msg: RealtimePubSubMessage) => void) => {
        forward = handler;
        return Promise.resolve(unsubscribe);
      }),
    };
    const counting = new CountingRealtimePubSub(inner, stats);
    const received: RealtimePubSubMessage[] = [];

    const off = await counting.subscribe((msg) => received.push(msg));
    forward?.(message);

    expect(received).toEqual([message]);
    expect(stats.snapshot().receivedRemote).toBe(1);
    expect(off).toBe(unsubscribe);
  });
});
