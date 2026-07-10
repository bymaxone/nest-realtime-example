/**
 * @fileoverview Unit tests for the connection lab page's control-panel state machine.
 * @layer test
 */

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-error';

import ConnectionLabPage from './page';

vi.mock('@/components/realtime/managed-connection', () => ({
  ManagedConnection: ({ initialDelayMs }: { initialDelayMs: number }) => (
    <div data-testid="managed-connection">delay {initialDelayMs}</div>
  ),
}));

const dropMock = vi.fn<() => Promise<{ dropped: number }>>();

vi.mock('@/lib/api-client', () => ({
  ApiError,
  replayLabApi: { drop: () => dropMock() },
}));

describe('ConnectionLabPage', () => {
  it('starts disconnected (autoConnect: false) with no ManagedConnection mounted', () => {
    // Scenario: the lab never auto-connects; the user must click Connect.
    render(<ConnectionLabPage />);
    expect(screen.queryByTestId('managed-connection')).not.toBeInTheDocument();
    expect(screen.getByText('Not connected. Click Connect to open a stream.')).toBeInTheDocument();
  });

  it('mounts on Connect and unmounts on Disconnect', async () => {
    // Scenario: manual connect()/disconnect() realized via mount/unmount.
    render(<ConnectionLabPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Connect' }));
    expect(screen.getByTestId('managed-connection')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(screen.queryByTestId('managed-connection')).not.toBeInTheDocument();
  });

  it('adjusts every tuning slider before connecting', async () => {
    // Scenario: reconnect tuning (initial delay, max delay, max attempts) takes effect.
    render(<ConnectionLabPage />);
    fireEvent.change(screen.getByLabelText(/Initial delay/), { target: { value: '2500' } });
    fireEvent.change(screen.getByLabelText(/Max delay/), { target: { value: '15000' } });
    fireEvent.change(screen.getByLabelText(/Max attempts/), { target: { value: '3' } });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Connect' }));
    expect(screen.getByTestId('managed-connection')).toHaveTextContent('delay 2500');
    expect(screen.getByText('Max delay: 15000ms')).toBeInTheDocument();
    expect(screen.getByText('Max attempts: 3')).toBeInTheDocument();
  });

  it('drops the stream and shows the result', async () => {
    // Scenario: "kill my stream" only enables once connected, then reports the result.
    dropMock.mockResolvedValueOnce({ dropped: 1 });
    render(<ConnectionLabPage />);
    const user = userEvent.setup();
    expect(screen.getByRole('button', { name: 'Kill my stream' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Connect' }));
    await user.click(screen.getByRole('button', { name: 'Kill my stream' }));
    expect(await screen.findByText(/watch the backoff climb/)).toBeInTheDocument();
  });

  it('shows an error message when the kill switch fails', async () => {
    // Scenario: the drop endpoint fails (e.g. no active connection on the api side).
    dropMock.mockRejectedValueOnce(new ApiError(404, 'no active stream'));
    render(<ConnectionLabPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Connect' }));
    await user.click(screen.getByRole('button', { name: 'Kill my stream' }));
    expect(await screen.findByText('no active stream')).toBeInTheDocument();
  });

  it('shows a generic message for a non-api kill-switch failure', async () => {
    // Scenario: an unexpected non-ApiError rejection (e.g. a network failure).
    dropMock.mockRejectedValueOnce(new Error('network down'));
    render(<ConnectionLabPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Connect' }));
    await user.click(screen.getByRole('button', { name: 'Kill my stream' }));
    expect(await screen.findByText('Failed to drop the stream')).toBeInTheDocument();
  });
});
