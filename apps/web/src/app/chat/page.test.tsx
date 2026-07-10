/**
 * @fileoverview Unit tests for the incident chat page.
 * @layer test
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-error';

import ChatPage from './page';

interface MockRealtimeValue {
  readonly connected: boolean;
  readonly emit: (event: string, data: unknown) => void;
  readonly events: ReadonlyArray<{ type: string; data: unknown }>;
}

const useRealtimeMock = vi.fn<() => MockRealtimeValue>();
const mintWsTokenMock = vi.fn<() => Promise<{ token: string; expiresAt: string }>>();
const joinMock =
  vi.fn<
    (connectionId: string, type: string, id: string) => Promise<{ roomId: string; joined: true }>
  >();
const leaveMock =
  vi.fn<
    (connectionId: string, type: string, id: string) => Promise<{ roomId: string; left: true }>
  >();

vi.mock('@bymax-one/nest-realtime/react', () => ({
  useRealtime: () => useRealtimeMock(),
}));

vi.mock('@/lib/api-client', () => ({
  ApiError,
  authApi: { mintWsToken: () => mintWsTokenMock() },
  roomsApi: {
    join: (connectionId: string, type: string, id: string) => joinMock(connectionId, type, id),
    leave: (connectionId: string, type: string, id: string) => leaveMock(connectionId, type, id),
  },
}));

describe('ChatPage', () => {
  it('joins a room once the connection is established and lets the user send a message', async () => {
    // Scenario: connection established, join the room, then send via the socket emit surface.
    mintWsTokenMock.mockResolvedValueOnce({
      token: 'ws-token',
      expiresAt: '2026-01-01T00:00:00.000Z',
    });
    const emit = vi.fn();
    useRealtimeMock.mockReturnValue({
      connected: true,
      emit,
      events: [{ type: 'connection:established', data: { connectionId: 'conn-1' } }],
    });
    joinMock.mockResolvedValueOnce({ roomId: 'resource:incident:2', joined: true });
    render(<ChatPage />);
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Join room' })).toBeEnabled());
    const incidentIdInput = screen.getByLabelText('Incident id');
    await user.clear(incidentIdInput);
    await user.type(incidentIdInput, '2');
    await user.click(screen.getByRole('button', { name: 'Join room' }));
    expect(joinMock).toHaveBeenCalledWith('conn-1', 'incident', '2');
    expect(await screen.findByRole('button', { name: /Leave/ })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Message the incident room'), 'hello team');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(emit).toHaveBeenCalledWith('chat.message', {
      roomId: 'resource:incident:2',
      body: 'hello team',
    });
  });

  it('renders incoming chat messages for the joined room only', async () => {
    // Scenario: two messages arrive, one for the joined room and one for another room.
    mintWsTokenMock.mockResolvedValueOnce({
      token: 'ws-token',
      expiresAt: '2026-01-01T00:00:00.000Z',
    });
    useRealtimeMock.mockReturnValue({
      connected: true,
      emit: vi.fn(),
      events: [
        { type: 'connection:established', data: { connectionId: 'conn-1' } },
        {
          type: 'chat.message',
          data: {
            roomId: 'resource:incident:1',
            from: 'bob@acme',
            body: 'hi',
            at: '2026-01-01T00:00:00.000Z',
          },
        },
        {
          type: 'chat.message',
          data: {
            roomId: 'resource:incident:2',
            from: 'gil@globex',
            body: 'other room',
            at: '2026-01-01T00:00:00.000Z',
          },
        },
      ],
    });
    joinMock.mockResolvedValueOnce({ roomId: 'resource:incident:1', joined: true });
    render(<ChatPage />);
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Join room' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Join room' }));
    expect(await screen.findByText('hi')).toBeInTheDocument();
    expect(screen.queryByText('other room')).not.toBeInTheDocument();
  });

  it('leaves the room and shows an error when joining fails', async () => {
    // Scenario: leaving clears the joined room; a failed join surfaces its message.
    mintWsTokenMock.mockResolvedValueOnce({
      token: 'ws-token',
      expiresAt: '2026-01-01T00:00:00.000Z',
    });
    useRealtimeMock.mockReturnValue({
      connected: false,
      emit: vi.fn(),
      events: [{ type: 'connection:established', data: { connectionId: 'conn-1' } }],
    });
    joinMock.mockRejectedValueOnce(new ApiError(400, 'invalid room'));
    render(<ChatPage />);
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Join room' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Join room' }));
    expect(await screen.findByText('invalid room')).toBeInTheDocument();
  });

  it('shows a generic message for a non-api join failure', async () => {
    // Scenario: an unexpected non-ApiError rejection (e.g. a network failure).
    mintWsTokenMock.mockResolvedValueOnce({
      token: 'ws-token',
      expiresAt: '2026-01-01T00:00:00.000Z',
    });
    useRealtimeMock.mockReturnValue({
      connected: false,
      emit: vi.fn(),
      events: [{ type: 'connection:established', data: { connectionId: 'conn-1' } }],
    });
    joinMock.mockRejectedValueOnce(new Error('network down'));
    render(<ChatPage />);
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Join room' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Join room' }));
    expect(await screen.findByText('Failed to join the room')).toBeInTheDocument();
  });

  it('disables Join while there is no connectionId, and shows "No messages yet"', () => {
    // Scenario: the socket has not yet delivered connection:established.
    mintWsTokenMock.mockRejectedValueOnce(new Error('no token'));
    useRealtimeMock.mockReturnValue({ connected: false, emit: vi.fn(), events: [] });
    render(<ChatPage />);
    expect(screen.getByRole('button', { name: 'Join room' })).toBeDisabled();
    expect(screen.getByText('No messages yet.')).toBeInTheDocument();
  });

  it('does not send an empty message and leaves an already-joined room', async () => {
    // Scenario: send is a no-op with blank text; leave clears the joined state.
    mintWsTokenMock.mockResolvedValueOnce({
      token: 'ws-token',
      expiresAt: '2026-01-01T00:00:00.000Z',
    });
    const emit = vi.fn();
    useRealtimeMock.mockReturnValue({
      connected: true,
      emit,
      events: [{ type: 'connection:established', data: { connectionId: 'conn-1' } }],
    });
    joinMock.mockResolvedValueOnce({ roomId: 'resource:incident:1', joined: true });
    leaveMock.mockResolvedValueOnce({ roomId: 'resource:incident:1', left: true });
    render(<ChatPage />);
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Join room' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Join room' }));
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(emit).not.toHaveBeenCalled();
    await user.click(await screen.findByRole('button', { name: /Leave/ }));
    expect(leaveMock).toHaveBeenCalledWith('conn-1', 'incident', '1');
    expect(await screen.findByRole('button', { name: 'Join room' })).toBeInTheDocument();
  });
});
