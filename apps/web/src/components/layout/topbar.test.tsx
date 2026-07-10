/**
 * @fileoverview Unit tests for the {@link Topbar}.
 * @layer test
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Topbar } from './topbar';

interface MockConnectionValue {
  readonly connected: boolean;
  readonly reconnect: () => void;
}

interface MockSessionValue {
  readonly status: 'loading' | 'authenticated' | 'anonymous';
  readonly traits: { userId: string; tenantId: string; roles: readonly string[] } | null;
  readonly logout: () => void;
}

const useRealtimeConnectionMock = vi.fn<() => MockConnectionValue>();
const useSessionMock = vi.fn<() => MockSessionValue>();

vi.mock('@bymax-one/nest-realtime/react', () => ({
  useRealtimeConnection: () => useRealtimeConnectionMock(),
}));

vi.mock('@/lib/session-context', () => ({
  useSession: () => useSessionMock(),
}));

describe('Topbar', () => {
  it('shows the log-in link and the wordmark when anonymous', () => {
    // Scenario: no session yet; the shell offers a way to log in.
    useRealtimeConnectionMock.mockReturnValue({ connected: false, reconnect: vi.fn() });
    useSessionMock.mockReturnValue({ status: 'anonymous', traits: null, logout: vi.fn() });
    render(<Topbar onMenuOpen={vi.fn()} />);
    expect(screen.getByText('nest-realtime-example')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument();
  });

  it('shows the user id and a working logout button when authenticated', async () => {
    // Scenario: an authenticated session shows its user id and can log out.
    useRealtimeConnectionMock.mockReturnValue({ connected: true, reconnect: vi.fn() });
    const logout = vi.fn();
    useSessionMock.mockReturnValue({
      status: 'authenticated',
      traits: { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] },
      logout,
    });
    render(<Topbar onMenuOpen={vi.fn()} />);
    expect(screen.getByText('ana@acme')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(logout).toHaveBeenCalledOnce();
  });

  it('opens the mobile menu via the hamburger button', async () => {
    // Scenario: the hamburger button delegates to the shell's open handler.
    useRealtimeConnectionMock.mockReturnValue({ connected: false, reconnect: vi.fn() });
    useSessionMock.mockReturnValue({ status: 'loading', traits: null, logout: vi.fn() });
    const onMenuOpen = vi.fn();
    render(<Topbar onMenuOpen={onMenuOpen} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(onMenuOpen).toHaveBeenCalledOnce();
  });
});
