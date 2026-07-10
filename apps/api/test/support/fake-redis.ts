/**
 * @fileoverview In-memory ioredis double for the offline-queue unit tests.
 * @layer test-support
 *
 * Simulates only the sorted-set surface the queue touches (`pipeline().zadd /
 * zremrangebyrank / expire / exec`, `zrange`, `zrem`), ordered by score then
 * member exactly as Redis is, so the unit tests exercise the real retrieval,
 * trimming and acknowledge logic rather than a stub. The cast to `Redis` at each
 * use site is a deliberate partial double, not a laundered type error.
 */

import type { Redis } from 'ioredis';

/** One scored member in a fake sorted set. */
interface ZEntry {
  readonly score: number;
  readonly member: string;
}

/** Order two entries by score, breaking ties lexicographically by member. */
function compareEntries(left: ZEntry, right: ZEntry): number {
  if (left.score !== right.score) return left.score - right.score;
  return left.member < right.member ? -1 : left.member > right.member ? 1 : 0;
}

/** Resolve a possibly-negative Redis rank against a set length. */
function resolveRank(index: number, length: number): number {
  return index < 0 ? length + index : index;
}

/** A recorded pipelined command, applied in order on `exec`. */
interface PipelineOp {
  readonly apply: () => void;
}

/** Records pipelined sorted-set commands and applies them atomically on exec. */
class FakePipeline {
  private readonly ops: PipelineOp[] = [];

  /**
   * Build a pipeline bound to a fake Redis.
   *
   * @param redis - The backing fake client.
   */
  constructor(private readonly redis: FakeRedis) {}

  /**
   * Queue a sorted-set add.
   *
   * @param key - The set key.
   * @param score - The member's score.
   * @param member - The member value.
   * @returns This pipeline for chaining.
   */
  zadd(key: string, score: number, member: string): this {
    this.ops.push({ apply: () => this.redis.applyZadd(key, score, member) });
    return this;
  }

  /**
   * Queue a rank-range removal.
   *
   * @param key - The set key.
   * @param start - The inclusive start rank.
   * @param stop - The inclusive stop rank.
   * @returns This pipeline for chaining.
   */
  zremrangebyrank(key: string, start: number, stop: number): this {
    this.ops.push({ apply: () => this.redis.applyRemoveByRank(key, start, stop) });
    return this;
  }

  /**
   * Queue a key expiry.
   *
   * @param key - The set key.
   * @param seconds - The TTL in seconds.
   * @returns This pipeline for chaining.
   */
  expire(key: string, seconds: number): this {
    this.ops.push({ apply: () => this.redis.applyExpire(key, seconds) });
    return this;
  }

  /**
   * Apply every queued command in order, or report a simulated failure or a null
   * result (which ioredis returns in some error modes).
   *
   * @returns One `[error, result]` tuple per command, or `null`.
   */
  exec(): Promise<Array<[Error | null, unknown]> | null> {
    const mode = this.redis.consumeExecMode();
    if (mode === 'null') return Promise.resolve(null);
    if (mode === 'fail') return Promise.resolve([[new Error('pipeline failed'), null]]);
    return Promise.resolve(
      this.ops.map((op): [Error | null, unknown] => {
        op.apply();
        return [null, 'OK'];
      }),
    );
  }
}

/** How the next pipeline exec should behave. */
type ExecMode = 'ok' | 'fail' | 'null';

/** Minimal in-memory stand-in for an ioredis client. */
export class FakeRedis {
  private readonly sets = new Map<string, ZEntry[]>();
  private nextExecMode: ExecMode = 'ok';

  /** Every `EXPIRE` the queue issued, for TTL assertions. */
  readonly expireCalls: Array<{ key: string; seconds: number }> = [];

  /** Arm the next `pipeline().exec()` to report an error. */
  failNextPipeline(): void {
    this.nextExecMode = 'fail';
  }

  /** Arm the next `pipeline().exec()` to resolve `null`, as ioredis can. */
  nullNextPipeline(): void {
    this.nextExecMode = 'null';
  }

  /**
   * Read and clear the one-shot exec mode.
   *
   * @returns The mode the next exec should use.
   */
  consumeExecMode(): ExecMode {
    const mode = this.nextExecMode;
    this.nextExecMode = 'ok';
    return mode;
  }

  /**
   * Add or replace a scored member, keeping the set ordered.
   *
   * @param key - The set key.
   * @param score - The member's score.
   * @param member - The member value.
   */
  applyZadd(key: string, score: number, member: string): void {
    const entries = (this.sets.get(key) ?? []).filter((entry) => entry.member !== member);
    entries.push({ score, member });
    entries.sort(compareEntries);
    this.sets.set(key, entries);
  }

  /**
   * Remove entries whose rank falls within an inclusive range.
   *
   * @param key - The set key.
   * @param start - The inclusive start rank (negative counts from the end).
   * @param stop - The inclusive stop rank (negative counts from the end).
   */
  applyRemoveByRank(key: string, start: number, stop: number): void {
    const entries = this.sets.get(key) ?? [];
    const from = Math.max(resolveRank(start, entries.length), 0);
    const to = resolveRank(stop, entries.length);
    if (entries.length === 0 || from > to) return;
    entries.splice(from, to - from + 1);
    this.sets.set(key, entries);
  }

  /**
   * Record a key expiry.
   *
   * @param key - The set key.
   * @param seconds - The TTL in seconds.
   */
  applyExpire(key: string, seconds: number): void {
    this.expireCalls.push({ key, seconds });
  }

  /**
   * Open a pipeline for chained sorted-set commands.
   *
   * @returns A fresh pipeline bound to this client.
   */
  pipeline(): FakePipeline {
    return new FakePipeline(this);
  }

  /**
   * Return the members within an inclusive rank range, in set order.
   *
   * @param key - The set key.
   * @param start - The inclusive start rank.
   * @param stop - The inclusive stop rank (negative counts from the end).
   * @returns The selected members.
   */
  zrange(key: string, start: number, stop: number): Promise<string[]> {
    const entries = this.sets.get(key) ?? [];
    const from = Math.max(resolveRank(start, entries.length), 0);
    const to = resolveRank(stop, entries.length);
    if (entries.length === 0 || from > to) return Promise.resolve([]);
    return Promise.resolve(entries.slice(from, to + 1).map((entry) => entry.member));
  }

  /**
   * Remove the named members from a set.
   *
   * @param key - The set key.
   * @param members - The member values to remove.
   * @returns The number of members removed.
   */
  zrem(key: string, ...members: string[]): Promise<number> {
    const entries = this.sets.get(key) ?? [];
    const remaining = entries.filter((entry) => !members.includes(entry.member));
    this.sets.set(key, remaining);
    return Promise.resolve(entries.length - remaining.length);
  }
}

/**
 * View a fake client as the ioredis `Redis` type the queue expects.
 *
 * @param fake - The in-memory double.
 * @returns The same object typed as `Redis` for the queue under test.
 */
export function asRedis(fake: FakeRedis): Redis {
  return fake as unknown as Redis;
}
