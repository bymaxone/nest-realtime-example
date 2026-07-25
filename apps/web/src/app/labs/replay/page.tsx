/**
 * @fileoverview Replay lab: emit-burst/drop controls and the recovery diff viewer.
 * @layer app
 *
 * Consumes the shared connection's `lab.replay` events (registered via the
 * provider's `events` option) to build the client's own received-sequence set,
 * then cross-references it with the server's `/labs/replay/timeline` recovery
 * picture through {@link tagReplayRanges}. `lastEventId` is read live from the
 * shared connection's `lastEvent`, so it reflects `Last-Event-ID` as the browser
 * actually tracks it.
 */
'use client';

import { useRealtimeContext } from '@bymax-one/nest-realtime/react';
import { useCallback, useEffect, useState } from 'react';

import { ReplayDiffViewer } from '@/components/realtime/replay-diff-viewer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Code } from '@/components/ui/code';
import { Input, Label } from '@/components/ui/input';
import { ApiError, replayLabApi, type ReplayTimelineView } from '@/lib/api-client';
import { tagReplayRanges, type ReplayDiffRow } from '@/lib/replay-diff';
import { useSession } from '@/lib/session-context';

interface LabReplayEventData {
  readonly seq: number;
}

/** Build the received-sequence set from the shared connection's accumulated events. */
function receivedSeqsFrom(
  events: ReadonlyArray<{ type: string; data: unknown }>,
): ReadonlySet<number> {
  return new Set(
    events
      .filter((entry) => entry.type === 'lab.replay')
      .map((entry) => (entry.data as LabReplayEventData).seq),
  );
}

/** Tag every server-recorded emission once a timeline is available. */
function tagRows(
  timeline: ReplayTimelineView | null,
  events: ReadonlyArray<{ type: string; data: unknown }>,
): readonly ReplayDiffRow[] {
  if (!timeline) return [];
  return tagReplayRanges({
    emissions: timeline.emissions,
    retainedSeqs: timeline.retainedSeqs,
    evictedSeqs: timeline.evictedSeqs,
    offlineQueuedSeqs: timeline.offlineQueued.map((entry) => entry.seq),
    receivedSeqs: receivedSeqsFrom(events),
  });
}

/** Everything the replay lab page's JSX needs. */
interface ReplayLabState {
  readonly count: number;
  readonly setCount: (count: number) => void;
  readonly status: string | null;
  readonly rows: readonly ReplayDiffRow[];
  readonly lastEventId: string;
  readonly emitBurst: () => void;
  readonly drop: () => void;
}

/** Loads the recovery timeline and owns the burst/drop actions. */
function useReplayLab(): ReplayLabState {
  const { traits } = useSession();
  const { events, lastEvent } = useRealtimeContext();
  const [count, setCount] = useState(15);
  const [timeline, setTimeline] = useState<ReplayTimelineView | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const loadTimeline = useCallback(async (): Promise<void> => {
    if (!traits) return;
    try {
      setTimeline(await replayLabApi.timeline(traits.userId));
    } catch {
      // Non-admin sessions cannot read their own timeline (admin-gated like eviction).
      setTimeline(null);
    }
  }, [traits]);

  useEffect(() => {
    void loadTimeline();
  }, [loadTimeline]);

  const emitBurst = (): void => {
    replayLabApi
      .emitBurst(count)
      .then((result) => {
        setStatus(`emitted ${result.emitted} event(s)`);
        return loadTimeline();
      })
      .catch((err: unknown) => setStatus(err instanceof ApiError ? err.message : 'Burst failed'));
  };

  const drop = (): void => {
    replayLabApi
      .drop()
      .then((result) =>
        setStatus(`dropped ${result.dropped} stream(s); reconnect will replay from Last-Event-ID`),
      )
      .catch((err: unknown) => setStatus(err instanceof ApiError ? err.message : 'Drop failed'));
  };

  return {
    count,
    setCount,
    status,
    rows: tagRows(timeline, events),
    lastEventId: lastEvent && 'id' in lastEvent ? lastEvent.id : 'n/a',
    emitBurst,
    drop,
  };
}

/** Burst-count input plus the emit-burst and drop-stream buttons. */
function BurstControls(
  lab: Pick<ReplayLabState, 'count' | 'setCount' | 'emitBurst' | 'drop' | 'lastEventId'>,
) {
  return (
    <div className="mt-4 flex flex-wrap items-end gap-3">
      <div>
        <Label htmlFor="burst-count">Burst count</Label>
        <Input
          id="burst-count"
          type="number"
          min={1}
          max={100}
          value={lab.count}
          onChange={(e) => lab.setCount(Number(e.target.value))}
          className="w-24"
        />
      </div>
      <Button onClick={lab.emitBurst}>Emit burst</Button>
      <Button variant="outline" onClick={lab.drop}>
        Drop my stream
      </Button>
      <span className="text-xs text-white/50">lastEventId: {lab.lastEventId}</span>
    </div>
  );
}

/** Replay lab page: burst/drop controls plus the live recovery diff viewer. */
export default function ReplayLabPage() {
  const lab = useReplayLab();

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader accent>
          <CardTitle>Replay lab</CardTitle>
          <CardDescription>
            Buffer size is configured small so the 11th event evicts the oldest; drop force-closes
            the stream so the reconnect replays from <Code>Last-Event-ID</Code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BurstControls {...lab} />
          {lab.status ? <p className="text-xs text-white/50">{lab.status}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recovery diff</CardTitle>
          <CardDescription>
            Each emitted sequence tagged live / buffer replay / queue replay / gap.
          </CardDescription>
          <div className="mt-4">
            <ReplayDiffViewer rows={lab.rows} />
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
