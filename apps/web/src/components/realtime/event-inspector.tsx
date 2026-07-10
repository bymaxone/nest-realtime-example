/**
 * @fileoverview Signature component: last 50 realtime events, newest first.
 * @layer components
 *
 * Renders each event's type, id (monospace), JSON payload, and arrival time.
 * Payloads are rendered as text content inside `<pre>` (via `JSON.stringify`),
 * never as HTML, so an attacker-controlled event payload can never execute as
 * markup. Arrival time is stamped client-side the first time an entry is seen
 * (the hook does not carry one), keyed by object identity in a `WeakMap` so a
 * re-render never re-stamps an already-seen entry.
 */
'use client';

import { useEffect, useRef, useState } from 'react';

import { EmptyState } from '@/components/ui/empty-state';

/** One realtime event, shaped the way `useRealtime`'s `events` array returns it. */
export interface EventInspectorEntry {
  readonly type: string;
  readonly data: unknown;
  readonly id?: string;
}

/** Maximum number of entries rendered (newest first). */
const MAX_VISIBLE = 50;

/** Props for {@link EventInspector}. */
export interface EventInspectorProps {
  /** The accumulated events, oldest first (as the hook returns them). */
  readonly events: readonly EventInspectorEntry[];
  /** Empty-state copy shown when no event has arrived yet. */
  readonly emptyTitle?: string;
}

/** Stamp `Date.now()` for every entry not already tracked, without re-stamping. */
function useArrivalTimes(
  events: readonly EventInspectorEntry[],
): WeakMap<EventInspectorEntry, number> {
  const arrivalsRef = useRef(new WeakMap<EventInspectorEntry, number>());
  const [, forceTick] = useState(0);

  useEffect(() => {
    let sawNew = false;
    for (const entry of events) {
      if (!arrivalsRef.current.has(entry)) {
        arrivalsRef.current.set(entry, Date.now());
        sawNew = true;
      }
    }
    if (sawNew) forceTick((n) => n + 1);
  }, [events]);

  return arrivalsRef.current;
}

/** Last-50, newest-first inspector for a realtime event stream. */
export function EventInspector({ events, emptyTitle = 'No events yet' }: EventInspectorProps) {
  const arrivals = useArrivalTimes(events);
  const newestFirst = [...events].reverse().slice(0, MAX_VISIBLE);

  if (newestFirst.length === 0) {
    return (
      <EmptyState title={emptyTitle}>Trigger a simulate action to see live events here.</EmptyState>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {newestFirst.map((entry, index) => {
        const arrivedAt = arrivals.get(entry);
        return (
          <li
            key={entry.id ?? `${entry.type}-${index}`}
            className="rounded-lg border border-(--glass-border) bg-(--glass-bg) p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs font-semibold text-brand-500">{entry.type}</span>
              <span className="font-mono text-[11px] text-white/40">{entry.id ?? 'n/a'}</span>
            </div>
            <pre className="mt-2 overflow-x-auto text-[11px] text-white/60">
              {JSON.stringify(entry.data, null, 2)}
            </pre>
            <div className="mt-1 text-[10px] text-white/30">
              {arrivedAt ? new Date(arrivedAt).toLocaleTimeString() : 'n/a'}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
