/**
 * @fileoverview Live Operations Board: the order/deployment event feed.
 * @layer app
 *
 * Consumes the shared `RealtimeProvider` connection via `useRealtimeContext()`
 * (matrix row 65: one `EventSource`, many consumers) rather than opening a new
 * `useRealtime` call, so this page's feed is exactly what the shell's connection
 * badge is monitoring. The simulate buttons call the domain endpoints, which emit
 * scripted `order.*` / `deployment.*` bursts to the caller's own tenant.
 */
'use client';

import { useRealtimeContext } from '@bymax-one/nest-realtime/react';
import { useState } from 'react';

import { EventInspector } from '@/components/realtime/event-inspector';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError, domainApi } from '@/lib/api-client';
import { toInspectorEntries } from '@/lib/events';

/** Run a domain simulator and surface any failure as page-local status text. */
function useSimulator(): {
  run: (kind: 'orders' | 'deployments') => Promise<void>;
  status: string | null;
} {
  const [status, setStatus] = useState<string | null>(null);

  const run = async (kind: 'orders' | 'deployments'): Promise<void> => {
    setStatus(null);
    try {
      await (kind === 'orders' ? domainApi.simulateOrders() : domainApi.simulateDeployments());
      setStatus(`${kind} burst accepted`);
    } catch (err) {
      setStatus(err instanceof ApiError ? err.message : 'Simulation failed');
    }
  };

  return { run, status };
}

/** Live Operations Board: order/deployment event feed plus simulate controls. */
export default function LiveFeedPage() {
  const { events } = useRealtimeContext();
  const { run, status } = useSimulator();

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader accent>
          <CardTitle>Live Operations Board</CardTitle>
          <CardDescription>
            Order and deployment lifecycle events, streamed over the shared SSE connection.
          </CardDescription>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={() => void run('orders')}>Simulate order burst</Button>
            <Button variant="outline" onClick={() => void run('deployments')}>
              Simulate deployment burst
            </Button>
            {status ? <span className="text-xs text-white/50">{status}</span> : null}
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event inspector</CardTitle>
          <CardDescription>Last 50 events, newest first.</CardDescription>
          <div className="mt-4">
            <EventInspector
              events={toInspectorEntries(events)}
              emptyTitle="No orders or deployments yet"
            />
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
