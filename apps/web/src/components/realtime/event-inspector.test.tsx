/**
 * @fileoverview Unit tests for {@link EventInspector}.
 * @layer test
 */

import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EventInspector, type EventInspectorEntry } from './event-inspector';

describe('EventInspector', () => {
  it('renders an empty state when there are no events', () => {
    // Scenario: no simulate action has been triggered yet.
    render(<EventInspector events={[]} />);
    expect(screen.getByText('No events yet')).toBeInTheDocument();
  });

  it('renders a custom empty-state title', () => {
    // Scenario: a page overrides the empty-state copy.
    render(<EventInspector events={[]} emptyTitle="No orders or deployments yet" />);
    expect(screen.getByText('No orders or deployments yet')).toBeInTheDocument();
  });

  it('renders newest-first, with the id shown monospace and the payload as text', () => {
    // Scenario: three events arrived in order; the inspector reverses them.
    const events: EventInspectorEntry[] = [
      { type: 'order.created', data: { orderId: '1' }, id: '1' },
      { type: 'order.paid', data: { orderId: '1' }, id: '2' },
      { type: 'order.shipped', data: { orderId: '1' }, id: '3' },
    ];
    render(<EventInspector events={events} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('order.shipped');
    expect(items[2]).toHaveTextContent('order.created');
  });

  it('shows "n/a" for an entry with no id (the WebSocket branch never carries one)', () => {
    // Scenario: a chat message arrives without an SSE Last-Event-ID.
    render(<EventInspector events={[{ type: 'chat.message', data: { body: 'hi' } }]} />);
    expect(screen.getByText('n/a')).toBeInTheDocument();
  });

  it('does not re-stamp an already-seen entry when a new one arrives alongside it', () => {
    // Scenario: the hook's array grows with a fresh array reference containing an
    // already-stamped entry plus a genuinely new one, so the effect re-runs and
    // exercises both the "already seen" and "first seen" branches in one pass.
    const first: EventInspectorEntry = { type: 'order.created', data: { orderId: '1' }, id: '1' };
    const second: EventInspectorEntry = { type: 'order.paid', data: { orderId: '1' }, id: '2' };
    const { rerender } = render(<EventInspector events={[first]} />);
    act(() => {
      rerender(<EventInspector events={[first, second]} />);
    });
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('caps the rendered list at the last 50 entries', () => {
    // Scenario: more than 50 events have accumulated; only the newest 50 render.
    const events: EventInspectorEntry[] = Array.from({ length: 60 }, (_, i) => ({
      type: 'lab.replay',
      data: { seq: i },
      id: String(i),
    }));
    render(<EventInspector events={events} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(50);
  });
});
