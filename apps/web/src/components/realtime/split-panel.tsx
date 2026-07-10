/**
 * @fileoverview One transport panel for the split-screen "both" lab.
 * @layer components
 */
'use client';

import { useRealtime, type UseRealtimeOptions } from '@bymax-one/nest-realtime/react';
import { useEffect } from 'react';

import { StatusChip } from '@/components/ui/chip';

interface LabBothEventData {
  readonly nonce: string;
}

/** Props for {@link SplitPanel}. */
export interface SplitPanelProps {
  /** Panel heading, e.g. "SSE" or "WebSocket". */
  readonly label: string;
  /** Options forwarded to `useRealtime` for this panel's own connection. */
  readonly options: UseRealtimeOptions;
  /** Called whenever this panel observes a fresh `lab.both` nonce. */
  readonly onNonce: (nonce: string) => void;
}

/** One transport panel: its own `useRealtime` connection plus the last nonce seen. */
export function SplitPanel({ label, options, onNonce }: SplitPanelProps) {
  const { connected, lastEvent, transport } = useRealtime(options);

  useEffect(() => {
    if (lastEvent?.type === 'lab.both') {
      onNonce((lastEvent.data as LabBothEventData).nonce);
    }
  }, [lastEvent, onNonce]);

  return (
    <div className="rounded-lg border border-(--glass-border) bg-(--glass-bg) p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm">{label}</span>
        <StatusChip tone={connected ? 'success' : 'danger'}>
          {connected ? 'connected' : 'disconnected'}
        </StatusChip>
      </div>
      <div className="mt-2 text-xs text-white/40">detected transport: {transport}</div>
    </div>
  );
}
