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

  return (
    <ol className="flex flex-col gap-2">
      {timeline.map((entry) => (
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
