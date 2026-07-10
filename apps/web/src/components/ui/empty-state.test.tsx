/**
 * @fileoverview Unit tests for the {@link EmptyState} primitive.
 * @layer test
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('renders the title alone when no children are given', () => {
    // Scenario: an empty state with no action content.
    render(<EmptyState title="No events yet" />);
    expect(screen.getByText('No events yet')).toBeInTheDocument();
  });

  it('renders action-oriented children below the title', () => {
    // Scenario: an empty state pointing the user at a next action.
    render(<EmptyState title="No orders yet">Trigger a simulate action.</EmptyState>);
    expect(screen.getByText('Trigger a simulate action.')).toBeInTheDocument();
  });
});
