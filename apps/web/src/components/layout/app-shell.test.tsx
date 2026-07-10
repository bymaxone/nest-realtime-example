/**
 * @fileoverview Unit tests for {@link AppShell}'s mobile overlay state.
 * @layer test
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AppShell } from './app-shell';

vi.mock('@bymax-one/nest-realtime/react', () => ({
  useRealtimeConnection: () => ({ connected: false, reconnect: vi.fn() }),
}));

vi.mock('@/lib/session-context', () => ({
  useSession: () => ({ status: 'anonymous', traits: null, logout: vi.fn() }),
}));

describe('AppShell', () => {
  it('renders page content inside the main content well', () => {
    // Scenario: children render inside the centered main area.
    render(
      <AppShell>
        <p>Page content</p>
      </AppShell>,
    );
    expect(screen.getByText('Page content')).toBeInTheDocument();
  });

  it('opens and closes the mobile overlay via the hamburger and the backdrop', async () => {
    // Scenario: the hamburger opens the overlay; clicking the backdrop closes it.
    render(
      <AppShell>
        <p>Page content</p>
      </AppShell>,
    );
    const user = userEvent.setup();
    expect(screen.queryByRole('button', { name: 'Close navigation menu' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    const backdrop = screen.getByRole('button', { name: 'Close navigation menu' });
    expect(backdrop).toBeInTheDocument();
    await user.click(backdrop);
    expect(screen.queryByRole('button', { name: 'Close navigation menu' })).not.toBeInTheDocument();
  });

  it('closes the mobile overlay after clicking a nav link', async () => {
    // Scenario: navigating away also dismisses the still-open mobile overlay.
    render(
      <AppShell>
        <p>Page content</p>
      </AppShell>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    await user.click(screen.getByRole('link', { name: /Presence/ }));
    expect(screen.queryByRole('button', { name: 'Close navigation menu' })).not.toBeInTheDocument();
  });
});
