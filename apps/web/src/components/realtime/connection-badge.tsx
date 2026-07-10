/**
 * @fileoverview Global connection status chip driven by `useRealtimeConnection`.
 * @layer components
 *
 * A deliberately independent, lightweight connection dedicated to status display:
 * the shell's data-bearing feed lives on the shared `RealtimeProvider` connection
 * (consumed elsewhere via `useRealtimeContext()`), while this badge opens its own
 * minimal SSE stream purely to exercise and display `useRealtimeConnection`
 * (connected / error / reconnect only, no event accumulation to render). Status
 * is encoded with color, an icon-like dot, and text together, never color alone.
 */
'use client';

import { useRealtimeConnection } from '@bymax-one/nest-realtime/react';

import { SSE_EVENTS_URL } from '@/lib/constants';
import { cn } from '@/lib/utils';

const STATUS_DOT_CLASS: Record<'live' | 'down', string> = {
  live: 'bg-(--color-success)',
  down: 'bg-(--color-danger)',
};

/** Global connection status chip shown in the topbar. */
export function ConnectionBadge() {
  const { connected, reconnect } = useRealtimeConnection({
    url: SSE_EVENTS_URL,
    withCredentials: true,
  });
  const state = connected ? 'live' : 'down';

  return (
    <button
      type="button"
      onClick={reconnect}
      title="Click to force a reconnect"
      className="inline-flex items-center gap-2 rounded-full border border-(--glass-border) bg-(--glass-bg) px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-(--glass-bg-hover)"
    >
      <span
        aria-hidden="true"
        className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_DOT_CLASS[state])}
      />
      <span className="font-mono">{connected ? 'live' : 'disconnected'}</span>
    </button>
  );
}
