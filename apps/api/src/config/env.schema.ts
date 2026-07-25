/**
 * @fileoverview Zod schema for the api process environment.
 * @layer config
 *
 * Mirrors the environment registry one variable at a time: every entry carries a
 * default so a bare `pnpm dev` boots, numeric values are coerced from their
 * string form and bounded to a sane range, and the transport, pub/sub and reauth
 * options are constrained to their documented literal sets. Unknown variables are
 * stripped rather than rejected because the real process environment carries many
 * unrelated keys.
 */

import { z } from 'zod';

/** Smallest and largest values accepted for the bounded numeric variables. */
const MIN_PORT = 1;
const MAX_PORT = 65535;
const MIN_HEARTBEAT_MS = 1000;
const MAX_HEARTBEAT_MS = 600000;
const MAX_REPLAY_BUFFER_SIZE = 10000;
const MAX_CONNECTIONS_PER_USER = 1000;
const MIN_WS_BUFFER_BYTES = 1024;
const MAX_WS_BUFFER_BYTES = 10485760;
const MIN_WS_PING_MS = 1000;
const MAX_WS_PING_MS = 300000;
const MAX_REAUTH_INTERVAL_SECONDS = 86400;
const MAX_REAUTH_CACHE_TTL_MS = 3600000;
const MIN_SESSION_SECRET_LENGTH = 16;
const MAX_OFFLINE_QUEUE_TTL_SECONDS = 604800;
const MAX_OFFLINE_QUEUE_MAX_PER_USER = 100000;

/** A URL that must use the `redis:` or `rediss:` scheme. */
const REDIS_URL_PATTERN = /^rediss?:\/\/.+/u;

/** An origin that must use the `http:` or `https:` scheme. */
const HTTP_ORIGIN_PATTERN = /^https?:\/\/.+/u;

/**
 * Validate and default the raw api environment. Parse it through
 * {@link https://zod.dev | Zod}'s `safeParse` so callers can aggregate every
 * violation at once rather than throwing on the first.
 */
export const envSchema = z.object({
  PORT: z.coerce.number().int().min(MIN_PORT).max(MAX_PORT).default(3001),
  INSTANCE_NAME: z.string().min(1).default('app-a'),
  REALTIME_TRANSPORT: z.enum(['sse', 'websocket', 'both']).default('sse'),
  REALTIME_SSE_ENDPOINT: z.string().min(1).startsWith('/').default('/api/events'),
  REALTIME_HEARTBEAT_MS: z.coerce
    .number()
    .int()
    .min(MIN_HEARTBEAT_MS)
    .max(MAX_HEARTBEAT_MS)
    .default(10000),
  REALTIME_REPLAY_BUFFER_SIZE: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_REPLAY_BUFFER_SIZE)
    .default(10),
  // Per-user connection budget. The dashboard shell already holds two streams per
  // tab (the shared provider feed plus the topbar status badge) and a lab page adds
  // up to two more (its own stream and a WebSocket), so the default leaves one tab
  // fully functional while a second tab still crosses the cap and makes FIFO
  // eviction observable.
  REALTIME_MAX_CONNECTIONS_PER_USER: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_CONNECTIONS_PER_USER)
    .default(5),
  REALTIME_EMIT_CONNECTION_EVENT: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  REALTIME_WS_NAMESPACE: z.string().min(1).startsWith('/').default('/live'),
  REALTIME_WS_MAX_BUFFER_BYTES: z.coerce
    .number()
    .int()
    .min(MIN_WS_BUFFER_BYTES)
    .max(MAX_WS_BUFFER_BYTES)
    .default(16384),
  REALTIME_WS_PING_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(MIN_WS_PING_MS)
    .max(MAX_WS_PING_MS)
    .default(25000),
  REALTIME_WS_PING_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(MIN_WS_PING_MS)
    .max(MAX_WS_PING_MS)
    .default(20000),
  REAUTH_INTERVAL_SECONDS: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_REAUTH_INTERVAL_SECONDS)
    .default(15),
  REAUTH_ON_FAILURE: z.enum(['disconnect', 'event']).default('disconnect'),
  // Kept at or below `REAUTH_INTERVAL_SECONDS * 1000` so revocation is caught on
  // the next cycle; 0 disables the positive cache and re-checks every cycle. The
  // library warns when this exceeds the interval (the cache would weaken reauth).
  REAUTH_CACHE_TTL_MS: z.coerce.number().int().min(0).max(MAX_REAUTH_CACHE_TTL_MS).default(10000),
  REDIS_URL: z
    .string()
    .regex(REDIS_URL_PATTERN, 'must be a redis:// or rediss:// URL')
    .default('redis://localhost:6379'),
  PUBSUB_DRIVER: z.enum(['memory', 'redis']).default('memory'),
  // Gates the Redis-backed offline queue. Off by default so an SSE-only boot
  // without Redis stays fully functional; the replay and offline labs enable it.
  OFFLINE_QUEUE_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  // Seconds a user's offline queue survives inactivity before Redis expires it.
  OFFLINE_QUEUE_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_OFFLINE_QUEUE_TTL_SECONDS)
    .default(3600),
  // Newest-N cap per user; older queued events are trimmed on append.
  OFFLINE_QUEUE_MAX_PER_USER: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_OFFLINE_QUEUE_MAX_PER_USER)
    .default(500),
  SESSION_SECRET: z
    .string()
    .min(MIN_SESSION_SECRET_LENGTH, 'must be at least 16 characters')
    .default('insecure-dev-session-secret-change-me'),
  WEB_ORIGIN: z
    .string()
    .regex(HTTP_ORIGIN_PATTERN, 'must be an http:// or https:// origin')
    .default('http://localhost:3000'),
});

/** The validated, defaulted environment keyed by its raw variable names. */
export type RawEnv = z.infer<typeof envSchema>;
