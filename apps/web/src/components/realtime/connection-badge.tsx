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

import { Button } from '@/components/ui/button';
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
    <Button
      size="sm"
      variant="outline"
      onClick={reconnect}
      aria-label="Connection status. Activate to force a reconnect."
      title="Click to force a reconnect"
      // A fixed width keeps the top bar from reflowing every time the label
      // swaps between the short and long status word.
      className="w-[8.5rem] font-mono"
    >
      <span
        aria-hidden="true"
        className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_DOT_CLASS[state])}
      />
      {connected ? 'live' : 'disconnected'}
    </Button>
  );
}
