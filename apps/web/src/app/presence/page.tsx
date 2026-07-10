/**
 * @fileoverview Presence roster: online users of the caller's own tenant.
 * @layer app
 *
 * `usePresence()` is a pure subscriber over the shared `RealtimeProvider`
 * connection (it opens no connection of its own), tracking `presence:online` /
 * `presence:offline` events already routed by the library's default named-event
 * listener set. `GET /presence/:tenantId` seeds the roster with who was already
 * online before this tab connected; the hook then keeps it live.
 */
'use client';

import { usePresence } from '@bymax-one/nest-realtime/react';
import { useEffect, useState } from 'react';

import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { ApiError, presenceApi } from '@/lib/api-client';
import { useSession } from '@/lib/session-context';

/** Presence roster page: online users of the caller's own tenant. */
export default function PresencePage() {
  const { traits } = useSession();
  const { onlineUserIds, count } = usePresence();
  const [seeded, setSeeded] = useState<readonly string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!traits) return;
    presenceApi
      .roster(traits.tenantId)
      .then((result) => setSeeded(result.online))
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Failed to load the roster'),
      );
  }, [traits]);

  const roster = Array.from(new Set([...seeded, ...onlineUserIds])).sort();

  return (
    <Card className="p-5">
      <CardTitle>Presence{traits ? ` (${traits.tenantId})` : ''}</CardTitle>
      <CardDescription>
        {count} update(s) observed live; roster seeded from the REST snapshot.
      </CardDescription>
      {error ? <p className="mt-3 text-xs text-(--color-danger)">{error}</p> : null}
      <div className="mt-4">
        {roster.length === 0 ? (
          <EmptyState title="No one online yet">
            Log in from another tab to see this roster update.
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
    </Card>
  );
}
