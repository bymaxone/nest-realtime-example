/**
 * @fileoverview Mounts a tuned `useRealtime` connection; unmounting disconnects it.
 * @layer components
 *
 * The public hook has no dedicated `autoConnect` flag or `connect()`/`disconnect()`
 * methods; the library's own contract is that its effect opens the connection on
 * mount and its cleanup closes it on unmount. Manual control is realized at the
 * app level by conditionally rendering this component instead: the parent
 * mounts it to "connect" and unmounts it to "disconnect".
 */
'use client';

import { useRealtime } from '@bymax-one/nest-realtime/react';

import { StatusChip } from '@/components/ui/chip';
import { SSE_EVENTS_URL } from '@/lib/constants';

/** Props for {@link ManagedConnection}. */
export interface ManagedConnectionProps {
  /** Initial backoff delay in ms before the first automatic reconnect. */
  readonly initialDelayMs: number;
  /** Maximum backoff delay in ms an automatic reconnect will wait. */
  readonly maxDelayMs: number;
  /** Stop automatic retries after this many consecutive failures. */
  readonly maxAttempts: number;
}

/**
 * A manually mounted/unmounted, backoff-tuned realtime connection.
 *
 * Mount with a changing `key` prop (see the connection lab page) to force a
 * brand-new connection and a reset attempts counter, e.g. after "kill my stream".
 */
export function ManagedConnection({
  initialDelayMs,
  maxDelayMs,
  maxAttempts,
}: ManagedConnectionProps) {
  const { connected, reconnectAttempts, reconnect } = useRealtime({
    url: SSE_EVENTS_URL,
    withCredentials: true,
    reconnectInitialMs: initialDelayMs,
    reconnectMaxMs: maxDelayMs,
    maxAttempts,
  });

  return (
    <div className="flex flex-wrap items-center gap-3">
      <StatusChip tone={connected ? 'success' : 'danger'}>
        {connected ? 'connected' : 'disconnected'}
      </StatusChip>
      <span className="text-xs text-white/50">reconnect attempts: {reconnectAttempts}</span>
      <button type="button" onClick={reconnect} className="text-xs text-brand-500 underline">
        force reconnect
      </button>
    </div>
  );
}
