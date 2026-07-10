/**
 * @fileoverview Single reader and validator of the api process environment.
 * @layer config
 *
 * This module is the only place in the api that reads `process.env`. `loadEnv`
 * validates the raw environment against the schema, aggregates every violation into
 * one fail-fast error that names the offending variables without ever echoing their
 * values, maps the flat variables into a grouped typed shape, and returns it deeply
 * frozen so no later code can mutate the configuration. `resolveBootTransport` is
 * the one synchronous reader the module tree needs before DI resolves, to gate the
 * transport-specific providers at module-definition time.
 */

import type { TransportMode } from '@bymax-one/nest-realtime/shared';

import { envSchema, type RawEnv } from './env.schema';

/** Realtime library tunables sourced from the environment. */
interface RealtimeConfig {
  readonly transport: TransportMode;
  readonly sseEndpoint: string;
  readonly heartbeatMs: number;
  readonly replayBufferSize: number;
  readonly maxConnectionsPerUser: number;
  readonly emitConnectionEvent: boolean;
  readonly wsNamespace: string;
  readonly wsMaxBufferBytes: number;
  readonly wsPingIntervalMs: number;
  readonly wsPingTimeoutMs: number;
}

/** Reauthentication policy tunables sourced from the environment. */
interface ReauthConfig {
  readonly intervalSeconds: number;
  readonly onFailure: 'disconnect' | 'event';
  readonly cacheTtlMs: number;
}

/** Redis-backed offline-queue tunables sourced from the environment. */
interface OfflineQueueConfig {
  readonly enabled: boolean;
  readonly ttlSeconds: number;
  readonly maxPerUser: number;
}

/** The immutable, typed configuration the rest of the api consumes. */
export interface AppConfig {
  readonly port: number;
  readonly instanceName: string;
  readonly realtime: RealtimeConfig;
  readonly reauth: ReauthConfig;
  readonly offlineQueue: OfflineQueueConfig;
  readonly redisUrl: string;
  readonly pubsubDriver: 'memory' | 'redis';
  readonly sessionSecret: string;
  readonly webOrigin: string;
}

/** The subset of a Zod issue this module reports: the variable and its fault. */
interface ReportableIssue {
  readonly path: ReadonlyArray<PropertyKey>;
  readonly code: string;
}

/**
 * Build a single fail-fast error message from every validation issue, listing the
 * offending variable name and the kind of fault only. Received values are never
 * included so secrets and malformed input never reach logs.
 */
function formatIssues(issues: ReadonlyArray<ReportableIssue>): string {
  const lines = issues.map((issue) => `  - ${issue.path.join('.')} (${issue.code})`);
  return `Invalid environment configuration:\n${lines.join('\n')}`;
}

/** Group the flat, validated variables into the typed configuration shape. */
function mapEnv(env: RawEnv): AppConfig {
  return {
    port: env.PORT,
    instanceName: env.INSTANCE_NAME,
    realtime: {
      transport: env.REALTIME_TRANSPORT,
      sseEndpoint: env.REALTIME_SSE_ENDPOINT,
      heartbeatMs: env.REALTIME_HEARTBEAT_MS,
      replayBufferSize: env.REALTIME_REPLAY_BUFFER_SIZE,
      maxConnectionsPerUser: env.REALTIME_MAX_CONNECTIONS_PER_USER,
      emitConnectionEvent: env.REALTIME_EMIT_CONNECTION_EVENT,
      wsNamespace: env.REALTIME_WS_NAMESPACE,
      wsMaxBufferBytes: env.REALTIME_WS_MAX_BUFFER_BYTES,
      wsPingIntervalMs: env.REALTIME_WS_PING_INTERVAL_MS,
      wsPingTimeoutMs: env.REALTIME_WS_PING_TIMEOUT_MS,
    },
    reauth: {
      intervalSeconds: env.REAUTH_INTERVAL_SECONDS,
      onFailure: env.REAUTH_ON_FAILURE,
      cacheTtlMs: env.REAUTH_CACHE_TTL_MS,
    },
    offlineQueue: {
      enabled: env.OFFLINE_QUEUE_ENABLED,
      ttlSeconds: env.OFFLINE_QUEUE_TTL_SECONDS,
      maxPerUser: env.OFFLINE_QUEUE_MAX_PER_USER,
    },
    redisUrl: env.REDIS_URL,
    pubsubDriver: env.PUBSUB_DRIVER,
    sessionSecret: env.SESSION_SECRET,
    webOrigin: env.WEB_ORIGIN,
  };
}

/** Freeze the grouped objects and the root so the configuration is immutable. */
function freezeConfig(config: AppConfig): AppConfig {
  Object.freeze(config.realtime);
  Object.freeze(config.reauth);
  Object.freeze(config.offlineQueue);
  return Object.freeze(config);
}

/**
 * Validate the given environment (defaulting to `process.env`) and return the
 * frozen, typed configuration. Throw a single aggregated error listing every
 * invalid variable when validation fails.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(formatIssues(result.error.issues));
  }
  return freezeConfig(mapEnv(result.data));
}

/**
 * Resolve the boot transport synchronously from the environment.
 *
 * The module tree needs the transport before DI resolves, to gate which transport
 * providers register at module-definition time, which {@link loadEnv} cannot supply
 * because it runs as a provider. This reads only `REALTIME_TRANSPORT`, applying the
 * same schema default; an invalid value falls back to the default here and is
 * reported by {@link loadEnv} through its aggregated, value-free error at DI time,
 * so the hint never fails the boot with a value-echoing message of its own.
 *
 * @returns The configured transport mode, or the default when it is unset or invalid.
 */
export function resolveBootTransport(): TransportMode {
  const result = envSchema.shape.REALTIME_TRANSPORT.safeParse(process.env.REALTIME_TRANSPORT);
  return result.success ? result.data : 'sse';
}
