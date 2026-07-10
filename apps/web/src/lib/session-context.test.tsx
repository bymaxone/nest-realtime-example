/**
 * @fileoverview Unit tests for the client-side session context.
 * @layer test
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from './api-error';
import { SessionProvider, useSession } from './session-context';

const meMock =
  vi.fn<() => Promise<{ userId: string; tenantId: string; roles: readonly string[] }>>();
const logoutMock = vi.fn<() => Promise<{ ok: true }>>();

vi.mock('./api-client', () => ({
  ApiError,
  authApi: {
    me: () => meMock(),
    logout: () => logoutMock(),
  },
}));

/** Renders the session status and traits for assertions. */
function SessionProbe() {
  const { status, traits, logout } = useSession();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="user">{traits?.userId ?? 'none'}</span>
      <button onClick={() => void logout()}>logout</button>
    </div>
  );
}

describe('SessionProvider', () => {
  it('resolves to authenticated when /auth/me succeeds', async () => {
    // Scenario: an existing session cookie resolves to the caller's traits.
    meMock.mockResolvedValueOnce({ userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] });
    render(
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(screen.getByTestId('user')).toHaveTextContent('ana@acme');
  });

  it('resolves to anonymous when /auth/me returns a 401', async () => {
    // Scenario: no session cookie is present; a 401 is a normal, expected outcome.
    meMock.mockRejectedValueOnce(new ApiError(401, 'unauthorized'));
    render(
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));
  });

  it('resolves to anonymous on a non-401 failure rather than hanging on loading', async () => {
    // Scenario: a transient network or server error is treated as "not logged in for now".
    meMock.mockRejectedValueOnce(new Error('network down'));
    render(
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));
  });

  it('clears the session and reports anonymous after logout', async () => {
    // Scenario: the logout button clears traits and flips status back to anonymous.
    const user = userEvent.setup();
    meMock.mockResolvedValueOnce({ userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] });
    logoutMock.mockResolvedValueOnce({ ok: true });
    render(
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    await user.click(screen.getByText('logout'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('throws when useSession is called outside a provider', () => {
    // Scenario: a programming error - a page forgets the provider boundary.
    function Bare() {
      useSession();
      return null;
    }
    expect(() => render(<Bare />)).toThrow('useSession must be used within <SessionProvider>');
  });
});
