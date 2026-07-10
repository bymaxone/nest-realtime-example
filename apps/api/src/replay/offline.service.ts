/**
 * @fileoverview Offline lab: enqueue for a disconnected user, inspect, and purge.
 * @layer replay
 *
 * The "was fully offline" half of recovery. Emitting to a user with no live
 * connection lets the library append to the durable queue; the lab then inspects
 * the queue (peek) and purges it (acknowledge). Every method requires the offline
 * queue to be configured, so a misconfigured profile fails loudly instead of
 * silently dropping events. Emitting to a user who is actually connected is
 * rejected, because the library would deliver live and never enqueue, which would
 * make the demo lie about what it proves.
 */

import {
  ConnectionRegistry,
  type IOfflineQueueStorage,
  REALTIME_OFFLINE_QUEUE_TOKEN,
  RealtimeService,
} from '@bymax-one/nest-realtime';
import {
  ConflictException,
  Inject,
  Injectable,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';

import { type OfflineQueuedView, toOfflineView } from './offline-view';
import { ReplayTimeline } from './replay-timeline';
import { MIN_EVENT_ID, OFFLINE_EVENT, PEEK_LIMIT } from './replay.constants';

/** Enqueues events for offline users, inspects the queue, and purges it. */
@Injectable()
export class OfflineService {
  /**
   * Build the offline service.
   *
   * @param realtime - The library realtime API used to emit.
   * @param registry - The library registry of active connections.
   * @param timeline - The app-side record of emitted sequence numbers.
   * @param offlineQueue - The durable offline queue, when the profile enables it.
   */
  constructor(
    private readonly realtime: RealtimeService,
    private readonly registry: ConnectionRegistry,
    private readonly timeline: ReplayTimeline,
    @Optional()
    @Inject(REALTIME_OFFLINE_QUEUE_TOKEN)
    private readonly offlineQueue?: IOfflineQueueStorage,
  ) {}

  /**
   * Emit `count` numbered events to a user who currently has no live connection.
   *
   * @param userId - The target (disconnected) user.
   * @param count - How many events to enqueue (payloads `{ seq: 1..count }`).
   * @returns The number of events emitted.
   * @throws ServiceUnavailableException when the offline queue is not configured.
   * @throws ConflictException when the user has a live connection (nothing queues).
   */
  async emit(userId: string, count: number): Promise<number> {
    this.requireQueue();
    if (this.registry.byUser(userId, 'sse').length > 0) {
      throw new ConflictException('user has a live connection; events would deliver, not queue');
    }
    this.timeline.reset(userId);
    for (let seq = 1; seq <= count; seq += 1) {
      this.timeline.record(userId, seq);
      await this.realtime.emitToUser(userId, OFFLINE_EVENT, { seq });
    }
    return count;
  }

  /**
   * List a user's queued events, oldest first.
   *
   * @param userId - The user whose queue is inspected.
   * @returns The queued events projected onto their client-safe view.
   * @throws ServiceUnavailableException when the offline queue is not configured.
   */
  async peek(userId: string): Promise<OfflineQueuedView[]> {
    const queue = this.requireQueue();
    const events = await queue.retrieveSince(userId, MIN_EVENT_ID, PEEK_LIMIT);
    return events.map(toOfflineView);
  }

  /**
   * Purge a user's queued events up to and including `upToId`.
   *
   * @param userId - The user whose queue is purged.
   * @param upToId - The delivery watermark; events with `id <= upToId` are removed.
   * @throws ServiceUnavailableException when the offline queue is not configured.
   */
  async acknowledge(userId: string, upToId: string): Promise<void> {
    const queue = this.requireQueue();
    await queue.acknowledge(userId, upToId);
  }

  /**
   * Return the configured offline queue or reject when the profile disabled it.
   *
   * @returns The configured offline queue.
   * @throws ServiceUnavailableException when the offline queue is not configured.
   */
  private requireQueue(): IOfflineQueueStorage {
    if (!this.offlineQueue) {
      throw new ServiceUnavailableException('offline queue is not configured');
    }
    return this.offlineQueue;
  }
}
