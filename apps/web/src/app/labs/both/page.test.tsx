/**
 * @fileoverview Unit tests for the both-mode split-screen lab page.
 * @layer test
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { SplitPanelProps } from '@/components/realtime/split-panel';
import { ApiError } from '@/lib/api-error';

import BothLabPage from './page';

interface MockSessionValue {
  readonly traits: { userId: string; tenantId: string; roles: readonly string[] } | null;
}

const useSessionMock = vi.fn<() => MockSessionValue>();
const mintWsTokenMock = vi.fn<() => Promise<{ token: string; expiresAt: string }>>();
const toUserMock =
  vi.fn<(userId: string, event: string, data: unknown) => Promise<{ accepted: true }>>();

vi.mock('@/lib/session-context', () => ({
  useSession: () => useSessionMock(),
}));

vi.mock('@/lib/api-client', () => ({
  ApiError,
  authApi: { mintWsToken: () => mintWsTokenMock() },
  emitApi: {
    toUser: (userId: string, event: string, data: unknown) => toUserMock(userId, event, data),
  },
}));

vi.mock('@/components/realtime/split-panel', () => ({
  SplitPanel: ({ label, onNonce }: SplitPanelProps) => (
    <button type="button" onClick={() => onNonce('shared-nonce')}>
      {label} panel
    </button>
  ),
}));

describe('BothLabPage', () => {
  it('shows a minting placeholder for the WebSocket panel until the token resolves', async () => {
    // Scenario: the ws-token mint is in flight when the page first renders.
    useSessionMock.mockReturnValue({
      traits: { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] },
    });
    mintWsTokenMock.mockResolvedValueOnce({
      token: 'ws-token',
      expiresAt: '2026-01-01T00:00:00.000Z',
    });
    render(<BothLabPage />);
    expect(screen.getByText('Minting a WebSocket token...')).toBeInTheDocument();
    expect(await screen.findByText('WebSocket panel')).toBeInTheDocument();
  });

  it('shows waiting copy until only one panel has observed a nonce', async () => {
    // Scenario: only the SSE panel has observed a nonce so far.
    useSessionMock.mockReturnValue({
      traits: { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] },
    });
    mintWsTokenMock.mockRejectedValueOnce(new Error('no token'));
    render(<BothLabPage />);
    const user = userEvent.setup();
    await user.click(screen.getByText('SSE panel'));
    expect(screen.getByText('waiting for a matching nonce on both panels')).toBeInTheDocument();
  });

  it('shows a nonce match once both panels observe the same nonce', async () => {
    // Scenario: both transports independently observe the same emitted nonce.
    useSessionMock.mockReturnValue({
      traits: { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] },
    });
    mintWsTokenMock.mockResolvedValueOnce({
      token: 'ws-token',
      expiresAt: '2026-01-01T00:00:00.000Z',
    });
    render(<BothLabPage />);
    const user = userEvent.setup();
    await user.click(screen.getByText('SSE panel'));
    await user.click(await screen.findByText('WebSocket panel'));
    expect(screen.getByText('nonce match: both panels received shared-nonce')).toBeInTheDocument();
  });

  it('emits to both transports and shows the truncated nonce', async () => {
    // Scenario: the emit button targets the caller's own user with a fresh nonce.
    useSessionMock.mockReturnValue({
      traits: { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] },
    });
    mintWsTokenMock.mockRejectedValueOnce(new Error('no token'));
    toUserMock.mockResolvedValueOnce({ accepted: true });
    render(<BothLabPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Emit to both' }));
    expect(await screen.findByText(/emitted nonce/)).toBeInTheDocument();
    const [userId, event, data] = toUserMock.mock.calls[0] as [string, string, { nonce: string }];
    expect(userId).toBe('ana@acme');
    expect(event).toBe('lab.both');
    expect(typeof data.nonce).toBe('string');
  });

  it('shows an api error message when the emit fails, and does nothing without a session', async () => {
    // Scenario: the emit is rejected, and the emit button is a no-op with no session.
    useSessionMock.mockReturnValueOnce({ traits: null }).mockReturnValue({
      traits: { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] },
    });
    mintWsTokenMock.mockRejectedValue(new Error('no token'));
    const { rerender } = render(<BothLabPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Emit to both' }));
    expect(toUserMock).not.toHaveBeenCalled();

    toUserMock.mockRejectedValueOnce(new ApiError(500, 'internal error'));
    rerender(<BothLabPage />);
    await user.click(screen.getByRole('button', { name: 'Emit to both' }));
    expect(await screen.findByText('internal error')).toBeInTheDocument();
  });

  it('shows a generic message for a non-api emit failure', async () => {
    // Scenario: an unexpected non-ApiError rejection (e.g. a network failure).
    useSessionMock.mockReturnValue({
      traits: { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] },
    });
    mintWsTokenMock.mockRejectedValueOnce(new Error('no token'));
    toUserMock.mockRejectedValueOnce(new Error('network down'));
    render(<BothLabPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Emit to both' }));
    expect(await screen.findByText('Emit failed')).toBeInTheDocument();
  });
});
