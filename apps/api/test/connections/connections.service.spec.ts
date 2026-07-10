/**
 * Unit tests for ConnectionsService.
 *
 * Layer: unit.
 * Goal: list maps registry records to client-safe metadata; disconnectOwned
 *       enforces ownership before force-closing (anti-IDOR) and 404s on unknown ids.
 * Mocks: a ConnectionRegistry double and a RealtimeService double.
 */

import { ConnectionRegistry, RealtimeService } from '@bymax-one/nest-realtime';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { ConnectionsService } from '../../src/connections/connections.service';
import type { RedisPresenceStorage } from '../../src/realtime/redis-presence-storage';

const CONNECTED_AT = new Date('2026-07-09T12:00:00.000Z');

/** A minimal registry record shape covering the fields the service reads. */
interface RecordLike {
  connectionId: string;
  userId: string;
  tenantId: string | undefined;
  transport: 'sse' | 'websocket';
  connectedAt: Date;
}

/** The service double and the spies the tests assert on. */
interface Harness {
  readonly service: ConnectionsService;
  readonly disconnect: jest.Mock;
  readonly get: jest.Mock;
  readonly owns: jest.Mock;
}

/** Build the service over registry, realtime and (optional) presence doubles. */
function build(records: RecordLike[], presenceOwns?: boolean): Harness {
  const get = jest.fn((id: string) => records.find((r) => r.connectionId === id));
  const registry = {
    allByTransport: jest.fn().mockReturnValue(records),
    get,
  } as unknown as ConnectionRegistry;
  const disconnect = jest.fn().mockResolvedValue(undefined);
  const realtime = { disconnect } as unknown as RealtimeService;
  const owns = jest.fn().mockResolvedValue(presenceOwns ?? false);
  const presence =
    presenceOwns === undefined
      ? undefined
      : ({ isConnectionOwnedByUser: owns } as unknown as RedisPresenceStorage);
  return { service: new ConnectionsService(registry, realtime, presence), disconnect, get, owns };
}

describe('ConnectionsService', () => {
  /**
   * Listing.
   *
   * list must project each SSE record to exactly the client-safe fields, omitting
   * an absent tenantId rather than emitting undefined.
   */
  it('maps active connections to client-safe metadata', () => {
    const { service } = build([
      {
        connectionId: 'c1',
        userId: 'ana@acme',
        tenantId: 'acme',
        transport: 'sse',
        connectedAt: CONNECTED_AT,
      },
      {
        connectionId: 'c2',
        userId: 'ghost',
        tenantId: undefined,
        transport: 'sse',
        connectedAt: CONNECTED_AT,
      },
    ]);

    const list = service.list();

    expect(list[0]).toEqual({
      connectionId: 'c1',
      userId: 'ana@acme',
      tenantId: 'acme',
      transport: 'sse',
      connectedAt: CONNECTED_AT,
    });
    expect(list[1]).not.toHaveProperty('tenantId');
  });

  /**
   * Owned disconnect.
   *
   * A caller disconnecting their own connection must reach the library disconnect
   * with the USER_LOGGED_OUT reason.
   */
  it('force-closes a connection the caller owns', async () => {
    const { service, disconnect } = build([
      {
        connectionId: 'c1',
        userId: 'ana@acme',
        tenantId: 'acme',
        transport: 'sse',
        connectedAt: CONNECTED_AT,
      },
    ]);

    await service.disconnectOwned('c1', 'ana@acme');

    expect(disconnect).toHaveBeenCalledWith('c1', 'USER_LOGGED_OUT');
  });

  /**
   * Anti-IDOR rejection.
   *
   * Disconnecting a connection owned by another user must be forbidden and must
   * never reach the library disconnect, so one user cannot tear down another's stream.
   */
  it('forbids disconnecting another user connection', async () => {
    const { service, disconnect } = build([
      {
        connectionId: 'c1',
        userId: 'ana@acme',
        tenantId: 'acme',
        transport: 'sse',
        connectedAt: CONNECTED_AT,
      },
    ]);

    await expect(service.disconnectOwned('c1', 'bob@acme')).rejects.toThrow(ForbiddenException);
    expect(disconnect).not.toHaveBeenCalled();
  });

  /**
   * Unknown connection, single-instance.
   *
   * With no presence index (single-instance mode), a connection id absent from the
   * local registry must 404 rather than silently succeed.
   */
  it('404s on an unknown connection id in single-instance mode', async () => {
    const { service } = build([]);

    await expect(service.disconnectOwned('missing', 'ana@acme')).rejects.toThrow(NotFoundException);
  });

  /**
   * Cross-instance owned disconnect.
   *
   * A connection not on this instance but owned by the caller (confirmed via the
   * shared presence index) must be force-closed through the library disconnect,
   * which publishes the revocation cluster-wide.
   */
  it('force-closes a caller-owned connection living on another instance', async () => {
    const { service, disconnect, owns } = build([], true);

    await service.disconnectOwned('remote-c', 'ana@acme');

    expect(owns).toHaveBeenCalledWith('ana@acme', 'remote-c');
    expect(disconnect).toHaveBeenCalledWith('remote-c', 'USER_LOGGED_OUT');
  });

  /**
   * Cross-instance anti-IDOR.
   *
   * A connection not on this instance and not owned by the caller (per the presence
   * index) must 404 without ever reaching the library disconnect, so the kill switch
   * stays anti-IDOR cluster-wide.
   */
  it('404s on a cross-instance connection the caller does not own', async () => {
    const { service, disconnect } = build([], false);

    await expect(service.disconnectOwned('remote-c', 'ana@acme')).rejects.toThrow(
      NotFoundException,
    );
    expect(disconnect).not.toHaveBeenCalled();
  });
});
