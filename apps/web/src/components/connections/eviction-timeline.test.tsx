/**
 * @fileoverview Unit tests for {@link EvictionTimeline}.
 * @layer test
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EvictionTimeline } from './eviction-timeline';

/** Build `count` open connections with predictable ids, oldest first. */
function buildTimeline(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    connectionId: `c-${index}`,
    userId: 'ana@acme',
    connectedAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    evictedAt: null,
    reason: null,
  }));
}

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

  it('renders only the newest entries and reports how many are hidden', () => {
    // Scenario: a reconnect storm filled the server-side history; rendering all of
    // it would produce a page tens of thousands of pixels tall.
    render(<EvictionTimeline timeline={buildTimeline(30)} />);
    expect(screen.getByText('5 older connections not shown.')).toBeInTheDocument();
    expect(screen.queryByText('c-0')).not.toBeInTheDocument();
    expect(screen.getByText('c-29')).toBeInTheDocument();
  });

  it('uses the singular when exactly one entry is hidden', () => {
    // Scenario: one over the limit reads as "1 older connection", not "connections".
    render(<EvictionTimeline timeline={buildTimeline(26)} />);
    expect(screen.getByText('1 older connection not shown.')).toBeInTheDocument();
  });

  it('reports nothing hidden when the history fits', () => {
    // Scenario: a short history renders whole, with no truncation notice.
    render(<EvictionTimeline timeline={buildTimeline(3)} />);
    expect(screen.queryByText(/not shown/u)).not.toBeInTheDocument();
    expect(screen.getByText('c-0')).toBeInTheDocument();
  });
});
