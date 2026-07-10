/**
 * @fileoverview Unit tests for {@link EvictionTimeline}.
 * @layer test
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EvictionTimeline } from './eviction-timeline';

describe('EvictionTimeline', () => {
  it('renders an empty state with no connection history', () => {
    // Scenario: a brand-new user has never connected.
    render(<EvictionTimeline timeline={[]} />);
    expect(screen.getByText('No connection history yet')).toBeInTheDocument();
  });

  it('tags an open connection, a FIFO eviction, and an ordinary close distinctly', () => {
    // Scenario: three connections in `connectedAt` order show three different outcomes.
    render(
      <EvictionTimeline
        timeline={[
          {
            connectionId: 'c1',
            userId: 'ana@acme',
            connectedAt: '2026-01-01T00:00:00.000Z',
            evictedAt: '2026-01-01T00:01:00.000Z',
            reason: 'REALTIME_TOO_MANY_CONNECTIONS',
          },
          {
            connectionId: 'c2',
            userId: 'ana@acme',
            connectedAt: '2026-01-01T00:02:00.000Z',
            evictedAt: '2026-01-01T00:03:00.000Z',
            reason: 'client closed',
          },
          {
            connectionId: 'c3',
            userId: 'ana@acme',
            connectedAt: '2026-01-01T00:04:00.000Z',
            evictedAt: null,
            reason: null,
          },
        ]}
      />,
    );
    expect(screen.getByText('evicted (FIFO)')).toBeInTheDocument();
    expect(screen.getByText('closed')).toBeInTheDocument();
    expect(screen.getByText('open')).toBeInTheDocument();
  });
});
