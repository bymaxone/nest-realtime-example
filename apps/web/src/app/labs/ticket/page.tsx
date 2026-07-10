/**
 * @fileoverview Ticket lab: connects via the one-shot `POST /auth/ticket` flow.
 * @layer app
 *
 * The shipped `useRealtime` hook has no `fetchTicket` callback (its `auth`
 * option only accepts a pre-resolved `{ ticket, token }` pair for the WebSocket
 * handshake); the SSE ticket pattern is a URL query parameter instead (the
 * library's ticket authenticator reads it from `req.query`, and `EventSource`
 * cannot send a custom header or body). Reconnect is therefore driven at the
 * app level: each click fetches a brand-new ticket and re-renders
 * `TicketConnection` with it, which changes the hook's `url` and lets its own
 * effect open a fresh `EventSource` - proving the one-shot behavior (a reused
 * ticket is rejected; only a freshly minted one connects).
 */
'use client';

import { useEffect, useState } from 'react';

import { TicketConnection } from '@/components/realtime/ticket-connection';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { ApiError, authApi } from '@/lib/api-client';

/** Ticket lab page: one-shot ticket auth flow. */
export default function TicketLabPage() {
  const [ticket, setTicket] = useState<string | null>(null);
  const [fetchCount, setFetchCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fetchTicket = async (): Promise<void> => {
    try {
      const result = await authApi.issueTicket();
      setTicket(result.ticket);
      setFetchCount((count) => count + 1);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to fetch a ticket');
    }
  };

  useEffect(() => {
    void fetchTicket();
  }, []);

  return (
    <Card className="p-5">
      <CardTitle>Ticket lab</CardTitle>
      <CardDescription>
        Each connect consumes a fresh one-shot ticket (60s TTL, get-and-delete). Reconnecting with
        the same ticket is rejected by design.
      </CardDescription>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={() => void fetchTicket()}>Reconnect with a fresh ticket</Button>
        <span className="text-xs text-white/50">tickets fetched: {fetchCount}</span>
      </div>
      {error ? <p className="mt-3 text-xs text-(--color-danger)">{error}</p> : null}
      <div className="mt-4">
        {ticket ? <TicketConnection key={fetchCount} ticket={ticket} /> : null}
      </div>
    </Card>
  );
}
