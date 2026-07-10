/**
 * @fileoverview Unit tests for the {@link Sidebar} navigation rail.
 * @layer test
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePathname } from 'next/navigation';
import { describe, expect, it, vi } from 'vitest';

import { Sidebar } from './sidebar';

describe('Sidebar', () => {
  it('marks the root route active only on an exact match', () => {
    // Scenario: the root Live Feed route uses exact matching, not a prefix match.
    vi.mocked(usePathname).mockReturnValue('/');
    render(<Sidebar isOpen onNavClick={vi.fn()} />);
    expect(screen.getByRole('link', { name: /Live Feed/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Presence/ })).not.toHaveAttribute('aria-current');
  });

  it('marks a nested route active via prefix matching', () => {
    // Scenario: a lab sub-route still highlights its parent nav item.
    vi.mocked(usePathname).mockReturnValue('/labs/ticket/details');
    render(<Sidebar isOpen onNavClick={vi.fn()} />);
    expect(screen.getByRole('link', { name: /Ticket/ })).toHaveAttribute('aria-current', 'page');
  });

  it('calls onNavClick when a link is clicked, and toggles visibility via isOpen', async () => {
    // Scenario: mobile overlay closes itself after navigating.
    vi.mocked(usePathname).mockReturnValue('/');
    const onNavClick = vi.fn();
    const { rerender, container } = render(<Sidebar isOpen onNavClick={onNavClick} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: /Presence/ }));
    expect(onNavClick).toHaveBeenCalledOnce();

    rerender(<Sidebar isOpen={false} onNavClick={onNavClick} />);
    expect(container.querySelector('nav')).toHaveClass('hidden');
  });
});
