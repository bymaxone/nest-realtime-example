/**
 * @fileoverview Builds the library module options from the frozen app config.
 * @layer realtime
 *
 * This is the canonical factory consumers copy: every tunable comes from
 * `APP_CONFIG`, never from `process.env` or a literal. Cross-origin access for the
 * SSE endpoint is applied at the application level (`app.enableCors`) because the
 * installed library exposes no `sse.cors` option (a plain HTTP GET is governed by
 * the app's CORS policy); the WebSocket transport, in contrast, owns its own CORS
 * through Socket.IO, so the `websocket.cors` option is set here. The `websocket`
 * block is present only when the transport involves WebSocket, so an SSE-only boot
 * never carries WebSocket configuration. Leaving `pubsub` unset selects the
 * library's `InMemoryPubSub` default for single-instance runs.
 */

import type {
  BymaxRealtimeModuleOptions,
  CorsConfig,
  IConnectionAuthenticator,
  IConnectionLifecycleHooks,
  IOfflineQueueStorage,
  IPresenceStorage,
  IRealtimePubSub,
  ReauthenticationPolicy,
  SseOptions,
  WebSocketOptions,
} from '@bymax-one/nest-realtime';

import { APP_SERVICE_NAME, APP_VERSION } from '../app.constants';
import type { AppConfig } from '../config/env.loader';

/**
 * Build the fully-typed realtime module options from configuration.
 *
 * @param config - The frozen application configuration.
 * @param authenticator - The connection authenticator resolved through DI.
 * @param hooks - Optional lifecycle hooks (the composite that fans out to the
 *   audit ring, the connection event log and the decorator handlers).
 * @param offlineQueue - Optional durable offline queue; when present, the library
 *   persists events for users with no live connection and drains them on reconnect.
 * @param pubsub - Optional cross-instance pub/sub bus; when present, an emit on one
 *   instance fans out to clients connected to the others. Leaving it unset selects
 *   the library's single-instance `InMemoryPubSub`.
 * @param presence - Optional presence storage answering "who is online?" across
 *   instances; when unset, presence-dependent features stay disabled.
 * @param wsRedisClient - Optional ioredis client for the WebSocket transport's
 *   `@socket.io/redis-adapter`; wired only under the Redis pub/sub driver so a
 *   single-instance WebSocket run never installs the adapter.
 * @returns The options passed to `BymaxRealtimeModule`.
 */
export function buildRealtimeOptions(
  config: AppConfig,
  authenticator: IConnectionAuthenticator,
  hooks?: IConnectionLifecycleHooks,
  offlineQueue?: IOfflineQueueStorage,
  pubsub?: IRealtimePubSub,
  presence?: IPresenceStorage,
  wsRedisClient?: unknown,
): BymaxRealtimeModuleOptions {
  const sse: SseOptions = {
    endpoint: config.realtime.sseEndpoint,
    heartbeatMs: config.realtime.heartbeatMs,
    replayBufferSize: config.realtime.replayBufferSize,
    maxConnectionsPerUser: config.realtime.maxConnectionsPerUser,
    emitConnectionEvent: config.realtime.emitConnectionEvent,
  };
  const reauthenticationPolicy: ReauthenticationPolicy = {
    intervalSeconds: config.reauth.intervalSeconds,
    onFailure: config.reauth.onFailure,
    cacheTtlMs: config.reauth.cacheTtlMs,
  };
  const base: BymaxRealtimeModuleOptions = {
    transport: config.realtime.transport,
    service: { name: APP_SERVICE_NAME, version: APP_VERSION },
    authenticator,
    tenantResolver: (auth) => auth.tenantId,
    sse,
    reauthenticationPolicy,
  };
  const websocket = buildWebsocketOptions(config, wsRedisClient);
  const options = websocket ? { ...base, websocket } : base;
  const withHooks = hooks ? { ...options, hooks } : options;
  const withQueue = offlineQueue ? { ...withHooks, offlineQueue } : withHooks;
  const withPubsub = pubsub ? { ...withQueue, pubsub } : withQueue;
  return presence ? { ...withPubsub, presence } : withPubsub;
}

/**
 * Build the WebSocket-transport options block from configuration.
 *
 * Returns `undefined` for the SSE-only profile so no WebSocket configuration is
 * carried when Socket.IO is never booted. For the `websocket` and `both` profiles
 * every Socket.IO tunable is sourced from the frozen config: the config-driven
 * namespace the custom IoAdapter binds the gateway to, the transport's own CORS
 * policy (distinct from the app-level HTTP CORS), the payload cap, the ping
 * keepalive cadence and its timeout, and the per-user FIFO connection limit.
 *
 * Under the Redis pub/sub driver (the cluster profile) it also wires the WebSocket
 * `redisAdapter.pubClient` from the shared ioredis client, enabling cross-instance
 * WebSocket fan-out through `@socket.io/redis-adapter`; the memory driver leaves it
 * unset so a single-instance run never installs the adapter.
 *
 * @param config - The frozen application configuration.
 * @param wsRedisClient - The ioredis client for the Redis adapter, or `undefined`.
 * @returns The WebSocket options block, or `undefined` for the SSE-only profile.
 */
function buildWebsocketOptions(
  config: AppConfig,
  wsRedisClient?: unknown,
): WebSocketOptions | undefined {
  if (config.realtime.transport === 'sse') return undefined;
  const cors: CorsConfig = { origin: config.webOrigin, credentials: true };
  const base: WebSocketOptions = {
    namespace: config.realtime.wsNamespace,
    cors,
    maxHttpBufferSize: config.realtime.wsMaxBufferBytes,
    pingIntervalMs: config.realtime.wsPingIntervalMs,
    pingTimeoutMs: config.realtime.wsPingTimeoutMs,
    maxConnectionsPerUser: config.realtime.maxConnectionsPerUser,
    emitConnectionEvent: config.realtime.emitConnectionEvent,
  };
  if (config.pubsubDriver !== 'redis' || wsRedisClient === undefined) return base;
  return { ...base, redisAdapter: { pubClient: wsRedisClient } };
}
