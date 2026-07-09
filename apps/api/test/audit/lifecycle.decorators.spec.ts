/**
 * Unit tests for the @OnConnect / @OnDisconnect decorators.
 *
 * Layer: unit.
 * Goal: decorated methods are collected per phase and bound to the instance; a
 *       class with no decorated methods yields an empty handler list.
 * Mocks: none; a small decorated fixture class.
 */

import type { ConnectionEventMeta } from '@bymax-one/nest-realtime';

import { collectHandlers, OnConnect, OnDisconnect } from '../../src/audit/lifecycle.decorators';

const META: ConnectionEventMeta = {
  connectionId: 'c1',
  userId: 'ana@acme',
  tenantId: 'acme',
  transport: 'sse',
  ip: '127.0.0.1',
  userAgent: undefined,
  connectedAt: new Date(),
};

/** A fixture provider whose methods are lifecycle-decorated. */
class Decorated {
  public connects = 0;
  public disconnects = 0;

  // A parameterless method is assignable to the handler type (extra args ignored).
  @OnConnect()
  onUp(): void {
    this.connects += 1;
  }

  @OnDisconnect()
  onDown(): void {
    this.disconnects += 1;
  }
}

/** A provider with no decorated methods. */
class Plain {}

describe('lifecycle decorators', () => {
  /**
   * Phase collection + binding.
   *
   * collectHandlers must return only the requested phase's methods, each bound to
   * the instance so they mutate that instance's state.
   */
  it('collects and binds handlers per phase', async () => {
    const instance = new Decorated();

    for (const handler of collectHandlers(instance, 'connect')) await handler(META);
    for (const handler of collectHandlers(instance, 'disconnect')) await handler(META);

    expect(instance.connects).toBe(1);
    expect(instance.disconnects).toBe(1);
  });

  /**
   * Empty registry.
   *
   * A class with no decorated methods must yield no handlers, so the dispatcher is
   * a safe no-op for undecorated providers.
   */
  it('returns no handlers for an undecorated class', () => {
    expect(collectHandlers(new Plain(), 'connect')).toEqual([]);
  });
});
