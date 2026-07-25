/**
 * @fileoverview Cluster lab: per-instance fan-out counters, polled from both ports.
 * @layer app
 *
 * Polls `GET /labs/cluster/stats` on both cluster instances directly (3001 and
 * 3002, the compose profile's fixed ports) so the two cards can be read side by
 * side without going through nginx's sticky routing, which would otherwise
 * always land on the same instance for a given browser session. The demo emit
 * button targets the caller's own tenant so both instances report a change:
 * `published` on whichever instance served the emit, `receivedRemote` on the peer.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Code } from '@/components/ui/code';
import { ApiError, domainApi, type ClusterStats } from '@/lib/api-client';

/** The two cluster instance ports the compose profile fixes. */
const INSTANCE_PORTS: readonly number[] = [3001, 3002];

/** Poll interval for the stats cards, in milliseconds. */
const POLL_MS = 3000;

/** Fetch cluster stats directly from one instance port, tolerating it being down. */
async function fetchInstanceStats(port: number): Promise<ClusterStats | null> {
  try {
    const res = await fetch(`http://localhost:${port}/api/labs/cluster/stats`, {
      credentials: 'include',
    });
    if (!res.ok) return null;
    return (await res.json()) as ClusterStats;
  } catch {
    return null;
  }
}

/** One instance's stats card, or an "unreachable" placeholder when it did not answer. */
function InstanceStatsCard({
  port,
  stats,
}: {
  readonly port: number;
  readonly stats: ClusterStats | null;
}) {
  return (
    <div className="rounded-lg border border-(--glass-border) bg-(--glass-bg) p-4">
      <div className="font-mono text-xs text-white/50">:{port}</div>
      {stats ? (
        <div className="mt-2 flex flex-col gap-1 text-sm">
          <span>instance: {stats.instance}</span>
          <span>published: {stats.published}</span>
          <span>receivedRemote: {stats.receivedRemote}</span>
          <span>deliveredLocal: {stats.deliveredLocal}</span>
        </div>
      ) : (
        <div className="mt-2 text-xs text-white/30">unreachable (cluster profile not running)</div>
      )}
    </div>
  );
}

/** Cluster lab: per-instance fan-out counters plus a tenant-emit demo button. */
export default function ClusterLabPage() {
  const [stats, setStats] = useState<Record<number, ClusterStats | null>>({});
  const [status, setStatus] = useState<string | null>(null);

  const poll = useCallback(async (): Promise<void> => {
    const results = await Promise.all(INSTANCE_PORTS.map((port) => fetchInstanceStats(port)));
    setStats(
      Object.fromEntries(INSTANCE_PORTS.map((port, index) => [port, results[index] ?? null])),
    );
  }, []);

  useEffect(() => {
    void poll();
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(timer);
  }, [poll]);

  const triggerFanOut = async (): Promise<void> => {
    try {
      await domainApi.simulateOrders();
      setStatus('tenant emit sent; watch published/receivedRemote update on both instances');
    } catch (err) {
      setStatus(err instanceof ApiError ? err.message : 'Failed to trigger fan-out');
    }
  };

  return (
    <Card>
      <CardHeader accent>
        <CardTitle>Cluster lab</CardTitle>
        <CardDescription>
          Requires the <Code>cluster</Code> compose profile (two api instances behind nginx, sharing
          Redis pub/sub). Each card polls its instance directly on its fixed port.
        </CardDescription>
        <div className="mt-4">
          <Button onClick={() => void triggerFanOut()}>Trigger tenant fan-out</Button>
          {status ? <p className="mt-2 text-xs text-white/50">{status}</p> : null}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {INSTANCE_PORTS.map((port) => (
            <InstanceStatsCard key={port} port={port} stats={stats[port] ?? null} />
          ))}
        </div>
      </CardHeader>
    </Card>
  );
}
