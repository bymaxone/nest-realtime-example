/**
 * @fileoverview Renders the realtime wiring the library resolved at boot.
 * @layer components
 *
 * Reads the api's introspection endpoint, which resolves the library's exported DI
 * tokens. It answers the question a reader of this example actually has: given the
 * options the app handed `forRootAsync`, what did the module end up using? Only
 * scalar options and provider class names appear, never a live principal.
 */

import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import type { RealtimeWiringSnapshot } from '@/lib/api-client';

/** Props for {@link WiringSnapshot}. */
export interface WiringSnapshotProps {
  /** The resolved snapshot, or `null` before it loads or when forbidden. */
  readonly snapshot: RealtimeWiringSnapshot | null;
}

/** One label/value row of the snapshot. */
function Row({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <li className="flex items-center justify-between rounded-lg border border-(--glass-border) bg-(--glass-bg) px-3 py-2 text-xs">
      <span className="text-white/50">{label}</span>
      <span className="font-mono text-white/70">{value}</span>
    </li>
  );
}

/** The resolved realtime wiring: transport, SSE options, and provider class names. */
export function WiringSnapshot({ snapshot }: WiringSnapshotProps) {
  if (!snapshot) {
    return (
      <EmptyState title="Wiring snapshot unavailable">
        The introspection endpoint is admin-only.
      </EmptyState>
    );
  }

  const { providers, sse } = snapshot;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Chip className="font-mono">transport: {snapshot.transport}</Chip>
        <Chip className="font-mono">serving: {snapshot.transportKind}</Chip>
        <Chip className="font-mono">instance: {snapshot.instanceId.slice(0, 8)}</Chip>
      </div>
      <ul className="flex flex-col gap-2">
        <Row label="Authenticator" value={providers.authenticator ?? 'none'} />
        <Row label="Lifecycle hooks" value={providers.hooks ?? 'none'} />
        <Row label="Pub/sub" value={providers.pubsub ?? 'none'} />
        <Row label="Presence storage" value={providers.presence ?? 'none'} />
        {sse ? (
          <>
            <Row label="SSE endpoint" value={sse.endpoint} />
            <Row label="Heartbeat" value={`${sse.heartbeatMs} ms`} />
            <Row label="Replay buffer" value={`${sse.replayBufferSize} events`} />
            <Row label="Max connections per user" value={String(sse.maxConnectionsPerUser)} />
          </>
        ) : null}
      </ul>
    </div>
  );
}
