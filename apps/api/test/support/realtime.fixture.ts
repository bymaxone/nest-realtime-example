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
import { RealtimeService, type ITransport } from '@bymax-one/nest-realtime';

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
 * Build a global module providing the given RealtimeService double.
 *
 * @param service - The RealtimeService double to expose globally.
 * @returns A dynamic module exporting the service.
 */
export function realtimeStubModule(service: RealtimeService): DynamicModule {
  @Global()
  @Module({
    providers: [{ provide: RealtimeService, useValue: service }],
    exports: [RealtimeService],
  })
  class RealtimeStubModule {}

  return { module: RealtimeStubModule };
}
