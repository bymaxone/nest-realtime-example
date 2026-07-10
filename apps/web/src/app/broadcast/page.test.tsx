/**
 * @fileoverview Unit tests for the broadcast console page.
 * @layer test
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import BroadcastPage from './page';

interface MockSessionValue {
  readonly traits: { userId: string; tenantId: string; roles: readonly string[] } | null;
}

const useSessionMock = vi.fn<() => MockSessionValue>();
const toUserMock =
  vi.fn<(target: string, event: string, data: unknown) => Promise<{ accepted: true }>>();
const toTenantMock =
  vi.fn<(target: string, event: string, data: unknown) => Promise<{ accepted: true }>>();
const toRoomMock =
  vi.fn<(target: string, event: string, data: unknown) => Promise<{ accepted: true }>>();
const broadcastMock = vi.fn<(event: string, data: unknown) => Promise<{ accepted: true }>>();

vi.mock('@/lib/session-context', () => ({
  useSession: () => useSessionMock(),
}));

vi.mock('@/lib/api-client', () => ({
  ApiError: class ApiError extends Error {},
  emitApi: {
    toUser: (target: string, event: string, data: unknown) => toUserMock(target, event, data),
    toTenant: (target: string, event: string, data: unknown) => toTenantMock(target, event, data),
    toRoom: (target: string, event: string, data: unknown) => toRoomMock(target, event, data),
    broadcast: (event: string, data: unknown) => broadcastMock(event, data),
  },
}));

describe('BroadcastPage', () => {
  it('renders three scoped cards and a role-gated placeholder for a non-admin session', () => {
    // Scenario: a member session cannot see the admin-only broadcast card.
    useSessionMock.mockReturnValue({
      traits: { userId: 'bob@acme', tenantId: 'acme', roles: ['member'] },
    });
    render(<BroadcastPage />);
    expect(screen.getByText('Emit to user')).toBeInTheDocument();
    expect(screen.getByText('Emit to tenant')).toBeInTheDocument();
    expect(screen.getByText('Emit to room')).toBeInTheDocument();
    expect(screen.getByText('Broadcast requires the admin role')).toBeInTheDocument();
    expect(screen.queryByText('Broadcast')).not.toBeInTheDocument();
  });

  it('renders every card even with no session yet', () => {
    // Scenario: the page renders before the session lookup resolves.
    useSessionMock.mockReturnValue({ traits: null });
    render(<BroadcastPage />);
    expect(screen.getByText('Broadcast requires the admin role')).toBeInTheDocument();
  });

  it('submits the user, tenant, and room emit cards to their matching endpoints', async () => {
    // Scenario: each scoped card wires its target field to the right emit function.
    // The non-null assertions below index into `getAllByLabelText`/`getAllByRole`
    // results for a fixed, non-admin render (exactly 3 "Event name" fields and 3
    // "Emit" buttons), so indices 0-2 are always present.
    useSessionMock.mockReturnValue({
      traits: { userId: 'ana@acme', tenantId: 'acme', roles: ['member'] },
    });
    toUserMock.mockResolvedValue({ accepted: true });
    toTenantMock.mockResolvedValue({ accepted: true });
    toRoomMock.mockResolvedValue({ accepted: true });
    render(<BroadcastPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('User ID'), 'bob@acme');
    await user.type(screen.getAllByLabelText('Event name')[0]!, 'incident.updated');
    await user.click(screen.getAllByRole('button', { name: 'Emit' })[0]!);
    expect(toUserMock).toHaveBeenCalledWith('bob@acme', 'incident.updated', {});

    await user.type(screen.getByLabelText('Tenant ID'), 'acme');
    await user.type(screen.getAllByLabelText('Event name')[1]!, 'incident.updated');
    await user.click(screen.getAllByRole('button', { name: 'Emit' })[1]!);
    expect(toTenantMock).toHaveBeenCalledWith('acme', 'incident.updated', {});

    await user.type(screen.getByLabelText('Room ID'), 'resource:incident:1');
    await user.type(screen.getAllByLabelText('Event name')[2]!, 'incident.updated');
    await user.click(screen.getAllByRole('button', { name: 'Emit' })[2]!);
    expect(toRoomMock).toHaveBeenCalledWith('resource:incident:1', 'incident.updated', {});
  });

  it('submits the broadcast card for an admin session, with no target', async () => {
    // Scenario: an admin session can reach the broadcast scope, which has no target field.
    useSessionMock.mockReturnValue({
      traits: { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] },
    });
    broadcastMock.mockResolvedValue({ accepted: true });
    render(<BroadcastPage />);
    expect(screen.getByText('Broadcast')).toBeInTheDocument();
    const user = userEvent.setup();
    // Non-null: the admin render always has 4 cards, so the last element exists.
    const eventInputs = screen.getAllByLabelText('Event name');
    await user.type(eventInputs[eventInputs.length - 1]!, 'incident.updated');
    const emitButtons = screen.getAllByRole('button', { name: 'Emit' });
    await user.click(emitButtons[emitButtons.length - 1]!);
    expect(broadcastMock).toHaveBeenCalledWith('incident.updated', {});
  });
});
