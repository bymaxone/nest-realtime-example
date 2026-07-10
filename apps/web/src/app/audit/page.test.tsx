/**
 * @fileoverview Unit tests for the lifecycle audit feed page.
 * @layer test
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-error';

import AuditPage from './page';

interface MockContextValue {
  readonly lastEvent: { type: string } | undefined;
}

const useRealtimeContextMock = vi.fn<() => MockContextValue>();

vi.mock('@bymax-one/nest-realtime/react', () => ({
  useRealtimeContext: () => useRealtimeContextMock(),
}));

const feedMock =
  vi.fn<
    (kind?: string) => Promise<{ service: { name: string; version: string }; entries: unknown[] }>
  >();
const decoratorStatsMock = vi.fn<() => Promise<{ connects: number; disconnects: number }>>();

vi.mock('@/lib/api-client', () => ({
  ApiError,
  auditApi: {
    feed: (kind?: string) => feedMock(kind),
    decoratorStats: () => decoratorStatsMock(),
  },
}));

const ENTRY = {
  kind: 'disconnect' as const,
  at: '2026-01-01T00:00:00.000Z',
  instance: 'app-a',
  connectionId: 'c1',
  userId: 'ana@acme',
  tenantId: 'acme',
  transport: 'sse' as const,
  extra: { durationMs: 4200, reason: 'client closed' },
};

describe('AuditPage', () => {
  it('loads the feed and decorator stats on mount', async () => {
    // Scenario: the page loads the audit feed and decorator counters once.
    useRealtimeContextMock.mockReturnValue({ lastEvent: undefined });
    feedMock.mockResolvedValue({ service: { name: 'api', version: '0.1.0' }, entries: [ENTRY] });
    decoratorStatsMock.mockResolvedValue({ connects: 3, disconnects: 1 });
    render(<AuditPage />);
    expect(await screen.findByText('connects: 3')).toBeInTheDocument();
    expect(screen.getByText('4.2s')).toBeInTheDocument();
  });

  it('filters by kind when a filter chip is clicked', async () => {
    // Scenario: clicking the "connect" chip re-fetches with that kind filter.
    useRealtimeContextMock.mockReturnValue({ lastEvent: undefined });
    feedMock.mockResolvedValue({ service: { name: 'api', version: '0.1.0' }, entries: [] });
    decoratorStatsMock.mockResolvedValue({ connects: 0, disconnects: 0 });
    render(<AuditPage />);
    await waitFor(() => expect(feedMock).toHaveBeenCalledWith(undefined));
    const user = userEvent.setup();
    await user.click(screen.getByText('connect'));
    await waitFor(() => expect(feedMock).toHaveBeenCalledWith('connect'));
  });

  it('reloads when the shared connection observes a connection:established event', async () => {
    // Scenario: a new connection prompts a fresh audit read without manual refresh.
    feedMock.mockResolvedValue({ service: { name: 'api', version: '0.1.0' }, entries: [] });
    decoratorStatsMock.mockResolvedValue({ connects: 0, disconnects: 0 });
    const { rerender } = render(<AuditPage />);
    useRealtimeContextMock.mockReturnValue({ lastEvent: { type: 'connection:established' } });
    rerender(<AuditPage />);
    await waitFor(() => expect(feedMock.mock.calls.length).toBeGreaterThan(1));
  });

  it('shows an error and an empty state when the load fails', async () => {
    // Scenario: the api is unreachable when the page mounts.
    useRealtimeContextMock.mockReturnValue({ lastEvent: undefined });
    feedMock.mockRejectedValue(new ApiError(500, 'internal error'));
    decoratorStatsMock.mockRejectedValue(new ApiError(500, 'internal error'));
    render(<AuditPage />);
    expect(await screen.findByText('internal error')).toBeInTheDocument();
    expect(screen.getByText('No audit entries yet')).toBeInTheDocument();
  });

  it('shows a generic error message for a non-api failure', async () => {
    // Scenario: an unexpected non-ApiError rejection (e.g. a network failure).
    useRealtimeContextMock.mockReturnValue({ lastEvent: undefined });
    feedMock.mockRejectedValue(new Error('network down'));
    decoratorStatsMock.mockRejectedValue(new Error('network down'));
    render(<AuditPage />);
    expect(await screen.findByText('Failed to load the audit feed')).toBeInTheDocument();
  });

  it('clicks back to "all" and renders an entry with no duration, user, or transport', async () => {
    // Scenario: an error-kind entry lacks userId/transport/duration; "all" clears the filter.
    useRealtimeContextMock.mockReturnValue({ lastEvent: undefined });
    feedMock.mockResolvedValue({
      service: { name: 'api', version: '0.1.0' },
      entries: [
        {
          kind: 'error',
          at: '2026-01-01T00:00:00.000Z',
          instance: 'app-a',
          connectionId: undefined,
          userId: undefined,
          tenantId: undefined,
          transport: undefined,
          extra: { message: 'boom' },
        },
      ],
    });
    decoratorStatsMock.mockResolvedValue({ connects: 0, disconnects: 0 });
    render(<AuditPage />);
    await screen.findByText('error');
    const user = userEvent.setup();
    await user.click(screen.getByText('all'));
    await waitFor(() => expect(feedMock).toHaveBeenLastCalledWith(undefined));
    expect(screen.getAllByText('n/a').length).toBeGreaterThanOrEqual(2);
  });

  it('manually refreshes via the refresh button', async () => {
    // Scenario: the operator clicks Refresh to force a reload.
    useRealtimeContextMock.mockReturnValue({ lastEvent: undefined });
    feedMock.mockResolvedValue({ service: { name: 'api', version: '0.1.0' }, entries: [] });
    decoratorStatsMock.mockResolvedValue({ connects: 0, disconnects: 0 });
    render(<AuditPage />);
    await waitFor(() => expect(feedMock).toHaveBeenCalledTimes(1));
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(feedMock).toHaveBeenCalledTimes(2));
  });
});
