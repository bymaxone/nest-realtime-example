/**
 * @fileoverview Unit tests for the connections registry and eviction visualizer page.
 * @layer test
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-error';

import ConnectionsPage from './page';

interface MockContextValue {
  readonly lastEvent: { type: string } | undefined;
}

interface MockSessionValue {
  readonly traits: { userId: string; tenantId: string; roles: readonly string[] } | null;
}

interface MockConnection {
  readonly connectionId: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly transport: 'sse' | 'websocket';
  readonly connectedAt: string;
}

const useRealtimeContextMock = vi.fn<() => MockContextValue>();
const useSessionMock = vi.fn<() => MockSessionValue>();

vi.mock('@bymax-one/nest-realtime/react', () => ({
  useRealtimeContext: () => useRealtimeContextMock(),
}));

vi.mock('@/lib/session-context', () => ({
  useSession: () => useSessionMock(),
}));

const listMock =
  vi.fn<() => Promise<{ instance: string; connections: readonly MockConnection[] }>>();
const disconnectMock = vi.fn<(id: string) => Promise<{ disconnected: true }>>();
const timelineMock = vi.fn<(userId: string) => Promise<{ userId: string; timeline: unknown[] }>>();

vi.mock('@/lib/api-client', () => ({
  ApiError,
  connectionsApi: {
    list: () => listMock(),
    disconnect: (id: string) => disconnectMock(id),
  },
  evictionLabApi: {
    timeline: (userId: string) => timelineMock(userId),
  },
}));

const CONNECTION = {
  connectionId: 'c1',
  userId: 'ana@acme',
  tenantId: 'acme',
  transport: 'sse' as const,
  connectedAt: '2026-01-01T00:00:00.000Z',
};

describe('ConnectionsPage', () => {
  it('polls the connections list again after the interval elapses', async () => {
    // Scenario: the list stays fresh via a fixed poll interval, not only on mount.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    useSessionMock.mockReturnValue({
      traits: { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] },
    });
    useRealtimeContextMock.mockReturnValue({ lastEvent: undefined });
    listMock.mockResolvedValue({ instance: 'app-a', connections: [] });
    timelineMock.mockResolvedValue({ userId: 'ana@acme', timeline: [] });
    render(<ConnectionsPage />);
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(5100);
    expect(listMock.mock.calls.length).toBeGreaterThan(1);
    vi.useRealTimers();
  });

  it('lists connections and renders the eviction timeline for the caller', async () => {
    // Scenario: an admin session lists connections and reads their own timeline.
    useSessionMock.mockReturnValue({
      traits: { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] },
    });
    useRealtimeContextMock.mockReturnValue({ lastEvent: undefined });
    listMock.mockResolvedValue({ instance: 'app-a', connections: [CONNECTION] });
    timelineMock.mockResolvedValue({ userId: 'ana@acme', timeline: [] });
    render(<ConnectionsPage />);
    expect(await screen.findByText('ana@acme')).toBeInTheDocument();
    expect(screen.getByText('Connections on app-a')).toBeInTheDocument();
  });

  it('confirms before disconnecting and reloads the list on success', async () => {
    // Scenario: the kill switch requires an explicit confirmation click.
    useSessionMock.mockReturnValue({
      traits: { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] },
    });
    useRealtimeContextMock.mockReturnValue({ lastEvent: undefined });
    listMock.mockResolvedValue({ instance: 'app-a', connections: [CONNECTION] });
    timelineMock.mockResolvedValue({ userId: 'ana@acme', timeline: [] });
    disconnectMock.mockResolvedValue({ disconnected: true });
    render(<ConnectionsPage />);
    await screen.findByText('ana@acme');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(screen.getByText('Disconnect this connection?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(disconnectMock).toHaveBeenCalledWith('c1');
  });

  it('cancels the confirmation without disconnecting', async () => {
    // Scenario: the operator backs out of the kill-switch confirmation.
    useSessionMock.mockReturnValue({
      traits: { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] },
    });
    useRealtimeContextMock.mockReturnValue({ lastEvent: undefined });
    listMock.mockResolvedValue({ instance: 'app-a', connections: [CONNECTION] });
    timelineMock.mockResolvedValue({ userId: 'ana@acme', timeline: [] });
    render(<ConnectionsPage />);
    await screen.findByText('ana@acme');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Disconnect' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(disconnectMock).not.toHaveBeenCalled();
  });

  it('shows an empty state when there is no session yet', async () => {
    // Scenario: the page renders before the session lookup resolves.
    useSessionMock.mockReturnValue({ traits: null });
    useRealtimeContextMock.mockReturnValue({ lastEvent: undefined });
    listMock.mockRejectedValue(new Error('network down'));
    render(<ConnectionsPage />);
    expect(await screen.findByText('Failed to load connections')).toBeInTheDocument();
    expect(screen.getByText('No active connections visible')).toBeInTheDocument();
    expect(screen.getByText('No connection history yet')).toBeInTheDocument();
    expect(timelineMock).not.toHaveBeenCalled();
  });

  it('leaves the eviction timeline empty when a non-admin session cannot read it', async () => {
    // Scenario: a member session has a userId but the admin-gated timeline endpoint rejects.
    useSessionMock.mockReturnValue({
      traits: { userId: 'bob@acme', tenantId: 'acme', roles: ['member'] },
    });
    useRealtimeContextMock.mockReturnValue({ lastEvent: undefined });
    listMock.mockRejectedValue(new ApiError(403, 'admin role required'));
    timelineMock.mockRejectedValue(new ApiError(403, 'admin role required'));
    render(<ConnectionsPage />);
    await waitFor(() => expect(timelineMock).toHaveBeenCalledWith('bob@acme'));
    expect(screen.getByText('No connection history yet')).toBeInTheDocument();
  });

  it('reloads on a connection:established event and surfaces a disconnect failure', async () => {
    // Scenario: a fresh connection event triggers a reload; a failed kill switch shows an error.
    useSessionMock.mockReturnValue({
      traits: { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] },
    });
    listMock.mockResolvedValue({ instance: 'app-a', connections: [CONNECTION] });
    timelineMock.mockResolvedValue({ userId: 'ana@acme', timeline: [] });
    disconnectMock.mockRejectedValue(new ApiError(404, 'connection not found'));
    useRealtimeContextMock.mockReturnValue({ lastEvent: { type: 'connection:established' } });
    render(<ConnectionsPage />);
    await screen.findByText('ana@acme');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Disconnect' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('connection not found')).toBeInTheDocument();
  });

  it('shows a generic message for a non-api disconnect failure', async () => {
    // Scenario: an unexpected non-ApiError rejection (e.g. a network failure).
    useSessionMock.mockReturnValue({
      traits: { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] },
    });
    useRealtimeContextMock.mockReturnValue({ lastEvent: undefined });
    listMock.mockResolvedValue({ instance: 'app-a', connections: [CONNECTION] });
    timelineMock.mockResolvedValue({ userId: 'ana@acme', timeline: [] });
    disconnectMock.mockRejectedValue(new Error('network down'));
    render(<ConnectionsPage />);
    await screen.findByText('ana@acme');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Disconnect' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('Failed to disconnect')).toBeInTheDocument();
  });
});
