/**
 * @fileoverview Test doubles for the library's RealtimeService.
 * @layer test-support
 *
 * Provides a spyable RealtimeService double and a global module that supplies it,
 * so feature modules that depend on the globally-registered service can be
 * compiled in isolation. The cast builds a partial double, not a laundered error.
 */

import { Global, Module, type DynamicModule } from '@nestjs/common';
import { RealtimeService } from '@bymax-one/nest-realtime';

/** A RealtimeService double and its per-method spies. */
export interface RealtimeMock {
  readonly service: RealtimeService;
  readonly emitToUser: jest.Mock;
  readonly emitToTenant: jest.Mock;
  readonly emitToRoom: jest.Mock;
  readonly broadcast: jest.Mock;
}

/**
 * Build a RealtimeService double whose emit methods are jest spies.
 *
 * @returns The double and its spies.
 */
export function mockRealtimeService(): RealtimeMock {
  const emitToUser = jest.fn().mockResolvedValue(undefined);
  const emitToTenant = jest.fn().mockResolvedValue(undefined);
  const emitToRoom = jest.fn().mockResolvedValue(undefined);
  const broadcast = jest.fn().mockResolvedValue(undefined);
  const service = { emitToUser, emitToTenant, emitToRoom, broadcast } as unknown as RealtimeService;
  return { service, emitToUser, emitToTenant, emitToRoom, broadcast };
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
