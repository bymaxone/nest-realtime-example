/**
 * @fileoverview App-side connection lifecycle log powering the eviction timeline.
 * @layer lifecycle
 *
 * The library's `ConnectionRegistry` holds only live connections, so an evicted
 * connection vanishes from it. This log is an `IConnectionLifecycleHooks` consumer
 * that keeps a bounded history keyed by connection id: it records when each
 * connection opened and, on close, when and why it ended. The FIFO-eviction lab
 * reads it as an ordered per-user timeline whose `reason` reveals which closes
 * were `REALTIME_TOO_MANY_CONNECTIONS` evictions.
 */

import type { ConnectionEventMeta, IConnectionLifecycleHooks } from '@bymax-one/nest-realtime';
import { Injectable } from '@nestjs/common';

/** One connection's lifecycle as seen by the app: opened, then maybe closed. */
export interface ConnectionTimelineEntry {
  readonly connectionId: string;
  readonly userId: string;
  readonly connectedAt: string;
  readonly evictedAt: string | null;
  readonly reason: string | null;
}

/** Mutable internal record updated in place on disconnect. */
interface MutableEntry {
  readonly connectionId: string;
  readonly userId: string;
  readonly connectedAt: string;
  evictedAt: string | null;
  reason: string | null;
}

/** Records connection open/close transitions for the eviction timeline. */
@Injectable()
export class ConnectionEventLog implements IConnectionLifecycleHooks {
  /** Maximum number of connection records retained before the oldest is dropped. */
  private static readonly CAPACITY = 500;

  private readonly entries = new Map<string, MutableEntry>();

  /**
   * Record a new connection.
   *
   * @param meta - The connection metadata.
   */
  onConnect(meta: ConnectionEventMeta): void {
    this.entries.set(meta.connectionId, {
      connectionId: meta.connectionId,
      userId: meta.userId,
      connectedAt: meta.connectedAt.toISOString(),
      evictedAt: null,
      reason: null,
    });
    if (this.entries.size > ConnectionEventLog.CAPACITY) {
      // size > CAPACITY guarantees the map is non-empty, so the first key exists.
      const oldest = this.entries.keys().next().value!;
      this.entries.delete(oldest);
    }
  }

  /**
   * Stamp a connection's close time and reason.
   *
   * @param meta - The connection metadata plus reason and duration.
   */
  onDisconnect(meta: ConnectionEventMeta & { reason?: string; durationMs: number }): void {
    const entry = this.entries.get(meta.connectionId);
    if (!entry) return;
    entry.evictedAt = new Date().toISOString();
    entry.reason = meta.reason ?? null;
  }

  /**
   * Return a user's connection timeline, oldest connection first.
   *
   * @param userId - The user whose timeline is requested.
   * @returns The ordered connection entries for that user.
   */
  timeline(userId: string): readonly ConnectionTimelineEntry[] {
    return [...this.entries.values()]
      .filter((entry) => entry.userId === userId)
      .sort((a, b) => a.connectedAt.localeCompare(b.connectedAt))
      .map((entry) => ({ ...entry }));
  }
}
