/**
 * @fileoverview Unit tests for the {@link Button} primitive.
 * @layer test
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './button';

describe('Button', () => {
  it('renders as a button with the default primary variant and calls onClick', async () => {
    // Scenario: the default variant renders a clickable button.
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Emit</Button>);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Emit' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders every visual variant', () => {
    // Scenario: outline, ghost, and destructive variants all render without error.
    render(
      <>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Outline' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ghost' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Destructive' })).toBeInTheDocument();
  });

  it('respects an explicit type override', () => {
    // Scenario: a submit button inside a form.
    render(<Button type="submit">Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'submit');
  });
});
