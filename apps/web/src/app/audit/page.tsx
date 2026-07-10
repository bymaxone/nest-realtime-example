/**
 * @fileoverview Lifecycle audit feed: kind filters, disconnect durations, decorator counters.
 * @layer app
 *
 * Reads `GET /audit/feed` (a one-shot read, not a stream, per the data-layer
 * convention that all *live* data flows through the hooks) and refetches
 * whenever the shared connection observes a `connection:established` event, so
 * the feed stays current without polling on an idle page.
 */
'use client';

import { useRealtimeContext } from '@bymax-one/nest-realtime/react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Chip, StatusChip, type ChipTone } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import {
  ApiError,
  auditApi,
  type AuditEntry,
  type AuditKind,
  type DecoratorStats,
} from '@/lib/api-client';

const KIND_FILTERS: readonly AuditKind[] = ['connect', 'disconnect', 'error', 'reauth-failed'];

const KIND_TONE: Record<AuditKind, ChipTone> = {
  connect: 'success',
  disconnect: 'neutral',
  error: 'danger',
  'reauth-failed': 'warning',
};

/** Format a disconnect entry's duration, when present, as whole seconds. */
function durationLabel(entry: AuditEntry): string | undefined {
  const durationMs = entry.extra?.['durationMs'];
  return typeof durationMs === 'number' ? `${(durationMs / 1000).toFixed(1)}s` : undefined;
}

/** Everything the audit page's JSX needs. */
interface AuditFeedState {
  readonly kind: AuditKind | undefined;
  readonly setKind: (kind: AuditKind | undefined) => void;
  readonly entries: readonly AuditEntry[];
  readonly stats: DecoratorStats | null;
  readonly error: string | null;
  readonly reload: () => void;
}

/** Loads the audit feed and decorator stats, refetching on filter change or a live connect event. */
function useAuditFeed(): AuditFeedState {
  const { lastEvent } = useRealtimeContext();
  const [kind, setKind] = useState<AuditKind | undefined>(undefined);
  const [entries, setEntries] = useState<readonly AuditEntry[]>([]);
  const [stats, setStats] = useState<DecoratorStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const [feed, decoratorStats] = await Promise.all([
        auditApi.feed(kind),
        auditApi.decoratorStats(),
      ]);
      setEntries(feed.entries);
      setStats(decoratorStats);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load the audit feed');
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (lastEvent?.type === 'connection:established') void load();
  }, [lastEvent, load]);

  return { kind, setKind, entries, stats, error, reload: () => void load() };
}

/** The "all" plus per-kind filter chips row. */
function KindFilterChips({ kind, setKind }: Pick<AuditFeedState, 'kind' | 'setKind'>) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => setKind(undefined)}
        className={kind === undefined ? 'text-brand-500' : 'text-white/50'}
      >
        <Chip>all</Chip>
      </button>
      {KIND_FILTERS.map((filter) => (
        <button key={filter} type="button" onClick={() => setKind(filter)}>
          <StatusChip
            tone={KIND_TONE[filter]}
            className={kind === filter ? 'ring-1 ring-brand-500' : ''}
          >
            {filter}
          </StatusChip>
        </button>
      ))}
    </div>
  );
}

/** One audit entry row: kind, user, transport, duration (if any), and timestamp. */
function AuditEntryRow({ entry }: { readonly entry: AuditEntry }) {
  return (
    <li className="flex items-center justify-between rounded-lg border border-(--glass-border) bg-(--glass-bg) p-3 text-xs">
      <div className="flex items-center gap-3">
        <StatusChip tone={KIND_TONE[entry.kind]}>{entry.kind}</StatusChip>
        <span className="font-mono text-white/50">{entry.userId ?? 'n/a'}</span>
        <span className="text-white/30">{entry.transport ?? 'n/a'}</span>
      </div>
      <div className="flex items-center gap-3 text-white/40">
        {durationLabel(entry) ? <span>{durationLabel(entry)}</span> : null}
        <span>{new Date(entry.at).toLocaleTimeString()}</span>
      </div>
    </li>
  );
}

/** The audit entries list, or an empty state when none match the filter. */
function AuditEntryList({ entries }: { readonly entries: readonly AuditEntry[] }) {
  if (entries.length === 0) {
    return (
      <EmptyState title="No audit entries yet">Connect a client to populate the feed.</EmptyState>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {entries.map((entry, index) => (
        <AuditEntryRow key={`${entry.connectionId ?? 'none'}-${entry.at}-${index}`} entry={entry} />
      ))}
    </ul>
  );
}

/** Lifecycle audit feed page. */
export default function AuditPage() {
  const { kind, setKind, entries, stats, error, reload } = useAuditFeed();

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <CardTitle>Decorator counters</CardTitle>
        <CardDescription>
          Bumped by the app-local `@OnConnect` / `@OnDisconnect` handlers.
        </CardDescription>
        <div className="mt-3 flex gap-3">
          <Chip>connects: {stats?.connects ?? 0}</Chip>
          <Chip>disconnects: {stats?.disconnects ?? 0}</Chip>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Audit feed</CardTitle>
            <CardDescription>
              Newest first, across connect / disconnect / error / reauth-failed.
            </CardDescription>
          </div>
          <Button variant="outline" onClick={reload}>
            Refresh
          </Button>
        </div>
        <KindFilterChips kind={kind} setKind={setKind} />
        {error ? <p className="mt-3 text-xs text-(--color-danger)">{error}</p> : null}
        <div className="mt-4">
          <AuditEntryList entries={entries} />
        </div>
      </Card>
    </div>
  );
}
