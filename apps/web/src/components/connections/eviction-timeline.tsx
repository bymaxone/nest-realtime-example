/**
 * @fileoverview Signature component: a user's FIFO-eviction timeline.
 * @layer components
 *
 * Renders connections in `connectedAt` order (oldest first, matching the FIFO
 * policy) and tags each with an "evicted" reason chip when it was closed by
 * `sse.maxConnectionsPerUser`, versus a plain "closed" chip for any other close.
 */

import { StatusChip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import type { EvictionTimelineEntry } from '@/lib/api-client';

const EVICTION_REASON = 'REALTIME_TOO_MANY_CONNECTIONS';

/**
 * Newest entries rendered at once.
 *
 * The server retains hundreds of records, and a reconnect storm can fill that
 * history in seconds; rendering all of it produced a page tens of thousands of
 * pixels tall. The recent tail is what the lab is about, so older entries are
 * summarised rather than drawn.
 */
const VISIBLE_LIMIT = 25;

/** Props for {@link EvictionTimeline}. */
export interface EvictionTimelineProps {
  readonly timeline: readonly EvictionTimelineEntry[];
}

/** FIFO-eviction timeline: connections in `connectedAt` order, oldest first. */
export function EvictionTimeline({ timeline }: EvictionTimelineProps) {
  if (timeline.length === 0) {
    return (
      <EmptyState title="No connection history yet">
        Open a second tab to see FIFO eviction.
      </EmptyState>
    );
  }

  const hiddenCount = Math.max(0, timeline.length - VISIBLE_LIMIT);
  const visible = timeline.slice(-VISIBLE_LIMIT);

  return (
    <ol className="flex flex-col gap-2">
      {hiddenCount > 0 ? (
        <li className="px-1 pb-1 text-xs text-white/40">
          {hiddenCount} older {hiddenCount === 1 ? 'connection' : 'connections'} not shown.
        </li>
      ) : null}
      {visible.map((entry) => (
        <li
          key={entry.connectionId}
          className="flex items-center justify-between rounded-lg border border-(--glass-border) bg-(--glass-bg) p-3 text-xs"
        >
          <span className="font-mono text-white/60">{entry.connectionId}</span>
          <span className="text-white/40">{new Date(entry.connectedAt).toLocaleTimeString()}</span>
          {entry.evictedAt === null ? (
            <StatusChip tone="success">open</StatusChip>
          ) : entry.reason === EVICTION_REASON ? (
            <StatusChip tone="warning">evicted (FIFO)</StatusChip>
          ) : (
            <StatusChip tone="neutral">closed</StatusChip>
          )}
        </li>
      ))}
    </ol>
  );
}
