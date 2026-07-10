/**
 * @fileoverview Unit tests for the {@link Input} and {@link Label} primitives.
 * @layer test
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Input, Label } from './input';

describe('Input', () => {
  it('renders a labeled text input and accepts typed input', async () => {
    // Scenario: a form field with an associated label.
    render(
      <>
        <Label htmlFor="event">Event name</Label>
        <Input id="event" placeholder="incident.updated" />
      </>,
    );
    const input = screen.getByPlaceholderText('incident.updated');
    const user = userEvent.setup();
    await user.type(input, 'order.created');
    expect(input).toHaveValue('order.created');
    expect(screen.getByText('Event name').tagName).toBe('LABEL');
  });
});
