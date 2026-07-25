/**
 * @fileoverview Unit tests for {@link WiringSnapshot}.
 * @layer test
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { RealtimeWiringSnapshot } from '@/lib/api-client';

import { WiringSnapshot } from './wiring-snapshot';

/** A fully-populated SSE-profile snapshot. */
const SNAPSHOT: RealtimeWiringSnapshot = {
  instanceId: 'inst-1234abcd-more',
  transport: 'sse',
  transportKind: 'sse',
  sse: {
    endpoint: '/api/events',
    heartbeatMs: 10000,
    replayBufferSize: 10,
    maxConnectionsPerUser: 5,
    emitConnectionEvent: true,
  },
  providers: {
    authenticator: 'CompositeAuthenticator',
    hooks: 'CompositeLifecycleHooks',
    pubsub: 'InMemoryPubSub',
    presence: 'RedisPresenceStorage',
  },
};

describe('WiringSnapshot', () => {
  it('renders the resolved providers and the SSE options', () => {
    // Scenario: the reader wants to know what the module resolved from the options.
    render(<WiringSnapshot snapshot={SNAPSHOT} />);
    expect(screen.getByText('CompositeAuthenticator')).toBeInTheDocument();
    expect(screen.getByText('CompositeLifecycleHooks')).toBeInTheDocument();
    expect(screen.getByText('InMemoryPubSub')).toBeInTheDocument();
    expect(screen.getByText('RedisPresenceStorage')).toBeInTheDocument();
    expect(screen.getByText('/api/events')).toBeInTheDocument();
    expect(screen.getByText('10 events')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('truncates the instance id to a readable prefix', () => {
    // Scenario: the full uuid is noise; the first bytes are enough to tell instances apart.
    render(<WiringSnapshot snapshot={SNAPSHOT} />);
    expect(screen.getByText('instance: inst-123')).toBeInTheDocument();
  });

  it('omits the SSE block on a WebSocket-only boot', () => {
    // Scenario: a websocket profile resolves no SSE options, so those rows must not render.
    render(
      <WiringSnapshot
        snapshot={{ ...SNAPSHOT, transport: 'websocket', transportKind: 'websocket', sse: null }}
      />,
    );
    expect(screen.queryByText('/api/events')).not.toBeInTheDocument();
    expect(screen.getByText('transport: websocket')).toBeInTheDocument();
  });

  it('reports an unresolved provider as none rather than blank', () => {
    // Scenario: under the memory driver there is no pub/sub provider; a blank cell
    // would read as a rendering failure instead of a deliberate absence.
    render(
      <WiringSnapshot
        snapshot={{
          ...SNAPSHOT,
          providers: { authenticator: null, hooks: null, pubsub: null, presence: null },
        }}
      />,
    );
    expect(screen.getAllByText('none')).toHaveLength(4);
  });

  it('explains itself when the snapshot could not be read', () => {
    // Scenario: the introspection route is admin-only, so a member session gets nothing.
    render(<WiringSnapshot snapshot={null} />);
    expect(screen.getByText('Wiring snapshot unavailable')).toBeInTheDocument();
  });
});
