/**
 * @fileoverview Unit tests for the demo login page.
 * @layer test
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-error';

import LoginPage from './page';

const pushMock = vi.fn();
const loginMock =
  vi.fn<
    (username: string) => Promise<{ userId: string; tenantId: string; roles: readonly string[] }>
  >();
const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('@/lib/api-client', () => ({
  ApiError,
  authApi: { login: (username: string) => loginMock(username) },
}));

vi.mock('@/lib/session-context', () => ({
  useSession: () => ({ refresh: refreshMock }),
}));

describe('LoginPage', () => {
  it('lists every seeded demo user', () => {
    // Scenario: three demo identities are offered as one-click login options.
    render(<LoginPage />);
    expect(screen.getByText('ana@acme')).toBeInTheDocument();
    expect(screen.getByText('bob@acme')).toBeInTheDocument();
    expect(screen.getByText('gil@globex')).toBeInTheDocument();
  });

  it('logs in, refreshes the session, and navigates home on success', async () => {
    // Scenario: clicking a demo user sets the cookie and redirects to the live feed.
    loginMock.mockResolvedValueOnce({ userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] });
    render(<LoginPage />);
    const user = userEvent.setup();
    await user.click(screen.getByText('ana@acme'));
    expect(loginMock).toHaveBeenCalledWith('ana@acme');
    expect(refreshMock).toHaveBeenCalledOnce();
    expect(pushMock).toHaveBeenCalledWith('/');
  });

  it('shows the api error message when login fails', async () => {
    // Scenario: an unknown demo user id (should not happen with the fixed list, but defensive).
    loginMock.mockRejectedValueOnce(new ApiError(401, 'unknown demo user'));
    render(<LoginPage />);
    const user = userEvent.setup();
    await user.click(screen.getByText('bob@acme'));
    expect(await screen.findByText('unknown demo user')).toBeInTheDocument();
  });

  it('shows a generic message for a non-api failure', async () => {
    // Scenario: an unexpected network failure during login.
    loginMock.mockRejectedValueOnce(new Error('network down'));
    render(<LoginPage />);
    const user = userEvent.setup();
    await user.click(screen.getByText('gil@globex'));
    expect(await screen.findByText('Login failed')).toBeInTheDocument();
  });
});
