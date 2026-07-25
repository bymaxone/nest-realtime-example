/**
 * @fileoverview Unit tests for the presence roster page.
 * @layer test
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-error';
import { makePresence, type PresenceFake } from '@/test-utils/realtime-mocks';

import PresencePage from './page';

interface MockSessionValue {
  readonly traits: { userId: string; tenantId: string; roles: readonly string[] } | null;
}

/** The subset of the realtime context this page reads. */
interface MockRealtimeValue {
  readonly lastEvent: { readonly type: string; readonly data: unknown } | undefined;
}

const usePresenceMock = vi.fn<() => PresenceFake>();
const useRealtimeContextMock = vi.fn<() => MockRealtimeValue>();
const useSessionMock = vi.fn<() => MockSessionValue>();
const rosterMock =
  vi.fn<(tenantId: string) => Promise<{ tenantId: string; online: readonly string[] }>>();

vi.mock('@bymax-one/nest-realtime/react', () => ({
  usePresence: () => usePresenceMock(),
  useRealtimeContext: () => useRealtimeContextMock(),
}));

vi.mock('@/lib/session-context', () => ({
  useSession: () => useSessionMock(),
}));

vi.mock('@/lib/api-client', () => ({
  ApiError,
  presenceApi: { roster: (tenantId: string) => rosterMock(tenantId) },
}));

/** Session traits for the seeded acme admin used across these tests. */
const ANA = { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] };

describe('PresencePage', () => {
  it('renders the roster returned by the REST snapshot', async () => {
    // Scenario: the snapshot lists both tenant members already online.
    useSessionMock.mockReturnValue({ traits: ANA });
    usePresenceMock.mockReturnValue(makePresence({ onlineUserIds: ['bob@acme'], count: 1 }));
    useRealtimeContextMock.mockReturnValue({ lastEvent: undefined });
    rosterMock.mockResolvedValue({ tenantId: 'acme', online: ['bob@acme', 'ana@acme'] });
    render(<PresencePage />);
    expect(await screen.findByText('ana@acme')).toBeInTheDocument();
    expect(screen.getByText('bob@acme')).toBeInTheDocument();
    expect(screen.getByText('Presence (acme)')).toBeInTheDocument();
  });

  it('re-reads the snapshot when a presence transition is observed', async () => {
    // Scenario: an observed presence:offline must drop a seeded user, which only a
    // re-read can do, since the hook alone cannot retract someone it never saw arrive.
    useSessionMock.mockReturnValue({ traits: ANA });
    usePresenceMock.mockReturnValue(makePresence());
    useRealtimeContextMock.mockReturnValue({
      lastEvent: { type: 'presence:offline', data: { userId: 'bob@acme' } },
    });
    rosterMock.mockResolvedValue({ tenantId: 'acme', online: ['ana@acme'] });
    render(<PresencePage />);
    expect(await screen.findByText('ana@acme')).toBeInTheDocument();
    expect(screen.queryByText('bob@acme')).not.toBeInTheDocument();
    // Once on mount, once for the observed transition.
    expect(rosterMock).toHaveBeenCalledTimes(2);
  });

  it('ignores an observed event that is not a presence transition', async () => {
    // Scenario: ordinary domain traffic must not trigger a roster round trip.
    useSessionMock.mockReturnValue({ traits: ANA });
    usePresenceMock.mockReturnValue(makePresence());
    useRealtimeContextMock.mockReturnValue({
      lastEvent: { type: 'order.created', data: { orderId: '1' } },
    });
    rosterMock.mockResolvedValue({ tenantId: 'acme', online: ['ana@acme'] });
    render(<PresencePage />);
    expect(await screen.findByText('ana@acme')).toBeInTheDocument();
    expect(rosterMock).toHaveBeenCalledTimes(1);
  });

  it('ignores a roster read that resolves after a newer one', async () => {
    // Scenario: the mount read is still in flight when a presence transition
    // triggers a second one. If the slow first response were allowed to land last
    // it would restore the roster the transition had just corrected, so only the
    // newest read may write.
    useSessionMock.mockReturnValue({ traits: ANA });
    usePresenceMock.mockReturnValue(makePresence());
    useRealtimeContextMock.mockReturnValue({
      lastEvent: { type: 'presence:offline', data: { userId: 'bob@acme' } },
    });

    let releaseStale: (value: { tenantId: string; online: readonly string[] }) => void = () => {};
    const stale = new Promise<{ tenantId: string; online: readonly string[] }>((resolve) => {
      releaseStale = resolve;
    });
    rosterMock
      .mockReturnValueOnce(stale)
      .mockResolvedValueOnce({ tenantId: 'acme', online: ['ana@acme'] });

    render(<PresencePage />);
    expect(await screen.findByText('ana@acme')).toBeInTheDocument();

    // The superseded read lands last, still carrying the departed user.
    releaseStale({ tenantId: 'acme', online: ['ana@acme', 'bob@acme'] });
    await stale;

    expect(screen.queryByText('bob@acme')).not.toBeInTheDocument();
  });

  it('ignores a roster failure from a read that a newer one superseded', async () => {
    // Scenario: the same race on the failure path. A superseded read that rejects
    // late must not raise an error banner over a roster a newer read already
    // returned successfully.
    useSessionMock.mockReturnValue({ traits: ANA });
    usePresenceMock.mockReturnValue(makePresence());
    useRealtimeContextMock.mockReturnValue({
      lastEvent: { type: 'presence:offline', data: { userId: 'bob@acme' } },
    });

    let failStale: (reason: Error) => void = () => {};
    const stale = new Promise<{ tenantId: string; online: readonly string[] }>((_, reject) => {
      failStale = reject;
    });
    rosterMock
      .mockReturnValueOnce(stale)
      .mockResolvedValueOnce({ tenantId: 'acme', online: ['ana@acme'] });

    render(<PresencePage />);
    expect(await screen.findByText('ana@acme')).toBeInTheDocument();

    failStale(new ApiError(500, 'internal error'));
    await stale.catch(() => undefined);

    expect(screen.queryByText('internal error')).not.toBeInTheDocument();
  });

  it('renders an empty state when no one is online and there is no session yet', () => {
    // Scenario: the page renders before the session lookup resolves.
    useSessionMock.mockReturnValue({ traits: null });
    usePresenceMock.mockReturnValue(makePresence());
    useRealtimeContextMock.mockReturnValue({ lastEvent: undefined });
    render(<PresencePage />);
    expect(screen.getByText('No one online yet')).toBeInTheDocument();
  });

  it('shows an error when the roster fetch fails', async () => {
    // Scenario: the presence REST endpoint is unreachable.
    useSessionMock.mockReturnValue({ traits: ANA });
    usePresenceMock.mockReturnValue(makePresence());
    useRealtimeContextMock.mockReturnValue({ lastEvent: undefined });
    rosterMock.mockRejectedValue(new ApiError(500, 'internal error'));
    render(<PresencePage />);
    expect(await screen.findByText('internal error')).toBeInTheDocument();
  });

  it('shows a generic message for a non-api roster failure', async () => {
    // Scenario: an unexpected non-ApiError rejection (e.g. a network failure).
    useSessionMock.mockReturnValue({ traits: ANA });
    usePresenceMock.mockReturnValue(makePresence());
    useRealtimeContextMock.mockReturnValue({ lastEvent: undefined });
    rosterMock.mockRejectedValue(new Error('network down'));
    render(<PresencePage />);
    expect(await screen.findByText('Failed to load the roster')).toBeInTheDocument();
  });
});
