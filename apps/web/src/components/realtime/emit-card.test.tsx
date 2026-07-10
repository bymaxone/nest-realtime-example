/**
 * @fileoverview Unit tests for {@link EmitCard}.
 * @layer test
 */

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-error';

import { EmitCard } from './emit-card';

describe('EmitCard', () => {
  it('submits target, event, and parsed JSON payload to onSubmit', async () => {
    // Scenario: a user emits to a specific target with a JSON payload.
    const onSubmit = vi.fn().mockResolvedValue({ accepted: true });
    render(
      <EmitCard
        title="Emit to user"
        description="desc"
        targetLabel="User ID"
        targetPlaceholder="ana@acme"
        onSubmit={onSubmit}
      />,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('User ID'), 'ana@acme');
    await user.type(screen.getByLabelText('Event name'), 'incident.updated');
    fireEvent.change(screen.getByLabelText('Payload (JSON)'), { target: { value: '{"ok":true}' } });
    await user.click(screen.getByRole('button', { name: 'Emit' }));
    expect(onSubmit).toHaveBeenCalledWith('ana@acme', 'incident.updated', { ok: true });
    expect(await screen.findByText(/Accepted/)).toBeInTheDocument();
  });

  it('renders without a target field for the broadcast scope', () => {
    // Scenario: broadcast has no target; only event name and payload are shown.
    render(<EmitCard title="Broadcast" description="desc" onSubmit={vi.fn()} />);
    expect(screen.queryByLabelText('User ID')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Event name')).toBeInTheDocument();
  });

  it('blocks submission and shows the Zod error for a reserved event name', async () => {
    // Scenario: the client-side mirror rejects a reserved event name before any request.
    const onSubmit = vi.fn();
    render(<EmitCard title="Broadcast" description="desc" onSubmit={onSubmit} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Event name'), 'connection:established');
    await user.click(screen.getByRole('button', { name: 'Emit' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText('event name is reserved by the library')).toBeInTheDocument();
  });

  it('renders the api error message when the emit is rejected', async () => {
    // Scenario: a cross-tenant emit is rejected with the anti-IDOR 403 envelope.
    const onSubmit = vi.fn().mockRejectedValue(new ApiError(403, 'cross-tenant emit denied'));
    render(
      <EmitCard
        title="Emit to tenant"
        description="desc"
        targetLabel="Tenant ID"
        onSubmit={onSubmit}
      />,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Tenant ID'), 'globex');
    await user.type(screen.getByLabelText('Event name'), 'incident.updated');
    await user.click(screen.getByRole('button', { name: 'Emit' }));
    expect(await screen.findByText('cross-tenant emit denied')).toBeInTheDocument();
  });

  it('renders a generic message for a non-ApiError failure', async () => {
    // Scenario: an unexpected network failure during submit.
    const onSubmit = vi.fn().mockRejectedValue(new Error('network down'));
    render(<EmitCard title="Broadcast" description="desc" onSubmit={onSubmit} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Event name'), 'incident.updated');
    await user.click(screen.getByRole('button', { name: 'Emit' }));
    expect(await screen.findByText('Emit failed')).toBeInTheDocument();
  });
});
