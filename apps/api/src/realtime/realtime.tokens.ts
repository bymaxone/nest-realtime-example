/**
 * @fileoverview Dependency-injection tokens for the Redis-backed realtime infra.
 * @layer realtime
 *
 * Symbol tokens keep the cluster infrastructure singletons unambiguous and force
 * every consumer to inject them explicitly. `REALTIME_PUBSUB` is the concrete
 * `RedisRealtimePubSub` (exposing its origin id and availability flag) shared by
 * the health probe and the stats counters; `REALTIME_PUBSUB_BUS` is the
 * `IRealtimePubSub` actually handed to the library (the counters decorate it), so
 * the realtime wiring depends on one stable token regardless of what wraps the
 * bus. Both pub/sub tokens resolve to `undefined` when `PUBSUB_DRIVER` is
 * `memory`, leaving the library on its single-instance defaults.
 * `REALTIME_PRESENCE` is the concrete presence storage the tracker populates and
 * the presence endpoints read; it is backed by the shared Redis client on every
 * profile, since a roster is useful on a single instance too.
 */

/** Injection token for the concrete {@link RedisRealtimePubSub} (or `undefined`). */
export const REALTIME_PUBSUB = Symbol('REALTIME_PUBSUB');

/** Injection token for the `IRealtimePubSub` passed to the library (or `undefined`). */
export const REALTIME_PUBSUB_BUS = Symbol('REALTIME_PUBSUB_BUS');

/** Injection token for the concrete presence storage. */
export const REALTIME_PRESENCE = Symbol('REALTIME_PRESENCE');
