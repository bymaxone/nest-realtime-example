/**
 * @fileoverview Decorator-driven lifecycle handlers and their dispatcher.
 * @layer audit
 *
 * `DecoratorHandlers` holds feature-local counters bumped by `@OnConnect` /
 * `@OnDisconnect` methods. `LifecycleDecoratorDispatcher` is the config-hook
 * consumer that discovers those decorated methods and invokes them, so the
 * decorator style coexists with the plain config `hooks`. The composite runs the
 * dispatcher last, guaranteeing the cross-cutting audit runs before these
 * feature-local handlers.
 */

import type { ConnectionEventMeta, IConnectionLifecycleHooks } from '@bymax-one/nest-realtime';
import { Injectable } from '@nestjs/common';

import { collectHandlers, OnConnect, OnDisconnect } from './lifecycle.decorators';

/** The feature-local connect/disconnect counters. */
export interface DecoratorStats {
  readonly connects: number;
  readonly disconnects: number;
}

/** Feature-local lifecycle counters driven by method decorators. */
@Injectable()
export class DecoratorHandlers {
  private connects = 0;
  private disconnects = 0;

  /**
   * Count an established connection.
   *
   * @param _meta - The connection metadata (unused; the counter is aggregate).
   */
  @OnConnect()
  whenConnected(_meta: ConnectionEventMeta): void {
    this.connects += 1;
  }

  /**
   * Count a closed connection.
   *
   * @param _meta - The connection metadata (unused; the counter is aggregate).
   */
  @OnDisconnect()
  whenDisconnected(_meta: ConnectionEventMeta): void {
    this.disconnects += 1;
  }

  /**
   * Snapshot the current counters.
   *
   * @returns The connect and disconnect counts.
   */
  stats(): DecoratorStats {
    return { connects: this.connects, disconnects: this.disconnects };
  }
}

/** Invokes the `@OnConnect` / `@OnDisconnect` handlers as a lifecycle consumer. */
@Injectable()
export class LifecycleDecoratorDispatcher implements IConnectionLifecycleHooks {
  /**
   * Build the dispatcher.
   *
   * @param handlers - The provider whose decorated methods are dispatched.
   */
  constructor(private readonly handlers: DecoratorHandlers) {}

  /**
   * Invoke every `@OnConnect` handler.
   *
   * @param meta - The connection metadata.
   */
  async onConnect(meta: ConnectionEventMeta): Promise<void> {
    for (const handler of collectHandlers(this.handlers, 'connect')) await handler(meta);
  }

  /**
   * Invoke every `@OnDisconnect` handler.
   *
   * @param meta - The connection metadata.
   */
  async onDisconnect(meta: ConnectionEventMeta): Promise<void> {
    for (const handler of collectHandlers(this.handlers, 'disconnect')) await handler(meta);
  }
}
