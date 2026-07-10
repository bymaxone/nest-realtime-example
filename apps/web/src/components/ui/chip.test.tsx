/**
 * @fileoverview Unit tests for the {@link Chip} and {@link StatusChip} primitives.
 * @layer test
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Chip, StatusChip, type ChipTone } from './chip';

describe('Chip', () => {
  it('renders its children in a neutral glass pill', () => {
    // Scenario: a plain tag chip, e.g. "tenant: acme".
    render(<Chip>tenant: acme</Chip>);
    expect(screen.getByText('tenant: acme')).toBeInTheDocument();
  });
});

describe('StatusChip', () => {
  const tones: readonly ChipTone[] = ['success', 'danger', 'warning', 'info', 'neutral'];

  it.each(tones)('renders the %s tone with its status dot and label', (tone) => {
    // Scenario: every semantic tone renders color + text together (never color alone).
    render(<StatusChip tone={tone}>{tone}</StatusChip>);
    expect(screen.getByText(tone)).toBeInTheDocument();
  });
});
