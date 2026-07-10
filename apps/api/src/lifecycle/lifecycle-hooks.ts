/**
 * @fileoverview Composes every app lifecycle-hook consumer into one hooks object.
 * @layer lifecycle
 *
 * The library accepts a single `IConnectionLifecycleHooks`, but the example needs
 * several sinks (the audit ring and the connection event log today; feature-local
 * decorator counters later). This composite fans each lifecycle call out to its
 * consumers in a fixed order. The order is a contract: the cross-cutting config
 * hooks run before any feature-local handler, so their effects are always
 * observable first.
 */

import type { ConnectionEventMeta, IConnectionLifecycleHooks } from '@bymax-one/nest-realtime';
import { Injectable } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { LifecycleDecoratorDispatcher } from '../audit/decorator-handlers';
import { PresenceTracker } from '../presence/presence.tracker';

import { ConnectionEventLog } from './connection-event-log';
import { RoomMembershipTracker } from './room-membership.tracker';

/** Metadata a disconnect hook receives. */
type DisconnectMeta = ConnectionEventMeta & { reason?: string; durationMs: number };

/** Metadata a transport-error hook receives. */
type ErrorMeta = { connectionId?: string; error: Error; transport: 'sse' | 'websocket' };

/** Fans out each lifecycle transition to the ordered consumer list. */
@Injectable()
export class CompositeLifecycleHooks implements IConnectionLifecycleHooks {
  private readonly consumers: readonly IConnectionLifecycleHooks[];

  /**
   * Build the composite hooks.
   *
   * The order is the contract: the cross-cutting config hooks (audit, the
   * connection timeline, room-membership cleanup, presence population) run before
   * the decorator dispatcher, so the feature-local `@OnConnect` / `@OnDisconnect`
   * handlers always fire last.
   *
   * @param audit - The cross-cutting audit ring (a config hook, runs first).
   * @param connectionEventLog - The connection timeline log (a config hook).
   * @param roomMembership - The room-membership tracker (cleared on disconnect).
   * @param presence - The presence tracker (marks connections online/offline).
   * @param decoratorDispatcher - Invokes the feature-local decorator handlers last.
   */
  constructor(
    audit: AuditService,
    connectionEventLog: ConnectionEventLog,
    roomMembership: RoomMembershipTracker,
    presence: PresenceTracker,
    decoratorDispatcher: LifecycleDecoratorDispatcher,
  ) {
    this.consumers = [audit, connectionEventLog, roomMembership, presence, decoratorDispatcher];
  }

  /**
   * Fan a successful connection out to every consumer in order.
   *
   * @param meta - The connection metadata.
   */
  async onConnect(meta: ConnectionEventMeta): Promise<void> {
    for (const consumer of this.consumers) await consumer.onConnect?.(meta);
  }

  /**
   * Fan a disconnection out to every consumer in order.
   *
   * @param meta - The connection metadata plus reason and duration.
   */
  async onDisconnect(meta: DisconnectMeta): Promise<void> {
    for (const consumer of this.consumers) await consumer.onDisconnect?.(meta);
  }

  /**
   * Fan a transport error out to every consumer in order.
   *
   * @param meta - The connection id, error and transport.
   */
  async onError(meta: ErrorMeta): Promise<void> {
    for (const consumer of this.consumers) await consumer.onError?.(meta);
  }

  /**
   * Fan a re-authentication failure out to every consumer in order.
   *
   * @param meta - The connection metadata.
   */
  async onReauthenticationFailed(meta: ConnectionEventMeta): Promise<void> {
    for (const consumer of this.consumers) await consumer.onReauthenticationFailed?.(meta);
  }
}
