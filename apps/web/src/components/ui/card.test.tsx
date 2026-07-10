/**
 * @fileoverview Unit tests for the {@link Card} primitive family.
 * @layer test
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Card, CardDescription, CardTitle } from './card';

describe('Card', () => {
  it('renders title, description, and children inside the glass container', () => {
    // Scenario: a typical page section composed from the three sub-parts.
    render(
      <Card className="extra">
        <CardTitle>Live Operations Board</CardTitle>
        <CardDescription>Order and deployment events.</CardDescription>
      </Card>,
    );
    expect(screen.getByText('Live Operations Board').tagName).toBe('H3');
    expect(screen.getByText('Order and deployment events.').tagName).toBe('P');
  });
});
