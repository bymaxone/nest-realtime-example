/**
 * @fileoverview Unit test for {@link TicketConnection}, exercising the real hook.
 * @layer test
 */

import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MockEventSource } from '@/test/mock-event-source';

import { TicketConnection } from './ticket-connection';

describe('TicketConnection', () => {
  beforeEach(() => {
    MockEventSource.reset();
    vi.stubGlobal('EventSource', MockEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens the SSE URL with the ticket on the query string and reports connected on open', () => {
    // Scenario: the one-shot ticket is appended to the events URL, never sent as a header.
    render(<TicketConnection ticket="one-shot-abc" />);
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0]?.url).toContain('ticket=one-shot-abc');
    expect(screen.getByText('disconnected')).toBeInTheDocument();

    act(() => MockEventSource.instances[0]?.triggerOpen());
    expect(screen.getByText('connected')).toBeInTheDocument();
    expect(screen.getByText('transport: sse')).toBeInTheDocument();
  });
});
