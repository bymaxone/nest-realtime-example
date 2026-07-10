/**
 * Unit tests for ReplayService.
 *
 * Layer: unit.
 * Goal: burst emits numbered events and records them; drop force-closes every
 *       caller stream; the timeline splits retained vs evicted seqs and surfaces
 *       the queue with real ids, or an empty queue when none is configured.
 * Mocks: RealtimeService, ConnectionRegistry and IOfflineQueueStorage doubles; a
 *        real ReplayTimeline.
 */

import {
  ConnectionRegistry,
  type IOfflineQueueStorage,
  type OfflineQueuedEvent,
  RealtimeService,
} from '@bymax-one/nest-realtime';

import { ReplayService } from '../../src/replay/replay.service';
import { ReplayTimeline } from '../../src/replay/replay-timeline';
import { REPLAY_DROP_REASON, REPLAY_EVENT } from '../../src/replay/replay.constants';
import { buildTestConfig } from '../support/config.fixture';

const USER = 'ana@acme';
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

/** A minimal SSE connection record shape covering what drop reads. */
interface ConnectionLike {
  connectionId: string;
}

/** Build the service over doubles, with a fresh in-memory timeline. */
function build(options: {
  bufferSize?: number;
  connections?: ConnectionLike[];
  withQueue?: boolean;
}) {
  const emitToUser = jest.fn().mockResolvedValue(undefined);
  const disconnect = jest.fn().mockResolvedValue(undefined);
  const realtime = { emitToUser, disconnect } as unknown as RealtimeService;
  const byUser = jest.fn().mockReturnValue(options.connections ?? []);
  const registry = { byUser } as unknown as ConnectionRegistry;
  const retrieveSince = jest.fn().mockResolvedValue([]);
  const queue = { retrieveSince } as unknown as IOfflineQueueStorage;
  const timeline = new ReplayTimeline();
  const config = buildTestConfig({ realtime: { replayBufferSize: options.bufferSize ?? 10 } });
  const service = new ReplayService(
    realtime,
    registry,
    config,
    timeline,
    options.withQueue === false ? undefined : queue,
  );
  return { service, emitToUser, disconnect, byUser, retrieveSince, timeline };
}

describe('ReplayService', () => {
  /**
   * Numbered burst.
   *
   * A burst must emit exactly `count` events, each carrying its 1-based seq under
   * the replay event name, and record the same sequence for the timeline.
   */
  it('emits and records a numbered burst to the caller', async () => {
    const { service, emitToUser, timeline } = build({});

    const emitted = await service.burst(USER, 3);

    expect(emitted).toBe(3);
    expect(emitToUser.mock.calls).toEqual([
      [USER, REPLAY_EVENT, { seq: 1 }],
      [USER, REPLAY_EVENT, { seq: 2 }],
      [USER, REPLAY_EVENT, { seq: 3 }],
    ]);
    expect(timeline.entries(USER).map((entry) => entry.seq)).toEqual([1, 2, 3]);
  });

  /**
   * Burst resets the record.
   *
   * A second burst must reset the user's record so the sequence restarts at 1
   * rather than accumulating across scenarios.
   */
  it('resets the record on each burst', async () => {
    const { service, timeline } = build({});

    await service.burst(USER, 2);
    await service.burst(USER, 1);

    expect(timeline.entries(USER).map((entry) => entry.seq)).toEqual([1]);
  });

  /**
   * Drop closes every caller stream.
   *
   * Drop must force-close each of the caller's SSE connections with the drop
   * reason and report how many it closed.
   */
  it('force-closes every stream the caller owns', async () => {
    const { service, disconnect } = build({
      connections: [{ connectionId: 'c1' }, { connectionId: 'c2' }],
    });

    const dropped = await service.drop(USER);

    expect(dropped).toBe(2);
    expect(disconnect.mock.calls).toEqual([
      ['c1', REPLAY_DROP_REASON],
      ['c2', REPLAY_DROP_REASON],
    ]);
  });

  /**
   * Drop with no streams.
   *
   * With no live connection, drop must close nothing and report zero rather than
   * throw.
   */
  it('closes nothing when the caller has no stream', async () => {
    const { service, disconnect } = build({ connections: [] });

    expect(await service.drop(USER)).toBe(0);
    expect(disconnect).not.toHaveBeenCalled();
  });

  /**
   * Timeline range split.
   *
   * With a buffer of 3 and five emissions, the newest three seqs are retained and
   * the oldest two are evicted, and the queue is surfaced with real ids.
   */
  it('splits retained from evicted seqs and surfaces the queue', async () => {
    const { service, retrieveSince } = build({ bufferSize: 3 });
    retrieveSince.mockResolvedValue([queued(1), queued(2)]);
    await service.burst(USER, 5);

    const view = await service.timelineFor(USER);

    expect(view.replayBufferSize).toBe(3);
    expect(view.emissions.map((entry) => entry.seq)).toEqual([1, 2, 3, 4, 5]);
    expect(view.retainedSeqs).toEqual([3, 4, 5]);
    expect(view.evictedSeqs).toEqual([1, 2]);
    expect(view.offlineQueued).toEqual([
      { seq: 1, id: queued(1).id, emittedAt: EMITTED_AT.toISOString() },
      { seq: 2, id: queued(2).id, emittedAt: EMITTED_AT.toISOString() },
    ]);
  });

  /**
   * Timeline without a queue.
   *
   * When no offline queue is configured, the timeline must report an empty queue
   * rather than fail, so the pure-buffer profile still serves a timeline.
   */
  it('reports an empty queue when none is configured', async () => {
    const { service } = build({ withQueue: false });
    await service.burst(USER, 2);

    const view = await service.timelineFor(USER);

    expect(view.offlineQueued).toEqual([]);
    expect(view.retainedSeqs).toEqual([1, 2]);
    expect(view.evictedSeqs).toEqual([]);
  });
});
