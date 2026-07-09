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
const MAX_REAUTH_INTERVAL_SECONDS = 86400;
const MIN_SESSION_SECRET_LENGTH = 16;

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
  REALTIME_MAX_CONNECTIONS_PER_USER: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_CONNECTIONS_PER_USER)
    .default(2),
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
  REAUTH_INTERVAL_SECONDS: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_REAUTH_INTERVAL_SECONDS)
    .default(15),
  REAUTH_ON_FAILURE: z.enum(['disconnect', 'event']).default('disconnect'),
  REDIS_URL: z
    .string()
    .regex(REDIS_URL_PATTERN, 'must be a redis:// or rediss:// URL')
    .default('redis://localhost:6379'),
  PUBSUB_DRIVER: z.enum(['memory', 'redis']).default('memory'),
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
