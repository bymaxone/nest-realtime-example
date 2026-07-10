/**
 * Unit tests for OfflineService.
 *
 * Layer: unit.
 * Goal: emit enqueues only for a disconnected user and only when the queue is
 *       configured; peek and acknowledge require the queue and forward correctly.
 * Mocks: RealtimeService, ConnectionRegistry and IOfflineQueueStorage doubles; a
 *        real ReplayTimeline.
 */

import {
  ConnectionRegistry,
  type IOfflineQueueStorage,
  type OfflineQueuedEvent,
  RealtimeService,
} from '@bymax-one/nest-realtime';
import { ConflictException, ServiceUnavailableException } from '@nestjs/common';

import { OfflineService } from '../../src/replay/offline.service';
import { OFFLINE_EVENT } from '../../src/replay/replay.constants';
import { ReplayTimeline } from '../../src/replay/replay-timeline';

const USER = 'gil@globex';
const EMITTED_AT = new Date('2026-07-09T00:00:00.000Z');

/** A queued event fixture with a fixed-width id. */
function queued(seq: number): OfflineQueuedEvent {
  return {
    id: `1700000000000-${String(seq).padStart(6, '0')}`,
    event: 'lab.offline',
    data: { seq },
    emittedAt: EMITTED_AT,
  };
}

/** A minimal SSE connection record shape covering what emit reads. */
interface ConnectionLike {
  connectionId: string;
}

/** Build the service over doubles, optionally without a configured queue. */
function build(options: { connections?: ConnectionLike[]; withQueue?: boolean } = {}) {
  const emitToUser = jest.fn().mockResolvedValue(undefined);
  const realtime = { emitToUser } as unknown as RealtimeService;
  const byUser = jest.fn().mockReturnValue(options.connections ?? []);
  const registry = { byUser } as unknown as ConnectionRegistry;
  const retrieveSince = jest.fn().mockResolvedValue([]);
  const acknowledge = jest.fn().mockResolvedValue(undefined);
  const queue = { retrieveSince, acknowledge } as unknown as IOfflineQueueStorage;
  const timeline = new ReplayTimeline();
  const service = new OfflineService(
    realtime,
    registry,
    timeline,
    options.withQueue === false ? undefined : queue,
  );
  return { service, emitToUser, retrieveSince, acknowledge, timeline };
}

describe('OfflineService', () => {
  /**
   * Enqueue for a disconnected user.
   *
   * With the queue configured and the user offline, emit must send `count`
   * numbered events under the offline event name and record the sequence.
   */
  it('emits a numbered burst to a disconnected user', async () => {
    const { service, emitToUser, timeline } = build();

    const emitted = await service.emit(USER, 2);

    expect(emitted).toBe(2);
    expect(emitToUser.mock.calls).toEqual([
      [USER, OFFLINE_EVENT, { seq: 1 }],
      [USER, OFFLINE_EVENT, { seq: 2 }],
    ]);
    expect(timeline.entries(USER).map((entry) => entry.seq)).toEqual([1, 2]);
  });

  /**
   * Reject when the queue is unconfigured.
   *
   * Emitting without a configured queue must fail loudly rather than silently
   * emit to nobody, so a misconfigured profile is caught.
   */
  it('rejects emit when the offline queue is not configured', async () => {
    const { service, emitToUser } = build({ withQueue: false });

    await expect(service.emit(USER, 1)).rejects.toThrow(ServiceUnavailableException);
    expect(emitToUser).not.toHaveBeenCalled();
  });

  /**
   * Reject when the user is connected.
   *
   * Emitting to a user with a live connection would deliver instead of queue, so
   * it must be a conflict and must never emit.
   */
  it('rejects emit when the user has a live connection', async () => {
    const { service, emitToUser } = build({ connections: [{ connectionId: 'c1' }] });

    await expect(service.emit(USER, 1)).rejects.toThrow(ConflictException);
    expect(emitToUser).not.toHaveBeenCalled();
  });

  /**
   * Peek from the minimal cursor.
   *
   * Peek must read the whole queue from the minimal id and project each event to
   * its client-safe view.
   */
  it('lists queued events projected to the client view', async () => {
    const { service, retrieveSince } = build();
    retrieveSince.mockResolvedValue([queued(1), queued(2)]);

    const events = await service.peek(USER);

    expect(retrieveSince).toHaveBeenCalledWith(USER, '0', 500);
    expect(events).toEqual([
      { seq: 1, id: queued(1).id, emittedAt: EMITTED_AT.toISOString() },
      { seq: 2, id: queued(2).id, emittedAt: EMITTED_AT.toISOString() },
    ]);
  });

  /**
   * Peek requires the queue.
   *
   * Inspecting a queue that is not configured must fail rather than return a
   * misleading empty list.
   */
  it('rejects peek when the offline queue is not configured', async () => {
    const { service } = build({ withQueue: false });

    await expect(service.peek(USER)).rejects.toThrow(ServiceUnavailableException);
  });

  /**
   * Acknowledge forwards the watermark.
   *
   * Acknowledge must purge the caller's queue up to the given id via the storage
   * contract.
   */
  it('acknowledges up to the given watermark', async () => {
    const { service, acknowledge } = build();

    await service.acknowledge(USER, queued(2).id);

    expect(acknowledge).toHaveBeenCalledWith(USER, queued(2).id);
  });

  /**
   * Acknowledge requires the queue.
   *
   * Purging a queue that is not configured must fail rather than silently no-op.
   */
  it('rejects acknowledge when the offline queue is not configured', async () => {
    const { service } = build({ withQueue: false });

    await expect(service.acknowledge(USER, 'x')).rejects.toThrow(ServiceUnavailableException);
  });
});
