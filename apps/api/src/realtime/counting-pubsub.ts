/**
 * @fileoverview Pub/sub decorator that counts publishes and remote deliveries.
 * @layer realtime
 *
 * Wraps the real `IRealtimePubSub` so the cluster stats stay accurate without the
 * library ever knowing it is being measured. `publish` increments the published
 * counter only after the inner bus accepts the message (a failed publish during a
 * Redis outage is not counted, since nothing fanned out). `subscribe` counts every
 * message the inner bus forwards to the handler: the inner bus has already dropped
 * this instance's own-origin echoes, so the handler and therefore the counter only
 * ever see genuine remote messages. This is what makes the counters a proof of
 * exactly-once fan-out with no re-publish loop.
 */

import type { IRealtimePubSub, RealtimePubSubMessage } from '@bymax-one/nest-realtime';

import type { ClusterStatsService } from '../connections/cluster-stats.service';

/** Counts publishes and accepted remote deliveries around a real pub/sub bus. */
export class CountingRealtimePubSub implements IRealtimePubSub {
  /**
   * Build the counting decorator.
   *
   * @param inner - The real pub/sub bus every call delegates to.
   * @param stats - The counters incremented on publish and remote delivery.
   */
  constructor(
    private readonly inner: IRealtimePubSub,
    private readonly stats: ClusterStatsService,
  ) {}

  /**
   * Publish through the inner bus, counting the message only once it is accepted.
   *
   * @param message - The cross-instance message to fan out.
   * @throws When the inner bus rejects the publish (the count is not incremented).
   */
  async publish(message: RealtimePubSubMessage): Promise<void> {
    await this.inner.publish(message);
    this.stats.recordPublish();
  }

  /**
   * Subscribe through the inner bus, counting each remote message it forwards.
   *
   * @param handler - The library handler applied to every accepted remote message.
   * @returns The inner bus's async unsubscribe handle.
   */
  subscribe(handler: (message: RealtimePubSubMessage) => void): Promise<() => Promise<void>> {
    return this.inner.subscribe((message) => {
      this.stats.recordRemoteDelivery();
      handler(message);
    });
  }
}
