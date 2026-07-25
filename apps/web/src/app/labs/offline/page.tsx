/**
 * @fileoverview Offline-queue lab: enqueue for an absent user, inspect, drain.
 * @layer app
 *
 * The only surface that exercises the library's `RedisOfflineQueue` end to end.
 * A burst is enqueued for a user with no live connection, the queue is inspected
 * while it waits, and the caller can acknowledge their own queue up to a
 * watermark to watch it drain.
 *
 * Delivery is gap-filling, not "everything on connect": the library only reads the
 * queue for a stream that arrives carrying `Last-Event-ID`, because that header is
 * what tells it where the client left off. A browser that has already held a
 * stream sends it automatically on reconnect; a first-ever connection has no gap to
 * fill and receives nothing. The page copy says so, since the distinction is the
 * whole point of the feature.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Chip, StatusChip } from '@/components/ui/chip';
import { Code } from '@/components/ui/code';
import { EmptyState } from '@/components/ui/empty-state';
import { Input, Label } from '@/components/ui/input';
import { ApiError, offlineLabApi, type OfflineQueuedView } from '@/lib/api-client';
import { useSession } from '@/lib/session-context';

/** Smallest burst the lab endpoint accepts. */
const MIN_BURST = 1;

/** Largest burst this control offers, within what the lab endpoint accepts. */
const MAX_BURST = 50;

/**
 * Resolve what the burst field currently means as a request parameter.
 *
 * The field is held as raw text so it can be cleared and retyped — clamping the
 * state on every keystroke would snap the value back mid-edit and make the next
 * character append to it. The text is instead read at the point of use: an empty
 * or unparseable field falls back to the smallest burst, and a value driven past
 * the control's bounds is trimmed into range, so the endpoint is never sent a
 * count it would reject.
 *
 * @param text - The field's raw contents.
 * @returns A whole burst size between {@link MIN_BURST} and {@link MAX_BURST}.
 */
function readBurstSize(text: string): number {
  const parsed = Number.parseInt(text, 10);
  if (!Number.isFinite(parsed)) return MIN_BURST;
  return Math.min(MAX_BURST, Math.max(MIN_BURST, parsed));
}

/** Everything the offline lab page's JSX needs. */
interface OfflineLabState {
  readonly targetUserId: string;
  readonly setTargetUserId: (value: string) => void;
  /** Raw contents of the burst field, so it can be cleared and retyped. */
  readonly countText: string;
  readonly setCountText: (value: string) => void;
  readonly queued: readonly OfflineQueuedView[];
  /** Id of the newest queued event, the watermark an acknowledge purges up to. */
  readonly newestQueuedId: string | undefined;
  readonly status: string | null;
  readonly isAdmin: boolean;
  readonly enqueue: () => void;
  readonly peek: () => void;
  readonly drain: (upToId: string) => void;
}

/** Owns the target selection, the enqueue/peek/drain actions and their status line. */
function useOfflineLab(): OfflineLabState {
  const { traits } = useSession();
  const [targetUserId, setTargetUserId] = useState('bob@acme');
  const [countText, setCountText] = useState('5');
  const [queued, setQueued] = useState<readonly OfflineQueuedView[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const report = (err: unknown, fallback: string): void =>
    setStatus(err instanceof ApiError ? err.message : fallback);

  const isAdmin = traits?.roles.includes('admin') ?? false;

  // The peek endpoint is admin-only, and this runs unprompted on mount and on
  // every target change. Firing it for a session that cannot use it would raise
  // an error banner contradicting the notice the page already shows.
  const peek = useCallback((): void => {
    if (!isAdmin) {
      setQueued([]);
      return;
    }
    offlineLabApi
      .peek(targetUserId)
      .then((result) => setQueued(result.events))
      .catch((err: unknown) => report(err, 'Failed to read the queue'));
  }, [targetUserId, isAdmin]);

  useEffect(() => peek(), [peek]);

  const enqueue = (): void => {
    offlineLabApi
      .emit(targetUserId, readBurstSize(countText))
      .then((result) => {
        setStatus(
          `enqueued ${result.emitted} ${result.emitted === 1 ? 'event' : 'events'} for ${targetUserId}`,
        );
        peek();
      })
      .catch((err: unknown) => report(err, 'Enqueue failed'));
  };

  // `ack` purges the CALLER's own queue, never the inspected user's, so the control
  // is only meaningful when they are the same principal. The watermark is taken from
  // state rather than looked up here, so the one condition that decides whether the
  // action is possible also decides whether the button is enabled.
  const drain = (upToId: string): void => {
    offlineLabApi
      .acknowledge(upToId)
      .then(() => {
        setStatus(`acknowledged up to ${upToId}`);
        peek();
      })
      .catch((err: unknown) => report(err, 'Acknowledge failed'));
  };

  return {
    targetUserId,
    setTargetUserId,
    countText,
    setCountText,
    queued,
    newestQueuedId: queued[queued.length - 1]?.id,
    status,
    isAdmin,
    enqueue,
    peek,
    drain,
  };
}

/** The target-user and burst-size fields plus the enqueue and inspect actions. */
function QueueControls(lab: OfflineLabState) {
  return (
    <div className="mt-4 flex flex-wrap items-end gap-3">
      <div>
        <Label htmlFor="offline-user">Target user</Label>
        <Input
          id="offline-user"
          value={lab.targetUserId}
          onChange={(e) => lab.setTargetUserId(e.target.value)}
          className="w-52 font-mono"
        />
      </div>
      <div>
        <Label htmlFor="offline-count">Burst size</Label>
        <Input
          id="offline-count"
          type="number"
          min={MIN_BURST}
          max={MAX_BURST}
          value={lab.countText}
          onChange={(e) => lab.setCountText(e.target.value)}
          className="w-24"
        />
      </div>
      <Button onClick={lab.enqueue} disabled={!lab.isAdmin}>
        Enqueue while offline
      </Button>
      <Button variant="outline" onClick={lab.peek} disabled={!lab.isAdmin}>
        Refresh queue
      </Button>
    </div>
  );
}

/** The queued-event list, or an empty state when the queue holds nothing. */
function QueueList({ queued }: { readonly queued: readonly OfflineQueuedView[] }) {
  if (queued.length === 0) {
    return (
      <EmptyState title="Queue is empty">
        Enqueue a burst for a user who has no live connection.
      </EmptyState>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {queued.map((event) => (
        <li
          key={event.id}
          className="flex items-center justify-between rounded-lg border border-(--glass-border) bg-(--glass-bg) p-3 text-xs"
        >
          <div className="flex items-center gap-3">
            <StatusChip tone="warning">queued</StatusChip>
            <span className="font-mono text-white/60">
              {event.seq === undefined ? 'no seq' : `#${event.seq}`}
            </span>
            <span className="font-mono text-white/30">{event.id}</span>
          </div>
          <span className="text-white/40">{new Date(event.emittedAt).toLocaleTimeString()}</span>
        </li>
      ))}
    </ul>
  );
}

/** Offline-queue lab page: enqueue for an absent user, inspect, drain. */
export default function OfflineLabPage() {
  const lab = useOfflineLab();
  const { traits } = useSession();
  const isOwnQueue = traits?.userId === lab.targetUserId;
  // Bound to a local so its narrowing survives into the click handler.
  const watermark = lab.newestQueuedId;

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader accent>
          <CardTitle>Offline queue lab</CardTitle>
          <CardDescription>
            Events emitted to a user with no live connection are durably queued by{' '}
            <Code>RedisOfflineQueue</Code>, then delivered to fill the gap when that user reconnects
            with a <Code>Last-Event-ID</Code>. A first-ever connection has no gap and receives
            nothing. Requires <Code>OFFLINE_QUEUE_ENABLED=true</Code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QueueControls {...lab} />
          {lab.isAdmin ? null : (
            <p className="text-xs text-white/40">
              Enqueuing and inspecting another user&apos;s queue requires the admin role.
            </p>
          )}
          {lab.status ? <p className="text-xs text-white/50">{lab.status}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col-reverse items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <CardTitle>Pending deliveries</CardTitle>
              <CardDescription>
                Newest last. Acknowledging purges up to the newest id, and only ever your own queue.
              </CardDescription>
            </div>
            <Chip className="shrink-0 font-mono">{lab.targetUserId}</Chip>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              variant="destructive"
              onClick={watermark === undefined ? undefined : () => lab.drain(watermark)}
              disabled={!isOwnQueue || watermark === undefined}
            >
              Acknowledge my queue
            </Button>
            {isOwnQueue ? null : (
              <span className="text-xs text-white/40">
                Sign in as this user to acknowledge their queue.
              </span>
            )}
          </div>
          <div className="mt-4">
            <QueueList queued={lab.queued} />
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
