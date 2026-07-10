/**
 * @fileoverview Replay lab: numbered bursts, stream drop, and the recovery timeline.
 * @layer replay
 *
 * Drives the observable half of `Last-Event-ID` recovery. A burst emits numbered
 * events through the library so they land in the per-user replay buffer (and, for
 * a disconnected user, the offline queue). Drop force-closes the caller's stream
 * through the library kill switch so the client reconnects. The timeline reports
 * which sequence numbers still sit inside the buffer window, which have aged out,
 * and which the durable queue can still cover, so a test or the UI can tell an
 * in-buffer replay apart from an offline-queue drain apart from an unrecoverable
 * gap.
 */

import {
  ConnectionRegistry,
  type IOfflineQueueStorage,
  REALTIME_OFFLINE_QUEUE_TOKEN,
  RealtimeService,
} from '@bymax-one/nest-realtime';
import { Inject, Injectable, Optional } from '@nestjs/common';

import { APP_CONFIG } from '../config/config.tokens';
import type { AppConfig } from '../config/env.loader';

import { type OfflineQueuedView, toOfflineView } from './offline-view';
import { type TimelineEntry, ReplayTimeline } from './replay-timeline';
import { MIN_EVENT_ID, PEEK_LIMIT, REPLAY_DROP_REASON, REPLAY_EVENT } from './replay.constants';

/** The full recovery picture for a user: emissions, buffer window, and queue. */
export interface ReplayTimelineView {
  readonly userId: string;
  readonly replayBufferSize: number;
  readonly emissions: readonly TimelineEntry[];
  readonly retainedSeqs: readonly number[];
  readonly evictedSeqs: readonly number[];
  readonly offlineQueued: readonly OfflineQueuedView[];
}

/** Emits replay bursts, drops streams, and composes the recovery timeline. */
@Injectable()
export class ReplayService {
  /**
   * Build the replay service.
   *
   * @param realtime - The library realtime API used to emit and disconnect.
   * @param registry - The library registry of active connections.
   * @param config - The frozen application configuration (for the buffer size).
   * @param timeline - The app-side record of emitted sequence numbers.
   * @param offlineQueue - The durable offline queue, when the profile enables it.
   */
  constructor(
    private readonly realtime: RealtimeService,
    private readonly registry: ConnectionRegistry,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly timeline: ReplayTimeline,
    @Optional()
    @Inject(REALTIME_OFFLINE_QUEUE_TOKEN)
    private readonly offlineQueue?: IOfflineQueueStorage,
  ) {}

  /**
   * Emit `count` numbered events to the caller's own user, resetting the record.
   *
   * @param userId - The caller's user id.
   * @param count - How many events to emit (payloads `{ seq: 1..count }`).
   * @returns The number of events emitted.
   */
  async burst(userId: string, count: number): Promise<number> {
    this.timeline.reset(userId);
    for (let seq = 1; seq <= count; seq += 1) {
      this.timeline.record(userId, seq);
      await this.realtime.emitToUser(userId, REPLAY_EVENT, { seq });
    }
    return count;
  }

  /**
   * Force-close every SSE stream the caller owns so the client reconnects.
   *
   * @param userId - The caller's user id.
   * @returns The number of streams closed.
   */
  async drop(userId: string): Promise<number> {
    const connections = this.registry.byUser(userId, 'sse');
    for (const connection of connections) {
      await this.realtime.disconnect(connection.connectionId, REPLAY_DROP_REASON);
    }
    return connections.length;
  }

  /**
   * Compose a user's recovery timeline from emissions, buffer window, and queue.
   *
   * @param userId - The user whose timeline is requested.
   * @returns The emissions plus the retained, evicted, and queued ranges.
   */
  async timelineFor(userId: string): Promise<ReplayTimelineView> {
    const emissions = this.timeline.entries(userId);
    const bufferSize = this.config.realtime.replayBufferSize;
    const retainedStart = Math.max(0, emissions.length - bufferSize);
    return {
      userId,
      replayBufferSize: bufferSize,
      emissions,
      retainedSeqs: emissions.slice(retainedStart).map((entry) => entry.seq),
      evictedSeqs: emissions.slice(0, retainedStart).map((entry) => entry.seq),
      offlineQueued: await this.readQueue(userId),
    };
  }

  /**
   * Read a user's durable queue and project each event onto the timeline view.
   *
   * @param userId - The user whose queue is read.
   * @returns The queued events with real ids, or an empty array when disabled.
   */
  private async readQueue(userId: string): Promise<OfflineQueuedView[]> {
    if (!this.offlineQueue) return [];
    const events = await this.offlineQueue.retrieveSince(userId, MIN_EVENT_ID, PEEK_LIMIT);
    return events.map(toOfflineView);
  }
}
