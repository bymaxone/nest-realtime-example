/**
 * @fileoverview Reauthentication lab: the revocation switch and the revalidation counters.
 * @layer app
 *
 * The only surface that exercises the library's reauthentication policy from the
 * frontend. Revoking a user marks them in the shared revocation store; on the next
 * reauth cycle the library's `revalidate` call fails for every one of their live
 * connections and, under `REAUTH_ON_FAILURE=disconnect`, closes them. The
 * revalidation counters make the positive-result cache observable: they stay well
 * below the number of cycles while the cache is warm.
 *
 * The reserved reauthentication-failed event is announced only under
 * `REAUTH_ON_FAILURE=event`; the shipped `disconnect` policy closes the stream
 * without a word. The last card says so, so an empty list reads as the configured
 * behavior rather than a broken page.
 */
'use client';

import { useRealtimeContext } from '@bymax-one/nest-realtime/react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusChip } from '@/components/ui/chip';
import { Code } from '@/components/ui/code';
import { EmptyState } from '@/components/ui/empty-state';
import { Input, Label } from '@/components/ui/input';
import { ApiError, reauthLabApi, type RevalidationCount } from '@/lib/api-client';
import { REAUTH_FAILED_EVENT_NAME } from '@/lib/events';
import { useSession } from '@/lib/session-context';

/** Poll interval for the revalidation counters, in milliseconds. */
const POLL_MS = 3000;

/** Everything the reauth lab page's JSX needs. */
interface ReauthLabState {
  readonly targetUserId: string;
  readonly setTargetUserId: (value: string) => void;
  readonly counts: readonly RevalidationCount[];
  readonly status: string | null;
  readonly isAdmin: boolean;
  readonly revoke: () => void;
  readonly restore: () => void;
}

/** Owns the revoke/restore actions and polls the revalidation counters. */
function useReauthLab(): ReauthLabState {
  const { traits } = useSession();
  // `null` means the field has not been touched, so it follows the session identity
  // as it resolves. Defaulting on "is empty" instead would refill the field the
  // moment an operator cleared it to type a different user.
  const [chosenUserId, setChosenUserId] = useState<string | null>(null);
  const [counts, setCounts] = useState<readonly RevalidationCount[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const targetUserId = chosenUserId ?? traits?.userId ?? '';

  const load = useCallback((): void => {
    reauthLabApi
      .stats()
      .then((result) => setCounts(result.revalidations))
      .catch(() => setCounts([]));
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const act = (action: 'revoke' | 'restore'): void => {
    // An operator can clear the field, and an empty id would build
    // `/auth/revoke/` — a different route from `/auth/revoke/:userId` — so the
    // request is refused here rather than sent as a confusing server error.
    const userId = targetUserId.trim();
    if (userId === '') {
      setStatus('Enter a user id to revoke or restore.');
      return;
    }
    const call = action === 'revoke' ? reauthLabApi.revoke : reauthLabApi.restore;
    call(userId)
      .then((ack) =>
        setStatus(
          ack.revoked
            ? `${ack.userId} revoked; their streams close on the next reauth cycle`
            : `${ack.userId} restored; new connections authenticate again`,
        ),
      )
      .catch((err: unknown) =>
        setStatus(err instanceof ApiError ? err.message : `Failed to ${action} the user`),
      );
  };

  return {
    targetUserId,
    setTargetUserId: setChosenUserId,
    counts,
    status,
    isAdmin: traits?.roles.includes('admin') ?? false,
    revoke: () => act('revoke'),
    restore: () => act('restore'),
  };
}

/** The target field plus the revoke and restore actions. */
function RevocationControls(lab: ReauthLabState) {
  return (
    <div className="mt-4 flex flex-wrap items-end gap-3">
      <div>
        <Label htmlFor="reauth-user">Target user</Label>
        <Input
          id="reauth-user"
          value={lab.targetUserId}
          onChange={(e) => lab.setTargetUserId(e.target.value)}
          className="w-52 font-mono"
        />
      </div>
      <Button variant="destructive" onClick={lab.revoke} disabled={!lab.isAdmin}>
        Revoke sessions
      </Button>
      <Button variant="outline" onClick={lab.restore} disabled={!lab.isAdmin}>
        Restore
      </Button>
    </div>
  );
}

/** The per-user revalidation counters, or an empty state before the first cycle. */
function RevalidationCounts({ counts }: { readonly counts: readonly RevalidationCount[] }) {
  if (counts.length === 0) {
    return (
      <EmptyState title="No revalidation observed yet">
        Counters appear once a reauth cycle has run for a live connection.
      </EmptyState>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {counts.map((entry) => (
        <li
          key={entry.userId}
          className="flex items-center justify-between rounded-lg border border-(--glass-border) bg-(--glass-bg) p-3 text-xs"
        >
          <span className="font-mono text-white/60">{entry.userId}</span>
          <span className="text-white/40">
            {entry.revalidations} {entry.revalidations === 1 ? 'revalidation' : 'revalidations'}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Reauthentication lab page: revocation switch plus the revalidation counters. */
export default function ReauthLabPage() {
  const lab = useReauthLab();
  const { events } = useRealtimeContext();
  const failures = events.filter((entry) => String(entry.type) === REAUTH_FAILED_EVENT_NAME);

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader accent>
          <CardTitle>Reauthentication lab</CardTitle>
          <CardDescription>
            Revoking a user makes the library&apos;s periodic <Code>revalidate</Code> call fail for
            every live connection they hold. Under <Code>REAUTH_ON_FAILURE=disconnect</Code> the
            next cycle closes those streams.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RevocationControls {...lab} />
          {lab.isAdmin ? null : (
            <p className="text-xs text-white/40">Revocation requires the admin role.</p>
          )}
          {lab.status ? <p className="text-xs text-white/50">{lab.status}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Revalidation counters</CardTitle>
          <CardDescription>
            How many times each user was actually re-checked. The library caches a positive result,
            so this stays below the number of cycles while the cache is warm.
          </CardDescription>
          <div className="mt-4">
            <RevalidationCounts counts={lab.counts} />
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col-reverse items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <CardTitle>Observed on this connection</CardTitle>
              <CardDescription>
                The reserved reauthentication-failed event, as seen by this tab&apos;s own feed. It
                is only sent under <Code>REAUTH_ON_FAILURE=event</Code>; the shipped{' '}
                <Code>disconnect</Code> policy closes the stream without announcing it, so this
                stays empty by design.
              </CardDescription>
            </div>
            <StatusChip className="shrink-0" tone={failures.length > 0 ? 'danger' : 'neutral'}>
              {failures.length > 0 ? `${failures.length} received` : 'none yet'}
            </StatusChip>
          </div>
          <div className="mt-4">
            {failures.length === 0 ? (
              <EmptyState title="No reauthentication failure seen">
                Under the disconnect policy the stream simply closes; boot the api with the event
                policy to see the announcement here instead.
              </EmptyState>
            ) : (
              <ul className="flex flex-col gap-2">
                {/* The client-side entry carries only a type and a payload, so the
                    key follows the convention the other feeds use: the event name
                    plus its position in an append-only list, which never reorders. */}
                {failures.map((entry, index) => (
                  <li
                    key={`${String(entry.type)}-${index}`}
                    className="rounded-lg border border-(--color-danger)/30 bg-(--color-danger)/10 p-3 font-mono text-xs text-(--color-danger)"
                  >
                    {JSON.stringify(entry.data)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
