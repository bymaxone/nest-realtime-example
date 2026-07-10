/**
 * @fileoverview Builds the library module options from the frozen app config.
 * @layer realtime
 *
 * This is the canonical factory consumers copy: every tunable comes from
 * `APP_CONFIG`, never from `process.env` or a literal. Cross-origin access for the
 * SSE endpoint is applied at the application level (`app.enableCors`) because the
 * installed library exposes no `sse.cors` option (a plain HTTP GET is governed by
 * the app's CORS policy). Leaving `pubsub` unset selects the library's
 * `InMemoryPubSub` default for single-instance runs.
 */

import type {
  BymaxRealtimeModuleOptions,
  IConnectionAuthenticator,
  IConnectionLifecycleHooks,
  IOfflineQueueStorage,
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
 * @returns The options passed to `BymaxRealtimeModule`.
 */
export function buildRealtimeOptions(
  config: AppConfig,
  authenticator: IConnectionAuthenticator,
  hooks?: IConnectionLifecycleHooks,
  offlineQueue?: IOfflineQueueStorage,
): BymaxRealtimeModuleOptions {
  const options: BymaxRealtimeModuleOptions = {
    transport: config.realtime.transport,
    service: { name: APP_SERVICE_NAME, version: APP_VERSION },
    authenticator,
    tenantResolver: (auth) => auth.tenantId,
    sse: {
      endpoint: config.realtime.sseEndpoint,
      heartbeatMs: config.realtime.heartbeatMs,
      replayBufferSize: config.realtime.replayBufferSize,
      maxConnectionsPerUser: config.realtime.maxConnectionsPerUser,
      emitConnectionEvent: config.realtime.emitConnectionEvent,
    },
    reauthenticationPolicy: {
      intervalSeconds: config.reauth.intervalSeconds,
      onFailure: config.reauth.onFailure,
      cacheTtlMs: config.reauth.cacheTtlMs,
    },
  };
  const withHooks = hooks ? { ...options, hooks } : options;
  return offlineQueue ? { ...withHooks, offlineQueue } : withHooks;
}
