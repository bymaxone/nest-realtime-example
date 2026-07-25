/**
 * @fileoverview Unit tests for the reauthentication lab page.
 * @layer test
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-error';
import { makeRealtimeContext, type RealtimeContextFake } from '@/test-utils/realtime-mocks';

import ReauthLabPage from './page';

interface MockSessionValue {
  readonly traits: { userId: string; tenantId: string; roles: readonly string[] } | null;
}

const useSessionMock = vi.fn<() => MockSessionValue>();
const useRealtimeContextMock = vi.fn<() => RealtimeContextFake>();
const statsMock = vi.fn<() => Promise<{ revalidations: readonly unknown[] }>>();
const revokeMock = vi.fn<(userId: string) => Promise<{ userId: string; revoked: boolean }>>();
const restoreMock = vi.fn<(userId: string) => Promise<{ userId: string; revoked: boolean }>>();

vi.mock('@bymax-one/nest-realtime/react', () => ({
  useRealtimeContext: () => useRealtimeContextMock(),
}));

vi.mock('@/lib/session-context', () => ({
  useSession: () => useSessionMock(),
}));

vi.mock('@/lib/api-client', () => ({
  ApiError,
  reauthLabApi: {
    stats: () => statsMock(),
    revoke: (userId: string) => revokeMock(userId),
    restore: (userId: string) => restoreMock(userId),
  },
}));

/** An admin session for the acme tenant. */
const ADMIN = { traits: { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] } };

describe('ReauthLabPage', () => {
  it('defaults the target to the signed-in user and lists the revalidation counters', async () => {
    // Scenario: revoking yourself is the demonstration, so it is the default target.
    useSessionMock.mockReturnValue(ADMIN);
    useRealtimeContextMock.mockReturnValue(makeRealtimeContext());
    statsMock.mockResolvedValue({ revalidations: [{ userId: 'ana@acme', revalidations: 4 }] });
    render(<ReauthLabPage />);

    expect(await screen.findByText('4 revalidations')).toBeInTheDocument();
    expect(screen.getByLabelText('Target user')).toHaveValue('ana@acme');
  });

  it('uses the singular for a single revalidation', async () => {
    // Scenario: the first cycle must not read "1 revalidations".
    useSessionMock.mockReturnValue(ADMIN);
    useRealtimeContextMock.mockReturnValue(makeRealtimeContext());
    statsMock.mockResolvedValue({ revalidations: [{ userId: 'ana@acme', revalidations: 1 }] });
    render(<ReauthLabPage />);

    expect(await screen.findByText('1 revalidation')).toBeInTheDocument();
  });

  it('renders an empty state before any cycle has run', async () => {
    // Scenario: nothing has been revalidated yet on a fresh boot.
    useSessionMock.mockReturnValue(ADMIN);
    useRealtimeContextMock.mockReturnValue(makeRealtimeContext());
    statsMock.mockResolvedValue({ revalidations: [] });
    render(<ReauthLabPage />);

    expect(await screen.findByText('No revalidation observed yet')).toBeInTheDocument();
  });

  it('tolerates the counters endpoint rejecting', async () => {
    // Scenario: the admin-only stats endpoint refuses a member session; the page
    // must still render rather than surfacing a raw failure.
    useSessionMock.mockReturnValue(ADMIN);
    useRealtimeContextMock.mockReturnValue(makeRealtimeContext());
    statsMock.mockRejectedValue(new ApiError(403, 'admin role required'));
    render(<ReauthLabPage />);

    expect(await screen.findByText('No revalidation observed yet')).toBeInTheDocument();
  });

  it('revokes the target and reports what will happen next', async () => {
    // Scenario: the operator kills a user's sessions; the copy must say that the
    // close happens on the next cycle, not instantly.
    useSessionMock.mockReturnValue(ADMIN);
    useRealtimeContextMock.mockReturnValue(makeRealtimeContext());
    statsMock.mockResolvedValue({ revalidations: [] });
    revokeMock.mockResolvedValue({ userId: 'ana@acme', revoked: true });
    render(<ReauthLabPage />);
    await screen.findByText('No revalidation observed yet');

    await userEvent.click(screen.getByRole('button', { name: 'Revoke sessions' }));

    expect(revokeMock).toHaveBeenCalledWith('ana@acme');
    expect(await screen.findByText(/streams close on the next reauth cycle/u)).toBeInTheDocument();
  });

  it('restores the target and reports that new connections authenticate again', async () => {
    // Scenario: clearing the marker must be as legible as setting it.
    useSessionMock.mockReturnValue(ADMIN);
    useRealtimeContextMock.mockReturnValue(makeRealtimeContext());
    statsMock.mockResolvedValue({ revalidations: [] });
    restoreMock.mockResolvedValue({ userId: 'ana@acme', revoked: false });
    render(<ReauthLabPage />);
    await screen.findByText('No revalidation observed yet');

    await userEvent.click(screen.getByRole('button', { name: 'Restore' }));

    expect(restoreMock).toHaveBeenCalledWith('ana@acme');
    expect(await screen.findByText(/authenticate again/u)).toBeInTheDocument();
  });

  it('surfaces the api error envelope when revocation is refused', async () => {
    // Scenario: a member session cannot revoke; show the api's own message.
    useSessionMock.mockReturnValue(ADMIN);
    useRealtimeContextMock.mockReturnValue(makeRealtimeContext());
    statsMock.mockResolvedValue({ revalidations: [] });
    revokeMock.mockRejectedValue(new ApiError(403, 'admin role required'));
    render(<ReauthLabPage />);
    await screen.findByText('No revalidation observed yet');

    await userEvent.click(screen.getByRole('button', { name: 'Revoke sessions' }));

    expect(await screen.findByText('admin role required')).toBeInTheDocument();
  });

  it('shows a generic message for a non-api revocation failure', async () => {
    // Scenario: a network-level rejection carries no envelope.
    useSessionMock.mockReturnValue(ADMIN);
    useRealtimeContextMock.mockReturnValue(makeRealtimeContext());
    statsMock.mockResolvedValue({ revalidations: [] });
    revokeMock.mockRejectedValue(new Error('offline'));
    render(<ReauthLabPage />);
    await screen.findByText('No revalidation observed yet');

    await userEvent.click(screen.getByRole('button', { name: 'Revoke sessions' }));

    expect(await screen.findByText('Failed to revoke the user')).toBeInTheDocument();
  });

  it('disables revocation and explains why for a member session', async () => {
    // Scenario: revoking another principal's sessions is privileged.
    useSessionMock.mockReturnValue({
      traits: { userId: 'bob@acme', tenantId: 'acme', roles: ['member'] },
    });
    useRealtimeContextMock.mockReturnValue(makeRealtimeContext());
    statsMock.mockResolvedValue({ revalidations: [] });
    render(<ReauthLabPage />);
    await screen.findByText('No revalidation observed yet');

    expect(screen.getByRole('button', { name: 'Revoke sessions' })).toBeDisabled();
    expect(screen.getByText('Revocation requires the admin role.')).toBeInTheDocument();
  });

  it('renders the reserved reauthentication-failed events this tab observed', async () => {
    // Scenario: revoking yourself makes the library announce the failure on your
    // own feed just before the stream closes; that is the proof the lab exists for.
    useSessionMock.mockReturnValue(ADMIN);
    useRealtimeContextMock.mockReturnValue(
      makeRealtimeContext({
        events: [
          { type: 'connection:reauthentication-failed', data: { reason: 'revoked' } },
          { type: 'order.created', data: { orderId: 'o-1' } },
        ],
      }),
    );
    statsMock.mockResolvedValue({ revalidations: [] });
    render(<ReauthLabPage />);

    expect(await screen.findByText('1 received')).toBeInTheDocument();
    expect(screen.getByText(/"reason":"revoked"/u)).toBeInTheDocument();
  });

  it('reports none yet when no failure has been observed', async () => {
    // Scenario: a healthy connection has nothing to show here.
    useSessionMock.mockReturnValue(ADMIN);
    useRealtimeContextMock.mockReturnValue(makeRealtimeContext());
    statsMock.mockResolvedValue({ revalidations: [] });
    render(<ReauthLabPage />);

    expect(await screen.findByText('none yet')).toBeInTheDocument();
    expect(screen.getByText('No reauthentication failure seen')).toBeInTheDocument();
  });

  it('keeps the target field editable so another user can be revoked', async () => {
    // Scenario: an operator revokes a different principal than themselves.
    useSessionMock.mockReturnValue(ADMIN);
    useRealtimeContextMock.mockReturnValue(makeRealtimeContext());
    statsMock.mockResolvedValue({ revalidations: [] });
    revokeMock.mockResolvedValue({ userId: 'bob@acme', revoked: true });
    render(<ReauthLabPage />);
    await screen.findByText('No revalidation observed yet');

    const field = screen.getByLabelText('Target user');
    await userEvent.clear(field);
    await userEvent.type(field, 'bob@acme');
    await userEvent.click(screen.getByRole('button', { name: 'Revoke sessions' }));

    await waitFor(() => expect(revokeMock).toHaveBeenCalledWith('bob@acme'));
  });

  it('refuses to act on a blank target instead of calling the endpoint', async () => {
    // Scenario: an operator clears the field. An empty id would build
    // `/auth/revoke/`, a different route from `/auth/revoke/:userId`, so the page
    // says what is missing rather than issuing a request that cannot succeed.
    useSessionMock.mockReturnValue(ADMIN);
    useRealtimeContextMock.mockReturnValue(makeRealtimeContext());
    statsMock.mockResolvedValue({ revalidations: [] });
    render(<ReauthLabPage />);
    await screen.findByText('No revalidation observed yet');

    await userEvent.clear(screen.getByLabelText('Target user'));
    await userEvent.click(screen.getByRole('button', { name: 'Revoke sessions' }));

    expect(await screen.findByText('Enter a user id to revoke or restore.')).toBeInTheDocument();
    expect(revokeMock).not.toHaveBeenCalled();
  });

  it('trims whitespace around the target before revoking', async () => {
    // Scenario: a pasted id can carry surrounding spaces, which would be encoded
    // into the path and miss the user entirely.
    useSessionMock.mockReturnValue(ADMIN);
    useRealtimeContextMock.mockReturnValue(makeRealtimeContext());
    statsMock.mockResolvedValue({ revalidations: [] });
    revokeMock.mockResolvedValue({ userId: 'bob@acme', revoked: true });
    render(<ReauthLabPage />);
    await screen.findByText('No revalidation observed yet');

    const field = screen.getByLabelText('Target user');
    await userEvent.clear(field);
    await userEvent.type(field, '  bob@acme  ');
    await userEvent.click(screen.getByRole('button', { name: 'Revoke sessions' }));

    await waitFor(() => expect(revokeMock).toHaveBeenCalledWith('bob@acme'));
  });

  it('renders without a session before the identity lookup resolves', async () => {
    // Scenario: the first paint has no traits yet, so the target stays empty.
    useSessionMock.mockReturnValue({ traits: null });
    useRealtimeContextMock.mockReturnValue(makeRealtimeContext());
    statsMock.mockResolvedValue({ revalidations: [] });
    render(<ReauthLabPage />);

    expect(await screen.findByText('No revalidation observed yet')).toBeInTheDocument();
    expect(screen.getByLabelText('Target user')).toHaveValue('');
  });
});
