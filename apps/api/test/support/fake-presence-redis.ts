/**
 * @fileoverview In-memory ioredis double for the presence unit tests.
 * @layer test-support
 *
 * Simulates the set and string surface presence touches (`sadd`, `srem`, `scard`,
 * `smembers`, `sismember`, `set`, `get`, `del`, and a `pipeline()` of those), with
 * real set semantics so the tests exercise the actual multi-tab and tenant-index
 * logic rather than a stub. The cast to `Redis` at each use site is a deliberate
 * partial double, not a laundered type error.
 */

import type { Redis } from 'ioredis';

/** A recorded pipelined command applied in order on `exec`. */
interface PipelineOp {
  readonly apply: () => void;
}

/** Records pipelined set/string commands and applies them atomically on exec. */
class FakePresencePipeline {
  private readonly ops: PipelineOp[] = [];

  /**
   * Build a pipeline bound to a fake Redis.
   *
   * @param redis - The backing fake client.
   */
  constructor(private readonly redis: FakePresenceRedis) {}

  /**
   * Queue a set add.
   *
   * @param key - The set key.
   * @param member - The member to add.
   * @returns This pipeline for chaining.
   */
  sadd(key: string, member: string): this {
    this.ops.push({ apply: () => void this.redis.sadd(key, member) });
    return this;
  }

  /**
   * Queue a set removal.
   *
   * @param key - The set key.
   * @param member - The member to remove.
   * @returns This pipeline for chaining.
   */
  srem(key: string, member: string): this {
    this.ops.push({ apply: () => void this.redis.srem(key, member) });
    return this;
  }

  /**
   * Queue a string set.
   *
   * @param key - The string key.
   * @param value - The value to store.
   * @returns This pipeline for chaining.
   */
  set(key: string, value: string): this {
    this.ops.push({ apply: () => void this.redis.set(key, value) });
    return this;
  }

  /**
   * Queue a key delete.
   *
   * @param key - The key to delete.
   * @returns This pipeline for chaining.
   */
  del(key: string): this {
    this.ops.push({ apply: () => void this.redis.del(key) });
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

/** Minimal in-memory stand-in for an ioredis client with sets and strings. */
export class FakePresenceRedis {
  private readonly sets = new Map<string, Set<string>>();
  private readonly strings = new Map<string, string>();
  private nextExecMode: ExecMode = 'ok';

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
   * Add a member to a set.
   *
   * @param key - The set key.
   * @param member - The member to add.
   * @returns The number of new members added (0 or 1).
   */
  sadd(key: string, member: string): Promise<number> {
    const set = this.sets.get(key) ?? new Set<string>();
    const had = set.has(member);
    set.add(member);
    this.sets.set(key, set);
    return Promise.resolve(had ? 0 : 1);
  }

  /**
   * Remove a member from a set.
   *
   * @param key - The set key.
   * @param member - The member to remove.
   * @returns The number of members removed (0 or 1).
   */
  srem(key: string, member: string): Promise<number> {
    const set = this.sets.get(key);
    const removed = set?.delete(member) ?? false;
    return Promise.resolve(removed ? 1 : 0);
  }

  /**
   * Count the members of a set.
   *
   * @param key - The set key.
   * @returns The set cardinality.
   */
  scard(key: string): Promise<number> {
    return Promise.resolve(this.sets.get(key)?.size ?? 0);
  }

  /**
   * List the members of a set.
   *
   * @param key - The set key.
   * @returns The members in insertion order.
   */
  smembers(key: string): Promise<string[]> {
    return Promise.resolve([...(this.sets.get(key) ?? [])]);
  }

  /**
   * Report whether a member is in a set.
   *
   * @param key - The set key.
   * @param member - The member to check.
   * @returns `1` when present, `0` otherwise.
   */
  sismember(key: string, member: string): Promise<number> {
    return Promise.resolve(this.sets.get(key)?.has(member) ? 1 : 0);
  }

  /**
   * Store a string value.
   *
   * @param key - The string key.
   * @param value - The value to store.
   * @returns The literal `OK`.
   */
  set(key: string, value: string): Promise<'OK'> {
    this.strings.set(key, value);
    return Promise.resolve('OK');
  }

  /**
   * Read a string value.
   *
   * @param key - The string key.
   * @returns The value, or `null` when unset.
   */
  get(key: string): Promise<string | null> {
    return Promise.resolve(this.strings.get(key) ?? null);
  }

  /**
   * Delete a key from either map.
   *
   * @param key - The key to delete.
   * @returns The number of keys removed.
   */
  del(key: string): Promise<number> {
    const removed = this.sets.delete(key) || this.strings.delete(key);
    return Promise.resolve(removed ? 1 : 0);
  }

  /**
   * Open a pipeline for chained set/string commands.
   *
   * @returns A fresh pipeline bound to this client.
   */
  pipeline(): FakePresencePipeline {
    return new FakePresencePipeline(this);
  }
}

/**
 * View a fake presence client as the ioredis `Redis` type the storage expects.
 *
 * @param fake - The in-memory double.
 * @returns The same object typed as `Redis`.
 */
export function asPresenceRedis(fake: FakePresenceRedis): Redis {
  return fake as unknown as Redis;
}
