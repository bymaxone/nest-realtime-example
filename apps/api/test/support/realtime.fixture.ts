/**
 * @fileoverview Test doubles for the library's RealtimeService.
 * @layer test-support
 *
 * Provides a spyable RealtimeService and a global module that supplies it, so
 * feature modules that depend on the globally-registered service can be compiled
 * in isolation. The double is the real `RealtimeService` wrapping a spy
 * `ITransport`, so no cast is needed and delegation is exercised for real.
 */

import { Global, Module, type DynamicModule, type Provider } from '@nestjs/common';
import {
  type BymaxRealtimeModuleOptions,
  ConnectionRegistry,
  type IConnectionAuthenticator,
  type IConnectionLifecycleHooks,
  InMemoryPubSub,
  type ITransport,
  REALTIME_AUTHENTICATOR_TOKEN,
  REALTIME_HOOKS_TOKEN,
  REALTIME_INSTANCE_ID_TOKEN,
  REALTIME_OPTIONS_TOKEN,
  REALTIME_PRESENCE_TOKEN,
  REALTIME_PUBSUB_TOKEN,
  REALTIME_TRANSPORT_TOKEN,
  RealtimeService,
} from '@bymax-one/nest-realtime';

/** A RealtimeService double and its per-method transport spies. */
export interface RealtimeMock {
  readonly service: RealtimeService;
  readonly emitToUser: jest.Mock;
  readonly emitToTenant: jest.Mock;
  readonly emitToRoom: jest.Mock;
  readonly broadcast: jest.Mock;
}

/**
 * Build a real RealtimeService over a spy transport.
 *
 * @returns The service and the transport spies its emit methods delegate to.
 */
export function mockRealtimeService(): RealtimeMock {
  const emitToUser = jest.fn().mockResolvedValue(undefined);
  const emitToTenant = jest.fn().mockResolvedValue(undefined);
  const emitToRoom = jest.fn().mockResolvedValue(undefined);
  const broadcast = jest.fn().mockResolvedValue(undefined);
  const transport: ITransport = {
    kind: 'sse',
    emitToUser,
    emitToTenant,
    emitToRoom,
    broadcast,
    joinRoom: jest.fn().mockResolvedValue(undefined),
    leaveRoom: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
  };
  return {
    service: new RealtimeService(transport),
    emitToUser,
    emitToTenant,
    emitToRoom,
    broadcast,
  };
}

/** The exported Symbol DI tokens a consumer can inject for wiring introspection. */
const REALTIME_INTROSPECTION_TOKENS = [
  REALTIME_OPTIONS_TOKEN,
  REALTIME_TRANSPORT_TOKEN,
  REALTIME_INSTANCE_ID_TOKEN,
  REALTIME_AUTHENTICATOR_TOKEN,
  REALTIME_HOOKS_TOKEN,
  REALTIME_PUBSUB_TOKEN,
  REALTIME_PRESENCE_TOKEN,
] as const;

/**
 * Build providers for the library's exported Symbol DI tokens, mirroring what the
 * `@Global` module resolves at boot so a consumer that injects them for wiring
 * introspection can be compiled in isolation.
 *
 * @returns The token providers and the token list to re-export.
 */
function buildRealtimeTokenProviders(): { providers: Provider[]; tokens: symbol[] } {
  const authenticator: IConnectionAuthenticator = { authenticate: async () => null };
  const hooks: IConnectionLifecycleHooks = {};
  const options: BymaxRealtimeModuleOptions = {
    transport: 'sse',
    authenticator,
    sse: {
      endpoint: '/api/events',
      heartbeatMs: 10000,
      replayBufferSize: 10,
      maxConnectionsPerUser: 2,
      emitConnectionEvent: true,
    },
  };
  const values = new Map<symbol, unknown>([
    [REALTIME_OPTIONS_TOKEN, options],
    [REALTIME_TRANSPORT_TOKEN, { kind: 'sse' }],
    [REALTIME_INSTANCE_ID_TOKEN, 'test-instance'],
    [REALTIME_AUTHENTICATOR_TOKEN, authenticator],
    [REALTIME_HOOKS_TOKEN, hooks],
    [REALTIME_PUBSUB_TOKEN, new InMemoryPubSub()],
    [REALTIME_PRESENCE_TOKEN, undefined],
  ]);
  const tokens = [...REALTIME_INTROSPECTION_TOKENS];
  const providers = tokens.map((token) => ({ provide: token, useValue: values.get(token) }));
  return { providers, tokens };
}

/**
 * Build a global module providing the given RealtimeService double, a real, empty
 * ConnectionRegistry and the library's exported Symbol DI tokens, mirroring the
 * providers the library's `@Global` module exports.
 *
 * @param service - The RealtimeService double to expose globally.
 * @param registry - The ConnectionRegistry to expose (defaults to an empty one).
 * @returns A dynamic module exporting the mirrored providers.
 */
export function realtimeStubModule(
  service: RealtimeService,
  registry: ConnectionRegistry = new ConnectionRegistry(),
): DynamicModule {
  const { providers: tokenProviders, tokens } = buildRealtimeTokenProviders();

  @Global()
  @Module({
    providers: [
      { provide: RealtimeService, useValue: service },
      { provide: ConnectionRegistry, useValue: registry },
      ...tokenProviders,
    ],
    exports: [RealtimeService, ConnectionRegistry, ...tokens],
  })
  class RealtimeStubModule {}

  return { module: RealtimeStubModule };
}
