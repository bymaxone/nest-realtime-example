/**
 * @fileoverview Connections registry, kill switch, and the FIFO-eviction visualizer.
 * @layer app
 *
 * `GET /connections` lists every connection on the reached instance; it is
 * polled and additionally refreshed whenever the shared feed observes a
 * `connection:established` event. The eviction timeline reads the caller's own
 * history from `/labs/eviction/timeline`, since that endpoint is admin-only and
 * a non-admin session predictably gets a 403 there (shown as page text).
 */
'use client';

import { useRealtimeContext } from '@bymax-one/nest-realtime/react';
import { useCallback, useEffect, useState } from 'react';

import { EvictionTimeline } from '@/components/connections/eviction-timeline';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  ApiError,
  connectionsApi,
  evictionLabApi,
  type ConnectionMeta,
  type EvictionTimelineEntry,
} from '@/lib/api-client';
import { useSession } from '@/lib/session-context';

/** Poll interval for the connections list, in milliseconds. */
const POLL_MS = 5000;

/** Everything the connections page's JSX needs. */
interface ConnectionsRegistryState {
  readonly connections: readonly ConnectionMeta[];
  readonly instance: string | null;
  readonly timeline: readonly EvictionTimelineEntry[];
  readonly error: string | null;
  readonly disconnect: (connectionId: string) => void;
}

/** Loads a user's eviction timeline, tolerating the admin-only endpoint rejecting. */
function useEvictionTimeline(
  userId: string | undefined,
): [readonly EvictionTimelineEntry[], () => Promise<void>] {
  const [timeline, setTimeline] = useState<readonly EvictionTimelineEntry[]>([]);

  const load = useCallback(async (): Promise<void> => {
    if (!userId) return;
    try {
      const result = await evictionLabApi.timeline(userId);
      setTimeline(result.timeline);
    } catch {
      // Non-admin sessions cannot read the timeline; the visualizer stays empty.
      setTimeline([]);
    }
  }, [userId]);

  return [timeline, load];
}

/** Loads the connection list and eviction timeline, polling and reacting to live events. */
function useConnectionsRegistry(): ConnectionsRegistryState {
  const { traits } = useSession();
  const { lastEvent } = useRealtimeContext();
  const [connections, setConnections] = useState<readonly ConnectionMeta[]>([]);
  const [instance, setInstance] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeline, loadTimeline] = useEvictionTimeline(traits?.userId);

  const loadConnections = useCallback(async (): Promise<void> => {
    try {
      const result = await connectionsApi.list();
      setConnections(result.connections);
      setInstance(result.instance);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load connections');
    }
  }, []);

  useEffect(() => {
    void loadConnections();
    void loadTimeline();
    const timer = setInterval(() => void loadConnections(), POLL_MS);
    return () => clearInterval(timer);
  }, [loadConnections, loadTimeline]);

  useEffect(() => {
    if (lastEvent?.type === 'connection:established') {
      void loadConnections();
      void loadTimeline();
    }
  }, [lastEvent, loadConnections, loadTimeline]);

  const disconnect = (connectionId: string): void => {
    connectionsApi
      .disconnect(connectionId)
      .then(() => loadConnections())
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Failed to disconnect'),
      );
  };

  return { connections, instance, timeline, error, disconnect };
}

/** One connection row with an inline disconnect confirmation. */
function ConnectionRow({
  connection,
  onDisconnect,
}: {
  readonly connection: ConnectionMeta;
  readonly onDisconnect: (connectionId: string) => void;
}) {
  const [isConfirming, setConfirming] = useState(false);

  return (
    <li className="flex items-center justify-between rounded-lg border border-(--glass-border) bg-(--glass-bg) p-3 text-xs">
      <div className="flex items-center gap-3">
        <span className="font-mono text-white/70">{connection.userId}</span>
        <span className="text-white/40">{connection.transport}</span>
      </div>
      {isConfirming ? (
        <div className="flex items-center gap-2">
          <span className="text-white/50">Disconnect this connection?</span>
          <Button variant="destructive" onClick={() => onDisconnect(connection.connectionId)}>
            Confirm
          </Button>
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setConfirming(true)}>
          Disconnect
        </Button>
      )}
    </li>
  );
}

/** The connections list, or an empty state when none are visible. */
function ConnectionsList({
  connections,
  onDisconnect,
}: {
  readonly connections: readonly ConnectionMeta[];
  readonly onDisconnect: (connectionId: string) => void;
}) {
  if (connections.length === 0) {
    return (
      <EmptyState title="No active connections visible">
        Admin sessions see every connection on this instance.
      </EmptyState>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {connections.map((connection) => (
        <ConnectionRow
          key={connection.connectionId}
          connection={connection}
          onDisconnect={onDisconnect}
        />
      ))}
    </ul>
  );
}

/** Connections registry, kill switch, and the FIFO-eviction visualizer. */
export default function ConnectionsPage() {
  const { connections, instance, timeline, error, disconnect } = useConnectionsRegistry();

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <CardTitle>Connections{instance ? ` on ${instance}` : ''}</CardTitle>
        <CardDescription>
          Open a second tab (or lower `REALTIME_MAX_CONNECTIONS_PER_USER`) to watch the oldest
          connection evict as a new one is admitted.
        </CardDescription>
        {error ? <p className="mt-3 text-xs text-(--color-danger)">{error}</p> : null}
        <div className="mt-4">
          <ConnectionsList connections={connections} onDisconnect={disconnect} />
        </div>
      </Card>

      <Card className="p-5">
        <CardTitle>Eviction timeline</CardTitle>
        <CardDescription>Your own connections, oldest first.</CardDescription>
        <div className="mt-4">
          <EvictionTimeline timeline={timeline} />
        </div>
      </Card>
    </div>
  );
}
