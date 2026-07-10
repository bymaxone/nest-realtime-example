/**
 * @fileoverview Unit test for {@link ManagedConnection}, exercising the patched backoff tuning.
 * @layer test
 */

import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MockEventSource } from '@/test/mock-event-source';

import { ManagedConnection } from './managed-connection';

describe('ManagedConnection', () => {
  beforeEach(() => {
    MockEventSource.reset();
    vi.stubGlobal('EventSource', MockEventSource);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows disconnected with zero attempts before the first open', () => {
    // Scenario: freshly mounted, no error has occurred yet.
    render(<ManagedConnection initialDelayMs={100} maxDelayMs={1000} maxAttempts={5} />);
    expect(screen.getByText('disconnected')).toBeInTheDocument();
    expect(screen.getByText('reconnect attempts: 0')).toBeInTheDocument();
  });

  it('stops scheduling automatic reconnects once maxAttempts is reached', () => {
    // Scenario: the tuned `maxAttempts` caps automatic retries, a genuine hook feature.
    render(<ManagedConnection initialDelayMs={100} maxDelayMs={1000} maxAttempts={1} />);
    const source = MockEventSource.instances[0];
    act(() => source?.triggerError());
    expect(screen.getByText('reconnect attempts: 1')).toBeInTheDocument();
    void act(() => vi.advanceTimersByTime(5000));
    // maxAttempts of 1 means the single failure never schedules a retry.
    expect(MockEventSource.instances).toHaveLength(1);
  });

  it('schedules an automatic reconnect below maxAttempts and resets attempts on success', () => {
    // Scenario: with headroom left, the backoff timer opens a fresh connection.
    render(<ManagedConnection initialDelayMs={100} maxDelayMs={1000} maxAttempts={5} />);
    const first = MockEventSource.instances[0];
    act(() => first?.triggerError());
    expect(screen.getByText('reconnect attempts: 1')).toBeInTheDocument();
    void act(() => vi.advanceTimersByTime(200));
    expect(MockEventSource.instances).toHaveLength(2);

    const second = MockEventSource.instances[1];
    act(() => second?.triggerOpen());
    expect(screen.getByText('reconnect attempts: 0')).toBeInTheDocument();
  });

  it('opens a fresh connection when the force-reconnect link is clicked', () => {
    // Scenario: the manual reconnect resets backoff and opens a new EventSource.
    render(<ManagedConnection initialDelayMs={100} maxDelayMs={1000} maxAttempts={5} />);
    act(() => screen.getByText('force reconnect').click());
    expect(MockEventSource.instances.length).toBeGreaterThanOrEqual(2);
  });
});
