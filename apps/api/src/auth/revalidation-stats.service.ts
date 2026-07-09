/**
 * @fileoverview Counts re-authentication revalidations per user.
 * @layer auth
 *
 * The library's reauthentication service holds a positive-result cache: within
 * `cacheTtlMs` of a successful check it skips calling the authenticator again. By
 * counting only the checks that actually reach the composite authenticator, this
 * lab surface makes that cache visible: over a burst of reauth cycles the count
 * stays far below the number of cycles, proving the cache reduced the work.
 */

import { Injectable } from '@nestjs/common';

/** One user's observed revalidation count. */
export interface RevalidationCount {
  readonly userId: string;
  readonly revalidations: number;
}

/** Records how many times each user's credentials were actually revalidated. */
@Injectable()
export class RevalidationStatsService {
  private readonly counts = new Map<string, number>();

  /**
   * Record one revalidation check for a user.
   *
   * @param userId - The user whose credentials were revalidated.
   */
  record(userId: string): void {
    this.counts.set(userId, (this.counts.get(userId) ?? 0) + 1);
  }

  /**
   * Return the revalidation count observed for a single user.
   *
   * @param userId - The user to look up.
   * @returns The number of recorded revalidations (zero when never checked).
   */
  countFor(userId: string): number {
    return this.counts.get(userId) ?? 0;
  }

  /**
   * Snapshot every user's revalidation count.
   *
   * @returns One entry per user that has been revalidated at least once.
   */
  snapshot(): readonly RevalidationCount[] {
    return [...this.counts].map(([userId, revalidations]) => ({ userId, revalidations }));
  }
}
