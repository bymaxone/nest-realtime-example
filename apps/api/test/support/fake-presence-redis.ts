/**
 * @fileoverview In-memory ioredis double for the presence unit tests.
 * @layer test-support
 *
 * Simulates the set and string surface presence touches (`sadd`, `srem`, `scard`,
 * `smembers`, `sismember`, `set`, `get`, `del`, and a `multi()` of those), with
 * real set semantics so the tests exercise the actual multi-tab and tenant-index
 * logic rather than a stub. Queued commands return their real results, because the
 * storage derives the online/offline transition from a `scard` executed inside the
 * transaction; a double that answered `OK` to everything would hide that contract.
 * The cast to `Redis` at each use site is a deliberate partial double, not a
 * laundered type error.
 */

import type { Redis } from 'ioredis';

/** A queued command, applied in order on `exec`. */
interface TransactionOp {
  readonly apply: () => Promise<unknown>;
}

/** Records queued set/string commands and applies them atomically on exec. */
class FakePresenceTransaction {
  private readonly ops: TransactionOp[] = [];

  /**
   * Build a transaction bound to a fake Redis.
   *
   * @param redis - The backing fake client.
   */
  constructor(private readonly redis: FakePresenceRedis) {}

  /**
   * Queue a set add.
   *
   * @param key - The set key.
   * @param member - The member to add.
   * @returns This transaction for chaining.
   */
  sadd(key: string, member: string): this {
    this.ops.push({ apply: () => this.redis.sadd(key, member) });
    return this;
  }

  /**
   * Queue a set removal.
   *
   * @param key - The set key.
   * @param member - The member to remove.
   * @returns This transaction for chaining.
   */
  srem(key: string, member: string): this {
    this.ops.push({ apply: () => this.redis.srem(key, member) });
    return this;
  }

  /**
   * Queue a set cardinality read.
   *
   * @param key - The set key.
   * @returns This transaction for chaining.
   */
  scard(key: string): this {
    this.ops.push({ apply: () => this.redis.scard(key) });
    return this;
  }

  /**
   * Queue a string set.
   *
   * @param key - The string key.
   * @param value - The value to store.
   * @returns This transaction for chaining.
   */
  set(key: string, value: string): this {
    this.ops.push({ apply: () => this.redis.set(key, value) });
    return this;
  }

  /**
   * Queue a key delete.
   *
   * @param key - The key to delete.
   * @returns This transaction for chaining.
   */
  del(key: string): this {
    this.ops.push({ apply: () => this.redis.del(key) });
    return this;
  }

  /**
   * Apply every queued command in order, or report a simulated failure or a null
   * result (which ioredis returns in some error modes).
   *
   * @returns One `[error, result]` tuple per command, or `null`.
   */
  async exec(): Promise<Array<[Error | null, unknown]> | null> {
    const mode = this.redis.consumeExecMode();
    if (mode === 'null') return null;
    if (mode === 'fail') return [[new Error('transaction failed'), null]];
    const results: Array<[Error | null, unknown]> = [];
    for (const op of this.ops) {
      results.push([null, await op.apply()]);
    }
    return results;
  }
}

/** How the next transaction exec should behave. */
type ExecMode = 'ok' | 'fail' | 'null';

/** Minimal in-memory stand-in for an ioredis client with sets and strings. */
export class FakePresenceRedis {
  private readonly sets = new Map<string, Set<string>>();
  private readonly strings = new Map<string, string>();
  private armedExecMode: ExecMode = 'ok';
  private execsBeforeArmed = 0;

  /**
   * Arm a later `multi().exec()` to report an error.
   *
   * @param afterSuccesses - How many transactions succeed first. A disconnect runs
   *   two (the removal, then the index cleanup), so this selects which one fails.
   */
  failNextTransaction(afterSuccesses = 0): void {
    this.armedExecMode = 'fail';
    this.execsBeforeArmed = afterSuccesses;
  }

  /**
   * Arm a later `multi().exec()` to resolve `null`, as ioredis can.
   *
   * @param afterSuccesses - How many transactions succeed first.
   */
  nullNextTransaction(afterSuccesses = 0): void {
    this.armedExecMode = 'null';
    this.execsBeforeArmed = afterSuccesses;
  }

  /**
   * Read and clear the one-shot exec mode, counting down any armed delay first.
   *
   * @returns The mode the next exec should use.
   */
  consumeExecMode(): ExecMode {
    if (this.armedExecMode === 'ok') return 'ok';
    if (this.execsBeforeArmed > 0) {
      this.execsBeforeArmed -= 1;
      return 'ok';
    }
    const mode = this.armedExecMode;
    this.armedExecMode = 'ok';
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
   * Open a transaction for chained set/string commands.
   *
   * @returns A fresh transaction bound to this client.
   */
  multi(): FakePresenceTransaction {
    return new FakePresenceTransaction(this);
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
