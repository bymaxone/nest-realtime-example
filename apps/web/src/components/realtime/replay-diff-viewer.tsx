/**
 * @fileoverview Signature component: tags every emission as live/buffer/queue/gap.
 * @layer components
 */

import { StatusChip, type ChipTone } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import type { ReplayDiffRow, ReplayRangeTag } from '@/lib/replay-diff';

const TAG_TONE: Record<ReplayRangeTag, ChipTone> = {
  live: 'success',
  buffer: 'info',
  queue: 'warning',
  gap: 'danger',
};

/** Props for {@link ReplayDiffViewer}. */
export interface ReplayDiffViewerProps {
  readonly rows: readonly ReplayDiffRow[];
}

/** Renders each emitted sequence number tagged by how it was (or wasn't) recovered. */
export function ReplayDiffViewer({ rows }: ReplayDiffViewerProps) {
  if (rows.length === 0) {
    return (
      <EmptyState title="No burst emitted yet">
        Click emit-burst to populate the diff viewer.
      </EmptyState>
    );
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {rows.map((row) => (
        <li key={row.seq}>
          <StatusChip tone={TAG_TONE[row.tag]}>
            #{row.seq} {row.tag}
          </StatusChip>
        </li>
      ))}
    </ul>
  );
}
