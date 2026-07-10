/**
 * @fileoverview Mounts `useRealtime` bound to one already-fetched ticket.
 * @layer components
 *
 * Split out from the ticket lab page so the parent can swap the ticket by
 * re-mounting (via a `key`) or re-rendering this component with a new `ticket`
 * prop, which changes the connection URL and lets the library hook's own
 * effect open a fresh `EventSource` (the one-shot ticket is consumed on that
 * first request; the SAME url can never be reused for a genuine reconnect).
 * The ticket value itself is never rendered or logged - only the connection
 * state derived from it.
 */
'use client';

import { useRealtime } from '@bymax-one/nest-realtime/react';

import { StatusChip } from '@/components/ui/chip';
import { SSE_EVENTS_URL } from '@/lib/constants';

/** Props for {@link TicketConnection}. */
export interface TicketConnectionProps {
  /** The one-shot ticket to connect with. */
  readonly ticket: string;
}

/** Connects via `useRealtime` using a one-shot ticket on the SSE query string. */
export function TicketConnection({ ticket }: TicketConnectionProps) {
  const { connected, transport } = useRealtime({
    url: `${SSE_EVENTS_URL}?ticket=${encodeURIComponent(ticket)}`,
    transport: 'sse',
  });

  return (
    <div className="flex items-center gap-3">
      <StatusChip tone={connected ? 'success' : 'danger'}>
        {connected ? 'connected' : 'disconnected'}
      </StatusChip>
      <span className="text-xs text-white/40">transport: {transport}</span>
    </div>
  );
}
