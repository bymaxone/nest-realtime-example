/**
 * @fileoverview Test doubles for the library's RealtimeService.
 * @layer test-support
 *
 * Provides a spyable RealtimeService and a global module that supplies it, so
 * feature modules that depend on the globally-registered service can be compiled
 * in isolation. The double is the real `RealtimeService` wrapping a spy
 * `ITransport`, so no cast is needed and delegation is exercised for real.
 */

import { Global, Module, type DynamicModule } from '@nestjs/common';
import { ConnectionRegistry, RealtimeService, type ITransport } from '@bymax-one/nest-realtime';

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

/**
 * Build a global module providing the given RealtimeService double and a real,
 * empty ConnectionRegistry, mirroring the two providers the library exports.
 *
 * @param service - The RealtimeService double to expose globally.
 * @param registry - The ConnectionRegistry to expose (defaults to an empty one).
 * @returns A dynamic module exporting both providers.
 */
export function realtimeStubModule(
  service: RealtimeService,
  registry: ConnectionRegistry = new ConnectionRegistry(),
): DynamicModule {
  @Global()
  @Module({
    providers: [
      { provide: RealtimeService, useValue: service },
      { provide: ConnectionRegistry, useValue: registry },
    ],
    exports: [RealtimeService, ConnectionRegistry],
  })
  class RealtimeStubModule {}

  return { module: RealtimeStubModule };
}
