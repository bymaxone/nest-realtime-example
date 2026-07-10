/**
 * @fileoverview Unit tests for {@link SplitPanel}.
 * @layer test
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SplitPanel } from './split-panel';

interface MockRealtimeValue {
  readonly connected: boolean;
  readonly lastEvent: { type: string; data: unknown } | undefined;
  readonly transport: 'sse' | 'websocket';
}

const useRealtimeMock = vi.fn<(opts: unknown) => MockRealtimeValue>();

vi.mock('@bymax-one/nest-realtime/react', () => ({
  useRealtime: (opts: unknown) => useRealtimeMock(opts),
}));

describe('SplitPanel', () => {
  it('shows the detected transport and connection status', () => {
    // Scenario: an SSE panel is currently connected.
    useRealtimeMock.mockReturnValue({ connected: true, lastEvent: undefined, transport: 'sse' });
    render(
      <SplitPanel
        label="SSE"
        options={{ url: 'http://localhost:3001/api/events' }}
        onNonce={vi.fn()}
      />,
    );
    expect(screen.getByText('SSE')).toBeInTheDocument();
    expect(screen.getByText('connected')).toBeInTheDocument();
    expect(screen.getByText('detected transport: sse')).toBeInTheDocument();
  });

  it('reports a fresh nonce when the last event is a lab.both event', () => {
    // Scenario: the panel's own connection observed a `lab.both` payload.
    const onNonce = vi.fn();
    useRealtimeMock.mockReturnValue({
      connected: true,
      lastEvent: { type: 'lab.both', data: { nonce: 'abc123' } },
      transport: 'websocket',
    });
    render(
      <SplitPanel
        label="WebSocket"
        options={{ url: 'ws://localhost:3001/live' }}
        onNonce={onNonce}
      />,
    );
    expect(onNonce).toHaveBeenCalledWith('abc123');
  });

  it('does not call onNonce for an unrelated event', () => {
    // Scenario: some other reserved event arrives; it is not a nonce carrier.
    const onNonce = vi.fn();
    useRealtimeMock.mockReturnValue({
      connected: false,
      lastEvent: { type: 'connection:established', data: { connectionId: 'c1' } },
      transport: 'sse',
    });
    render(
      <SplitPanel
        label="SSE"
        options={{ url: 'http://localhost:3001/api/events' }}
        onNonce={onNonce}
      />,
    );
    expect(screen.getByText('disconnected')).toBeInTheDocument();
    expect(onNonce).not.toHaveBeenCalled();
  });
});
