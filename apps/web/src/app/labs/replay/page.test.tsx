/**
 * @fileoverview Unit tests for the replay lab page.
 * @layer test
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-error';

import ReplayLabPage from './page';

interface MockContextValue {
  readonly events: ReadonlyArray<{ type: string; data: unknown; id?: string }>;
  readonly lastEvent: { type: string; data: unknown; id?: string } | undefined;
}

interface MockSessionValue {
  readonly traits: { userId: string; tenantId: string; roles: readonly string[] } | null;
}

interface MockTimelineView {
  readonly userId: string;
  readonly replayBufferSize: number;
  readonly emissions: ReadonlyArray<{ seq: number; id: string }>;
  readonly retainedSeqs: readonly number[];
  readonly evictedSeqs: readonly number[];
  readonly offlineQueued: ReadonlyArray<{ seq: number | undefined; id: string; emittedAt: string }>;
}

const useRealtimeContextMock = vi.fn<() => MockContextValue>();
const useSessionMock = vi.fn<() => MockSessionValue>();
const emitBurstMock = vi.fn<(count: number) => Promise<{ emitted: number }>>();
const dropMock = vi.fn<() => Promise<{ dropped: number }>>();
const timelineMock = vi.fn<(userId: string) => Promise<MockTimelineView>>();

vi.mock('@bymax-one/nest-realtime/react', () => ({
  useRealtimeContext: () => useRealtimeContextMock(),
}));

vi.mock('@/lib/session-context', () => ({
  useSession: () => useSessionMock(),
}));

vi.mock('@/lib/api-client', () => ({
  ApiError,
  replayLabApi: {
    emitBurst: (count: number) => emitBurstMock(count),
    drop: () => dropMock(),
    timeline: (userId: string) => timelineMock(userId),
  },
}));

const TIMELINE = {
  userId: 'ana@acme',
  replayBufferSize: 10,
  emissions: [
    { seq: 1, id: '1' },
    { seq: 2, id: '2' },
  ],
  retainedSeqs: [2],
  evictedSeqs: [1],
  // A queued entry for a sequence outside `emissions` exercises the offline-queue
  // mapping without changing how seq 1/2 above are tagged in the tests below.
  offlineQueued: [{ seq: 99, id: '99', emittedAt: '2026-01-01T00:00:00.000Z' }],
};

describe('ReplayLabPage', () => {
  it('renders the diff viewer tagging live vs buffer vs gap ranges', async () => {
    // Scenario: one event was received live, the other only survives in the buffer.
    useSessionMock.mockReturnValue({
      traits: { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] },
    });
    useRealtimeContextMock.mockReturnValue({
      events: [{ type: 'lab.replay', data: { seq: 1 }, id: '1' }],
      lastEvent: { type: 'lab.replay', data: { seq: 1 }, id: '1' },
    });
    timelineMock.mockResolvedValue(TIMELINE);
    render(<ReplayLabPage />);
    expect(await screen.findByText('#2 buffer')).toBeInTheDocument();
    expect(screen.getByText('#1 live')).toBeInTheDocument();
    expect(screen.getByText('lastEventId: 1')).toBeInTheDocument();
  });

  it('emits a burst and shows the emitted count', async () => {
    // Scenario: clicking emit burst drives POST /labs/replay/emit-burst.
    useSessionMock.mockReturnValue({
      traits: { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] },
    });
    useRealtimeContextMock.mockReturnValue({ events: [], lastEvent: undefined });
    timelineMock.mockResolvedValue(TIMELINE);
    emitBurstMock.mockResolvedValueOnce({ emitted: 15 });
    render(<ReplayLabPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Emit burst' }));
    expect(await screen.findByText('emitted 15 event(s)')).toBeInTheDocument();
  });

  it('drops the stream and shows the result', async () => {
    // Scenario: force-closing the stream so the reconnect replays from Last-Event-ID.
    useSessionMock.mockReturnValue({
      traits: { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] },
    });
    useRealtimeContextMock.mockReturnValue({ events: [], lastEvent: undefined });
    timelineMock.mockResolvedValue(TIMELINE);
    dropMock.mockResolvedValueOnce({ dropped: 1 });
    render(<ReplayLabPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Drop my stream' }));
    expect(await screen.findByText(/reconnect will replay/)).toBeInTheDocument();
  });

  it('shows failure statuses for a burst and a drop', async () => {
    // Scenario: the api rejects both actions.
    useSessionMock.mockReturnValue({
      traits: { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] },
    });
    useRealtimeContextMock.mockReturnValue({ events: [], lastEvent: undefined });
    timelineMock.mockResolvedValue(TIMELINE);
    emitBurstMock.mockRejectedValueOnce(new ApiError(400, 'invalid count'));
    render(<ReplayLabPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Emit burst' }));
    expect(await screen.findByText('invalid count')).toBeInTheDocument();
    dropMock.mockRejectedValueOnce(new Error('network down'));
    await user.click(screen.getByRole('button', { name: 'Drop my stream' }));
    expect(await screen.findByText('Drop failed')).toBeInTheDocument();
  });

  it('shows a generic burst failure and the api drop failure message', async () => {
    // Scenario: covers the remaining instanceof-ApiError branches for both actions.
    useSessionMock.mockReturnValue({
      traits: { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] },
    });
    useRealtimeContextMock.mockReturnValue({ events: [], lastEvent: undefined });
    timelineMock.mockResolvedValue(TIMELINE);
    emitBurstMock.mockRejectedValueOnce(new Error('network down'));
    render(<ReplayLabPage />);
    const user = userEvent.setup();
    fireEvent.change(screen.getByLabelText('Burst count'), { target: { value: '30' } });
    await user.click(screen.getByRole('button', { name: 'Emit burst' }));
    expect(await screen.findByText('Burst failed')).toBeInTheDocument();
    expect(emitBurstMock).toHaveBeenCalledWith(30);
    dropMock.mockRejectedValueOnce(new ApiError(404, 'no active stream'));
    await user.click(screen.getByRole('button', { name: 'Drop my stream' }));
    expect(await screen.findByText('no active stream')).toBeInTheDocument();
  });

  it('tolerates the admin-only timeline endpoint rejecting for a non-admin session', async () => {
    // Scenario: a member session cannot read its own timeline (admin-gated like eviction).
    useSessionMock.mockReturnValue({
      traits: { userId: 'bob@acme', tenantId: 'acme', roles: ['member'] },
    });
    useRealtimeContextMock.mockReturnValue({ events: [], lastEvent: undefined });
    timelineMock.mockRejectedValue(new ApiError(403, 'admin role required'));
    render(<ReplayLabPage />);
    await waitFor(() => expect(timelineMock).toHaveBeenCalled());
    expect(screen.getByText('No burst emitted yet')).toBeInTheDocument();
  });

  it('does nothing when there is no session yet', () => {
    // Scenario: the page renders before the session lookup resolves.
    useSessionMock.mockReturnValue({ traits: null });
    useRealtimeContextMock.mockReturnValue({ events: [], lastEvent: undefined });
    render(<ReplayLabPage />);
    expect(timelineMock).not.toHaveBeenCalled();
  });
});
