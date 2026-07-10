/**
 * Unit tests for RealtimeIntrospectionService.
 *
 * Layer: unit.
 * Goal: the service reads the library's exported Symbol DI tokens and projects them
 *       to a client-safe wiring snapshot: the transport mode and kind, the scalar
 *       SSE tunables (missing fields coalesced to null, absent block reported as
 *       null), and the collaborator class names (absent presence reported as null).
 * Mocks: the seven library tokens provided by value; named empty classes stand in
 *        for the collaborators so their constructor names are deterministic.
 */

import {
  REALTIME_AUTHENTICATOR_TOKEN,
  REALTIME_HOOKS_TOKEN,
  REALTIME_INSTANCE_ID_TOKEN,
  REALTIME_OPTIONS_TOKEN,
  REALTIME_PRESENCE_TOKEN,
  REALTIME_PUBSUB_TOKEN,
  REALTIME_TRANSPORT_TOKEN,
} from '@bymax-one/nest-realtime';
import { Test } from '@nestjs/testing';

import { RealtimeIntrospectionService } from '../../src/connections/realtime-introspection.service';

/** Named stand-in for the authenticator token value. */
class FakeAuthenticator {}
/** Named stand-in for the hooks token value. */
class FakeHooks {}
/** Named stand-in for the pub/sub token value. */
class FakePubSub {}
/** Named stand-in for the presence token value. */
class FakePresence {}

/** Overridable token values for a single service build. */
interface TokenOverrides {
  readonly options?: unknown;
  readonly transport?: unknown;
  readonly presence?: unknown;
}

/**
 * Build a RealtimeIntrospectionService with the seven library tokens provided by
 * value, applying any overrides.
 *
 * @param overrides - Token values to replace the defaults.
 * @returns The compiled service.
 */
async function buildService(overrides: TokenOverrides = {}): Promise<RealtimeIntrospectionService> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      RealtimeIntrospectionService,
      {
        provide: REALTIME_OPTIONS_TOKEN,
        useValue: overrides.options ?? {
          transport: 'sse',
          sse: {
            endpoint: '/api/events',
            heartbeatMs: 10000,
            replayBufferSize: 10,
            maxConnectionsPerUser: 2,
            emitConnectionEvent: true,
          },
        },
      },
      { provide: REALTIME_TRANSPORT_TOKEN, useValue: overrides.transport ?? { kind: 'sse' } },
      { provide: REALTIME_INSTANCE_ID_TOKEN, useValue: 'inst-1' },
      { provide: REALTIME_AUTHENTICATOR_TOKEN, useValue: new FakeAuthenticator() },
      { provide: REALTIME_HOOKS_TOKEN, useValue: new FakeHooks() },
      { provide: REALTIME_PUBSUB_TOKEN, useValue: new FakePubSub() },
      {
        provide: REALTIME_PRESENCE_TOKEN,
        useValue: 'presence' in overrides ? overrides.presence : new FakePresence(),
      },
    ],
  }).compile();

  return moduleRef.get(RealtimeIntrospectionService);
}

describe('RealtimeIntrospectionService', () => {
  /**
   * Full SSE profile.
   *
   * Every token must be projected: the instance id and transport mode, the transport
   * kind, all five scalar SSE tunables, and the four collaborator class names, with
   * a wired presence reported by its name.
   */
  it('projects the resolved options, transport and provider names', async () => {
    const service = await buildService();

    expect(service.snapshot()).toEqual({
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
        authenticator: 'FakeAuthenticator',
        hooks: 'FakeHooks',
        pubsub: 'FakePubSub',
        presence: 'FakePresence',
      },
    });
  });

  /**
   * WebSocket profile with no presence.
   *
   * A profile that carries no SSE block must report `sse: null`, the transport kind
   * must follow the resolved transport, and an absent presence must be `null`.
   */
  it('reports a null sse block and null presence for a websocket profile', async () => {
    const service = await buildService({
      options: { transport: 'websocket' },
      transport: { kind: 'websocket' },
      presence: undefined,
    });

    const snapshot = service.snapshot();

    expect(snapshot.transport).toBe('websocket');
    expect(snapshot.transportKind).toBe('websocket');
    expect(snapshot.sse).toBeNull();
    expect(snapshot.providers.presence).toBeNull();
  });

  /**
   * Partial SSE block.
   *
   * A present-but-empty SSE block must coalesce every missing scalar to null rather
   * than leak `undefined`, so the snapshot is a stable, fully-populated shape.
   */
  it('coalesces missing sse fields to null', async () => {
    const service = await buildService({ options: { transport: 'sse', sse: {} } });

    expect(service.snapshot().sse).toEqual({
      endpoint: null,
      heartbeatMs: null,
      replayBufferSize: null,
      maxConnectionsPerUser: null,
      emitConnectionEvent: null,
    });
  });
});
