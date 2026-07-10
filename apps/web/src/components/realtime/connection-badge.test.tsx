/**
 * @fileoverview Unit tests for {@link ConnectionBadge}.
 * @layer test
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { makeRealtimeConnection, type RealtimeConnectionFake } from '@/test-utils/realtime-mocks';

import { ConnectionBadge } from './connection-badge';

const useRealtimeConnectionMock = vi.fn<(opts: unknown) => RealtimeConnectionFake>();

vi.mock('@bymax-one/nest-realtime/react', () => ({
  useRealtimeConnection: (opts: unknown) => useRealtimeConnectionMock(opts),
}));

describe('ConnectionBadge', () => {
  it('shows "live" with a success dot when connected', () => {
    // Scenario: the SSE connection is currently open.
    useRealtimeConnectionMock.mockReturnValue(makeRealtimeConnection({ connected: true }));
    render(<ConnectionBadge />);
    expect(screen.getByText('live')).toBeInTheDocument();
  });

  it('shows "disconnected" and triggers a reconnect on click', async () => {
    // Scenario: the connection is down; clicking the badge forces a reconnect.
    const reconnect = vi.fn();
    useRealtimeConnectionMock.mockReturnValue(
      makeRealtimeConnection({ connected: false, reconnect }),
    );
    render(<ConnectionBadge />);
    expect(screen.getByText('disconnected')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button'));
    expect(reconnect).toHaveBeenCalledOnce();
  });

  it('calls the hook with the SSE events URL and withCredentials', () => {
    // Scenario: the badge opens its own dedicated, credentialed SSE connection.
    useRealtimeConnectionMock.mockReturnValue(makeRealtimeConnection());
    render(<ConnectionBadge />);
    expect(useRealtimeConnectionMock).toHaveBeenCalledWith(
      expect.objectContaining({ withCredentials: true }),
    );
  });
});
