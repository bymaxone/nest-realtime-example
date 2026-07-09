/**
 * @fileoverview Lifecycle-hook sink feeding a capped audit ring buffer.
 * @layer audit
 *
 * Implements the library's `IConnectionLifecycleHooks`, appending one typed,
 * instance-tagged entry per connect, disconnect (with duration), transport error
 * and re-authentication failure. The buffer is bounded so a long-running instance
 * never grows unboundedly; the feed reads newest-first with an optional kind
 * filter.
 */

import type { ConnectionEventMeta, IConnectionLifecycleHooks } from '@bymax-one/nest-realtime';
import { Inject, Injectable } from '@nestjs/common';

import { APP_CONFIG } from '../config/config.tokens';
import type { AppConfig } from '../config/env.loader';

/** Union of audit entry kinds. */
export type AuditKind = 'connect' | 'disconnect' | 'error' | 'reauth-failed';

/** Set of valid audit kinds for constant-time membership checks. */
const AUDIT_KIND_SET: ReadonlySet<string> = new Set<string>([
  'connect',
  'disconnect',
  'error',
  'reauth-failed',
]);

/** A single audit entry describing one lifecycle transition. */
export interface AuditEntry {
  readonly kind: AuditKind;
  readonly at: string;
  readonly instance: string;
  readonly connectionId: string | undefined;
  readonly userId: string | undefined;
  readonly tenantId: string | undefined;
  readonly transport: 'sse' | 'websocket' | undefined;
  readonly extra: Record<string, unknown> | undefined;
}

/** Narrow a raw query value to an {@link AuditKind}. */
export function isAuditKind(value: string): value is AuditKind {
  return AUDIT_KIND_SET.has(value);
}

/** Records connection lifecycle events into a capped in-memory ring. */
@Injectable()
export class AuditService implements IConnectionLifecycleHooks {
  /** Maximum number of entries retained before the oldest is dropped. */
  private static readonly CAPACITY = 500;

  private readonly instance: string;
  private readonly entries: AuditEntry[] = [];

  /**
   * Build the audit service.
   *
   * @param config - The frozen config providing the instance name tag.
   */
  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.instance = config.instanceName;
  }

  /**
   * Record a successful connection.
   *
   * @param meta - The connection metadata.
   */
  onConnect(meta: ConnectionEventMeta): void {
    this.record({
      kind: 'connect',
      connectionId: meta.connectionId,
      userId: meta.userId,
      tenantId: meta.tenantId,
      transport: meta.transport,
      extra: undefined,
    });
  }

  /**
   * Record a disconnection with its duration.
   *
   * @param meta - The connection metadata plus reason and duration.
   */
  onDisconnect(meta: ConnectionEventMeta & { reason?: string; durationMs: number }): void {
    this.record({
      kind: 'disconnect',
      connectionId: meta.connectionId,
      userId: meta.userId,
      tenantId: meta.tenantId,
      transport: meta.transport,
      extra: { durationMs: meta.durationMs, reason: meta.reason },
    });
  }

  /**
   * Record a transport error (no user context is available).
   *
   * @param meta - The connection id, error and transport.
   */
  onError(meta: { connectionId?: string; error: Error; transport: 'sse' | 'websocket' }): void {
    this.record({
      kind: 'error',
      connectionId: meta.connectionId,
      userId: undefined,
      tenantId: undefined,
      transport: meta.transport,
      extra: { message: meta.error.message },
    });
  }

  /**
   * Record a re-authentication failure.
   *
   * @param meta - The connection metadata.
   */
  onReauthenticationFailed(meta: ConnectionEventMeta): void {
    this.record({
      kind: 'reauth-failed',
      connectionId: meta.connectionId,
      userId: meta.userId,
      tenantId: meta.tenantId,
      transport: meta.transport,
      extra: undefined,
    });
  }

  /**
   * Return the audit entries newest-first, optionally filtered by kind.
   *
   * @param kind - When set, only entries of this kind are returned.
   * @returns The matching entries, newest-first.
   */
  feed(kind?: AuditKind): readonly AuditEntry[] {
    const newestFirst = [...this.entries].reverse();
    return kind === undefined ? newestFirst : newestFirst.filter((entry) => entry.kind === kind);
  }

  /** Append an entry, tagging it with the timestamp and instance, and trim. */
  private record(entry: Omit<AuditEntry, 'at' | 'instance'>): void {
    this.entries.push({ ...entry, at: new Date().toISOString(), instance: this.instance });
    if (this.entries.length > AuditService.CAPACITY) this.entries.shift();
  }
}
