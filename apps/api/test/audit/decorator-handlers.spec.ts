/**
 * Unit tests for DecoratorHandlers and LifecycleDecoratorDispatcher.
 *
 * Layer: unit.
 * Goal: the decorated handlers bump per-phase counters, and the dispatcher drives
 *       them from lifecycle calls.
 * Mocks: none; the real provider and dispatcher.
 */

import type { ConnectionEventMeta } from '@bymax-one/nest-realtime';

import {
  DecoratorHandlers,
  LifecycleDecoratorDispatcher,
} from '../../src/audit/decorator-handlers';

const META: ConnectionEventMeta = {
  connectionId: 'c1',
  userId: 'ana@acme',
  tenantId: 'acme',
  transport: 'sse',
  ip: '127.0.0.1',
  userAgent: undefined,
  connectedAt: new Date(),
};

describe('DecoratorHandlers', () => {
  /**
   * Direct counting.
   *
   * The decorated methods must bump their own counters, which the stats snapshot
   * reports.
   */
  it('bumps connect and disconnect counters', () => {
    const handlers = new DecoratorHandlers();

    handlers.whenConnected(META);
    handlers.whenConnected(META);
    handlers.whenDisconnected(META);

    expect(handlers.stats()).toEqual({ connects: 2, disconnects: 1 });
  });
});

describe('LifecycleDecoratorDispatcher', () => {
  /**
   * Dispatch drives the decorated methods.
   *
   * onConnect / onDisconnect on the dispatcher must invoke the decorated handlers,
   * proving the decorators drive real dispatch rather than being cosmetic markers.
   */
  it('invokes the decorated handlers via lifecycle calls', async () => {
    const handlers = new DecoratorHandlers();
    const dispatcher = new LifecycleDecoratorDispatcher(handlers);

    await dispatcher.onConnect(META);
    await dispatcher.onDisconnect(META);

    expect(handlers.stats()).toEqual({ connects: 1, disconnects: 1 });
  });
});
