/**
 * @fileoverview Per-instance pub/sub delivery counters that prove loop-free fan-out.
 * @layer connections
 *
 * Holds the three counts a single instance needs to make cross-instance fan-out
 * legible: `published` (messages this instance put on the bus), `receivedRemote`
 * (messages this instance accepted from a peer, already past the origin
 * self-filter) and `deliveredLocal` (fan-out operations this instance applied to
 * its own connection set). The counting pub/sub decorator drives the first two;
 * `deliveredLocal` is their sum, because every locally-originated emit is
 * delivered here before it is published and every accepted remote message is
 * delivered here when it arrives. One emit therefore yields exactly one publish on
 * the origin and exactly one remote delivery on each peer, and the numbers never
 * drift on their own, which is the observable proof that a remote delivery is
 * never re-published (no A to B to A storm).
 */

import { Inject, Injectable } from '@nestjs/common';

import { APP_CONFIG } from '../config/config.tokens';
import type { AppConfig } from '../config/env.loader';

/** Immutable snapshot of one instance's fan-out counters. */
export interface ClusterStats {
  /** The reporting instance name. */
  readonly instance: string;
  /** Messages this instance published to the bus. */
  readonly published: number;
  /** Remote messages this instance accepted from a peer (post self-filter). */
  readonly receivedRemote: number;
  /** Fan-out operations this instance applied to its local connections. */
  readonly deliveredLocal: number;
}

/** Accumulates the per-instance pub/sub delivery counters. */
@Injectable()
export class ClusterStatsService {
  private readonly instance: string;
  private published = 0;
  private receivedRemote = 0;

  /**
   * Build the stats service.
   *
   * @param config - The frozen config providing the instance name tag.
   */
  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.instance = config.instanceName;
  }

  /** Record that this instance published one message to the bus. */
  recordPublish(): void {
    this.published += 1;
  }

  /** Record that this instance accepted one remote message from a peer. */
  recordRemoteDelivery(): void {
    this.receivedRemote += 1;
  }

  /**
   * Snapshot the current counters.
   *
   * @returns The instance name and its three counts, with `deliveredLocal`
   *   derived as `published + receivedRemote`.
   */
  snapshot(): ClusterStats {
    return {
      instance: this.instance,
      published: this.published,
      receivedRemote: this.receivedRemote,
      deliveredLocal: this.published + this.receivedRemote,
    };
  }
}
