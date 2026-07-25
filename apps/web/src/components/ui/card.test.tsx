/**
 * @fileoverview Unit tests for the {@link Card} primitive family.
 * @layer test
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card';

describe('Card', () => {
  it('renders the header, content, and footer regions of a page section', () => {
    // Scenario: the composition every page uses, with the padding rhythm coming
    // from the sub-parts rather than from a class at the call site.
    render(
      <Card className="extra">
        <CardHeader>
          <CardTitle>Live Operations Board</CardTitle>
          <CardDescription>Order and deployment events.</CardDescription>
        </CardHeader>
        <CardContent>body</CardContent>
        <CardFooter>actions</CardFooter>
      </Card>,
    );
    expect(screen.getByText('Live Operations Board').tagName).toBe('H2');
    expect(screen.getByText('Order and deployment events.').tagName).toBe('P');
    expect(screen.getByText('body')).toBeInTheDocument();
    expect(screen.getByText('actions')).toBeInTheDocument();
  });

  it('draws the brand accent hairline only when the header asks for it', () => {
    // Scenario: the accent marks a headline card, so it must be opt-in; the
    // hairline is decorative and therefore hidden from assistive technology.
    const plain = render(
      <CardHeader>
        <CardTitle>No accent</CardTitle>
      </CardHeader>,
    );
    expect(plain.container.querySelector('[aria-hidden="true"]')).toBeNull();

    const accented = render(
      <CardHeader accent>
        <CardTitle>With accent</CardTitle>
      </CardHeader>,
    );
    expect(accented.container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('anchors the accent hairline to the header itself', () => {
    // Scenario: the hairline is absolutely positioned, so the header has to be a
    // positioning context of its own. Without it a header rendered outside a Card
    // would stretch the line across whatever positioned ancestor is above it.
    const { container } = render(
      <CardHeader accent>
        <CardTitle>Anchored</CardTitle>
      </CardHeader>,
    );

    expect(container.firstElementChild).toHaveClass('relative');
  });
});
