/**
 * @fileoverview Integration test proving the shared connection semantics (matrix row 65).
 * @layer test
 *
 * Mounts two independent `useRealtimeContext()` consumers under one `Providers`
 * tree and asserts exactly one `EventSource` was constructed, and that it
 * subscribed to the application event names the provider configures.
 */

import { useRealtimeContext } from '@bymax-one/nest-realtime/react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MockEventSource } from '@/test/mock-event-source';

import { Providers } from './providers';

vi.mock('@/lib/api-client', () => ({
  ApiError: class ApiError extends Error {},
  authApi: { me: () => Promise.reject(new Error('no session in this test')) },
}));

/** A consumer reading the shared connection's `connected` flag. */
function ConsumerA() {
  const { connected } = useRealtimeContext();
  return <span data-testid="a">{connected ? 'a-connected' : 'a-disconnected'}</span>;
}

/** A second, independent consumer of the same shared connection. */
function ConsumerB() {
  const { connected } = useRealtimeContext();
  return <span data-testid="b">{connected ? 'b-connected' : 'b-disconnected'}</span>;
}

describe('Providers', () => {
  beforeEach(() => {
    MockEventSource.reset();
    vi.stubGlobal('EventSource', MockEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens exactly one EventSource shared by every descendant consumer', () => {
    // Scenario: two sibling components both call useRealtimeContext(); one connection serves both.
    render(
      <Providers>
        <ConsumerA />
        <ConsumerB />
      </Providers>,
    );
    expect(MockEventSource.instances).toHaveLength(1);

    act(() => MockEventSource.instances[0]?.triggerOpen());
    expect(screen.getByTestId('a')).toHaveTextContent('a-connected');
    expect(screen.getByTestId('b')).toHaveTextContent('b-connected');
  });

  it('subscribes to every application event name the provider configures', () => {
    // Scenario: order/deployment/lab events are registered so custom SSE names are not dropped.
    render(
      <Providers>
        <ConsumerA />
      </Providers>,
    );
    const source = MockEventSource.instances[0];
    expect(source?.listenerCount('order.created')).toBeGreaterThan(0);
    expect(source?.listenerCount('lab.replay')).toBeGreaterThan(0);
  });
});
