/**
 * @fileoverview Presence roster: online users of the caller's own tenant.
 * @layer app
 *
 * `usePresence()` is a pure subscriber over the shared `RealtimeProvider`
 * connection (it opens no connection of its own), tracking the presence event
 * pair already routed by the library's default named-event listener set. The
 * hook only ever sees transitions this tab witnessed, so it cannot report who was
 * already online before the tab connected: `GET /presence/:tenantId` supplies
 * that snapshot, and every presence transition the hook observes re-reads it, so
 * a departure removes a seeded user instead of leaving them pinned online. The
 * hook's own count is surfaced beside the roster to show what it is tracking.
 */
'use client';

import { usePresence, useRealtimeContext } from '@bymax-one/nest-realtime/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { ApiError, presenceApi } from '@/lib/api-client';
import { PRESENCE_EVENT_NAME_SET } from '@/lib/events';
import { useSession } from '@/lib/session-context';

/** Presence roster page: online users of the caller's own tenant. */
export default function PresencePage() {
  const { traits } = useSession();
  const { count } = usePresence();
  const { lastEvent } = useRealtimeContext();
  const [roster, setRoster] = useState<readonly string[]>([]);
  const [error, setError] = useState<string | null>(null);
  // A presence transition can land while the mount read is still in flight, so
  // each read is numbered and only the newest may write. Without it a slow early
  // response could resolve last and restore a roster the transition superseded.
  const latestRead = useRef(0);

  const load = useCallback((): void => {
    if (!traits) return;
    const read = (latestRead.current += 1);
    presenceApi
      .roster(traits.tenantId)
      .then((result) => {
        if (read !== latestRead.current) return;
        setRoster([...result.online].sort());
        setError(null);
      })
      .catch((err: unknown) => {
        if (read !== latestRead.current) return;
        setError(err instanceof ApiError ? err.message : 'Failed to load the roster');
      });
  }, [traits]);

  useEffect(() => load(), [load]);

  useEffect(() => {
    if (lastEvent && PRESENCE_EVENT_NAME_SET.has(String(lastEvent.type))) load();
  }, [lastEvent, load]);

  return (
    <Card>
      <CardHeader accent>
        <CardTitle>Presence{traits ? ` (${traits.tenantId})` : ''}</CardTitle>
        <CardDescription>
          Seeded from the REST snapshot, then kept live by the presence hook, which is tracking{' '}
          {count === 1 ? '1 user' : `${count} users`} right now.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? <p className="text-xs text-(--color-danger)">{error}</p> : null}
        <div>
          {roster.length === 0 ? (
            <EmptyState title="No one online yet">
              Sign in as another demo user to see this roster update.
            </EmptyState>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {roster.map((userId) => (
                <li key={userId}>
                  <Chip>
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full bg-(--color-success)"
                    />
                    {userId}
                  </Chip>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
