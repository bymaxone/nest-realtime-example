/**
 * @fileoverview Unit tests for the offline-queue lab page.
 * @layer test
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-error';

import OfflineLabPage from './page';

interface MockSessionValue {
  readonly traits: { userId: string; tenantId: string; roles: readonly string[] } | null;
}

const useSessionMock = vi.fn<() => MockSessionValue>();
const emitMock = vi.fn<(userId: string, count: number) => Promise<{ emitted: number }>>();
const peekMock =
  vi.fn<(userId: string) => Promise<{ userId: string; events: readonly unknown[] }>>();
const ackMock = vi.fn<(upToId: string) => Promise<{ acknowledged: true }>>();

vi.mock('@/lib/session-context', () => ({
  useSession: () => useSessionMock(),
}));

vi.mock('@/lib/api-client', () => ({
  ApiError,
  offlineLabApi: {
    emit: (userId: string, count: number) => emitMock(userId, count),
    peek: (userId: string) => peekMock(userId),
    acknowledge: (upToId: string) => ackMock(upToId),
  },
}));

/** One queued event as the api surfaces it. */
const QUEUED = { seq: 1, id: 'ev-1', emittedAt: '2026-01-01T00:00:00.000Z' };

/** An admin session for the acme tenant. */
const ADMIN = { traits: { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] } };

describe('OfflineLabPage', () => {
  it('reads the target user queue on mount and lists what is pending', async () => {
    // Scenario: bob has a burst waiting from while he was disconnected.
    useSessionMock.mockReturnValue(ADMIN);
    peekMock.mockResolvedValue({ userId: 'bob@acme', events: [QUEUED] });
    render(<OfflineLabPage />);
    expect(await screen.findByText('#1')).toBeInTheDocument();
    expect(screen.getByText('queued')).toBeInTheDocument();
    expect(peekMock).toHaveBeenCalledWith('bob@acme');
  });

  it('renders an empty state when nothing is queued', async () => {
    // Scenario: the target user has no pending deliveries.
    useSessionMock.mockReturnValue(ADMIN);
    peekMock.mockResolvedValue({ userId: 'bob@acme', events: [] });
    render(<OfflineLabPage />);
    expect(await screen.findByText('Queue is empty')).toBeInTheDocument();
  });

  it('labels an event whose payload carries no sequence number', async () => {
    // Scenario: an event enqueued by something other than the numbered lab burst.
    useSessionMock.mockReturnValue(ADMIN);
    peekMock.mockResolvedValue({
      userId: 'bob@acme',
      events: [{ ...QUEUED, seq: undefined }],
    });
    render(<OfflineLabPage />);
    expect(await screen.findByText('no seq')).toBeInTheDocument();
  });

  it('enqueues a burst and re-reads the queue', async () => {
    // Scenario: an admin queues events for a user who is not connected.
    useSessionMock.mockReturnValue(ADMIN);
    peekMock.mockResolvedValue({ userId: 'bob@acme', events: [] });
    emitMock.mockResolvedValue({ emitted: 5 });
    render(<OfflineLabPage />);
    await screen.findByText('Queue is empty');

    await userEvent.click(screen.getByRole('button', { name: 'Enqueue while offline' }));

    expect(await screen.findByText('enqueued 5 events for bob@acme')).toBeInTheDocument();
    expect(emitMock).toHaveBeenCalledWith('bob@acme', 5);
  });

  it('uses the singular when a single event is enqueued', async () => {
    // Scenario: a burst of one must not read "1 events".
    useSessionMock.mockReturnValue(ADMIN);
    peekMock.mockResolvedValue({ userId: 'bob@acme', events: [] });
    emitMock.mockResolvedValue({ emitted: 1 });
    render(<OfflineLabPage />);
    await screen.findByText('Queue is empty');

    await userEvent.click(screen.getByRole('button', { name: 'Enqueue while offline' }));

    expect(await screen.findByText('enqueued 1 event for bob@acme')).toBeInTheDocument();
  });

  it('surfaces the api error envelope when enqueuing is rejected', async () => {
    // Scenario: a non-admin, or a rejected payload, must show the api's own message.
    useSessionMock.mockReturnValue(ADMIN);
    peekMock.mockResolvedValue({ userId: 'bob@acme', events: [] });
    emitMock.mockRejectedValue(new ApiError(403, 'admin role required'));
    render(<OfflineLabPage />);
    await screen.findByText('Queue is empty');

    await userEvent.click(screen.getByRole('button', { name: 'Enqueue while offline' }));

    expect(await screen.findByText('admin role required')).toBeInTheDocument();
  });

  it('shows a generic message for a non-api enqueue failure', async () => {
    // Scenario: a network-level rejection carries no envelope to display.
    useSessionMock.mockReturnValue(ADMIN);
    peekMock.mockResolvedValue({ userId: 'bob@acme', events: [] });
    emitMock.mockRejectedValue(new Error('offline'));
    render(<OfflineLabPage />);
    await screen.findByText('Queue is empty');

    await userEvent.click(screen.getByRole('button', { name: 'Enqueue while offline' }));

    expect(await screen.findByText('Enqueue failed')).toBeInTheDocument();
  });

  it('reports a failure to read the queue', async () => {
    // Scenario: the admin-only peek endpoint rejects a member session.
    useSessionMock.mockReturnValue(ADMIN);
    peekMock.mockRejectedValue(new ApiError(403, 'admin role required'));
    render(<OfflineLabPage />);
    expect(await screen.findByText('admin role required')).toBeInTheDocument();
  });

  it('shows a generic message for a non-api peek failure', async () => {
    // Scenario: the request never reached the api.
    useSessionMock.mockReturnValue(ADMIN);
    peekMock.mockRejectedValue(new Error('offline'));
    render(<OfflineLabPage />);
    expect(await screen.findByText('Failed to read the queue')).toBeInTheDocument();
  });

  it('re-reads the queue on demand', async () => {
    // Scenario: the operator refreshes after the target user reconnects.
    useSessionMock.mockReturnValue(ADMIN);
    peekMock.mockResolvedValue({ userId: 'bob@acme', events: [] });
    render(<OfflineLabPage />);
    await screen.findByText('Queue is empty');
    const before = peekMock.mock.calls.length;

    await userEvent.click(screen.getByRole('button', { name: 'Refresh queue' }));

    expect(peekMock.mock.calls.length).toBeGreaterThan(before);
  });

  it('disables the admin-only actions and explains why for a member session', async () => {
    // Scenario: enqueuing and inspecting another principal's queue is privileged.
    useSessionMock.mockReturnValue({
      traits: { userId: 'bob@acme', tenantId: 'acme', roles: ['member'] },
    });
    peekMock.mockResolvedValue({ userId: 'bob@acme', events: [] });
    render(<OfflineLabPage />);
    await screen.findByText('Queue is empty');

    expect(screen.getByRole('button', { name: 'Enqueue while offline' })).toBeDisabled();
    expect(screen.getByText(/requires the admin role/u)).toBeInTheDocument();
  });

  it('acknowledges the caller own queue up to the newest id', async () => {
    // Scenario: the target IS the caller, so the purge is theirs to perform.
    useSessionMock.mockReturnValue({
      traits: { userId: 'bob@acme', tenantId: 'acme', roles: ['admin'] },
    });
    peekMock.mockResolvedValue({ userId: 'bob@acme', events: [QUEUED] });
    ackMock.mockResolvedValue({ acknowledged: true });
    render(<OfflineLabPage />);
    await screen.findByText('#1');

    await userEvent.click(screen.getByRole('button', { name: 'Acknowledge my queue' }));

    expect(ackMock).toHaveBeenCalledWith('ev-1');
    expect(await screen.findByText('acknowledged up to ev-1')).toBeInTheDocument();
  });

  it('reports a failed acknowledge', async () => {
    // Scenario: the purge is rejected; the message must reach the operator.
    useSessionMock.mockReturnValue({
      traits: { userId: 'bob@acme', tenantId: 'acme', roles: ['admin'] },
    });
    peekMock.mockResolvedValue({ userId: 'bob@acme', events: [QUEUED] });
    ackMock.mockRejectedValue(new Error('nope'));
    render(<OfflineLabPage />);
    await screen.findByText('#1');

    await userEvent.click(screen.getByRole('button', { name: 'Acknowledge my queue' }));

    expect(await screen.findByText('Acknowledge failed')).toBeInTheDocument();
  });

  it('blocks acknowledging a queue that is not the caller own', async () => {
    // Scenario: the api only ever purges the caller's queue, so the control must
    // not imply it can drain someone else's.
    useSessionMock.mockReturnValue(ADMIN);
    peekMock.mockResolvedValue({ userId: 'bob@acme', events: [QUEUED] });
    render(<OfflineLabPage />);
    await screen.findByText('#1');

    expect(screen.getByRole('button', { name: 'Acknowledge my queue' })).toBeDisabled();
    expect(screen.getByText(/Sign in as this user/u)).toBeInTheDocument();
  });

  it('does not call the api when acknowledging an empty queue', async () => {
    // Scenario: with nothing queued there is no watermark to acknowledge.
    useSessionMock.mockReturnValue({
      traits: { userId: 'bob@acme', tenantId: 'acme', roles: ['admin'] },
    });
    peekMock.mockResolvedValue({ userId: 'bob@acme', events: [] });
    render(<OfflineLabPage />);
    await screen.findByText('Queue is empty');

    expect(screen.getByRole('button', { name: 'Acknowledge my queue' })).toBeDisabled();
    expect(ackMock).not.toHaveBeenCalled();
  });

  it('treats a session that has not resolved yet as unprivileged', async () => {
    // Scenario: the first paint has no traits, so the admin-only actions must stay
    // disabled rather than optimistically enabled.
    useSessionMock.mockReturnValue({ traits: null });
    peekMock.mockResolvedValue({ userId: 'bob@acme', events: [] });
    render(<OfflineLabPage />);
    await screen.findByText('Queue is empty');

    expect(screen.getByRole('button', { name: 'Enqueue while offline' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Refresh queue' })).toBeDisabled();
  });

  it('enqueues the burst size the operator chose', async () => {
    // Scenario: the size field drives the request, so a changed value must be sent.
    useSessionMock.mockReturnValue(ADMIN);
    peekMock.mockResolvedValue({ userId: 'bob@acme', events: [] });
    emitMock.mockResolvedValue({ emitted: 12 });
    render(<OfflineLabPage />);
    await screen.findByText('Queue is empty');

    const size = screen.getByLabelText('Burst size');
    await userEvent.clear(size);
    await userEvent.type(size, '12');
    await userEvent.click(screen.getByRole('button', { name: 'Enqueue while offline' }));

    await waitFor(() => expect(emitMock).toHaveBeenCalledWith('bob@acme', 12));
  });

  it('re-reads the queue when the target user changes', async () => {
    // Scenario: switching target must not show the previous user's queue.
    useSessionMock.mockReturnValue(ADMIN);
    peekMock.mockResolvedValue({ userId: 'gil@globex', events: [] });
    render(<OfflineLabPage />);
    await screen.findByText('Queue is empty');

    const field = screen.getByLabelText('Target user');
    await userEvent.clear(field);
    await userEvent.type(field, 'gil@globex');

    await waitFor(() => expect(peekMock).toHaveBeenCalledWith('gil@globex'));
  });
});
