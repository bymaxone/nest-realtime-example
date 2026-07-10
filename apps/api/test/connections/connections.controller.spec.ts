/**
 * Unit tests for ConnectionsController.
 *
 * Layer: unit.
 * Goal: list returns the instance-tagged connections; disconnect passes the id and
 *       caller user id to the service and acknowledges; wiring returns the
 *       introspection service snapshot verbatim.
 * Mocks: a ConnectionsService double and a RealtimeIntrospectionService double.
 */

import type { PublicConnectionMeta } from '@bymax-one/nest-realtime';

import { APP_SERVICE_NAME } from '../../src/app.constants';
import { ConnectionsController } from '../../src/connections/connections.controller';
import type { ConnectionsService } from '../../src/connections/connections.service';
import {
  type RealtimeIntrospectionService,
  type RealtimeWiringSnapshot,
} from '../../src/connections/realtime-introspection.service';
import type { SessionTraits } from '../../src/auth/session.types';

const TRAITS: SessionTraits = { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] };
const META: PublicConnectionMeta = {
  connectionId: 'c1',
  userId: 'ana@acme',
  tenantId: 'acme',
  transport: 'sse',
  connectedAt: new Date('2026-07-09T12:00:00.000Z'),
};
const SNAPSHOT: RealtimeWiringSnapshot = {
  instanceId: 'inst-1',
  transport: 'sse',
  transportKind: 'sse',
  sse: {
    endpoint: '/api/events',
    heartbeatMs: 10000,
    replayBufferSize: 10,
    maxConnectionsPerUser: 2,
    emitConnectionEvent: true,
  },
  providers: {
    authenticator: 'CompositeAuthenticator',
    hooks: 'CompositeLifecycleHooks',
    pubsub: 'InMemoryPubSub',
    presence: null,
  },
};

/**
 * Build a RealtimeIntrospectionService double whose snapshot returns {@link SNAPSHOT}.
 *
 * @returns The double and its snapshot spy.
 */
function introspectionDouble(): {
  service: RealtimeIntrospectionService;
  snapshot: jest.Mock;
} {
  const snapshot = jest.fn().mockReturnValue(SNAPSHOT);
  return { service: { snapshot } as unknown as RealtimeIntrospectionService, snapshot };
}

describe('ConnectionsController', () => {
  /**
   * Listing.
   *
   * The controller must return the reporting instance name and the service's
   * connection list verbatim.
   */
  it('lists connections tagged with the instance', () => {
    const list = jest.fn().mockReturnValue([META]);
    const controller = new ConnectionsController(
      { list } as unknown as ConnectionsService,
      introspectionDouble().service,
    );

    expect(controller.list()).toEqual({ instance: APP_SERVICE_NAME, connections: [META] });
  });

  /**
   * Kill switch.
   *
   * disconnect must forward the target id and the caller's user id to the
   * ownership-checking service and acknowledge success.
   */
  it('disconnects with the id and caller user id', async () => {
    const disconnectOwned = jest.fn().mockResolvedValue(undefined);
    const controller = new ConnectionsController(
      { disconnectOwned } as unknown as ConnectionsService,
      introspectionDouble().service,
    );

    const ack = await controller.disconnect('c1', TRAITS);

    expect(disconnectOwned).toHaveBeenCalledWith('c1', 'ana@acme');
    expect(ack).toEqual({ disconnected: true });
  });

  /**
   * Wiring introspection.
   *
   * wiring must return the introspection service's snapshot unchanged, so the
   * admin endpoint reports exactly what the library resolved at boot.
   */
  it('reports the resolved realtime wiring snapshot', () => {
    const { service, snapshot } = introspectionDouble();
    const controller = new ConnectionsController(
      { list: jest.fn() } as unknown as ConnectionsService,
      service,
    );

    expect(controller.wiring()).toEqual(SNAPSHOT);
    expect(snapshot).toHaveBeenCalledTimes(1);
  });
});
