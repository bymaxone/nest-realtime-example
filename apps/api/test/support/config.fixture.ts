/**
 * @fileoverview Test fixture that builds a complete, overridable AppConfig.
 * @layer test-support
 *
 * The frozen {@link AppConfig} has many required fields; this helper supplies a
 * valid default for each so specs override only what a scenario cares about.
 */

import type { AppConfig } from '../../src/config/env.loader';

/** Deeply-overridable view of {@link AppConfig} for building test fixtures. */
export interface ConfigOverrides {
  readonly port?: number;
  readonly instanceName?: string;
  readonly realtime?: Partial<AppConfig['realtime']>;
  readonly reauth?: Partial<AppConfig['reauth']>;
  readonly redisUrl?: string;
  readonly pubsubDriver?: AppConfig['pubsubDriver'];
  readonly sessionSecret?: string;
  readonly webOrigin?: string;
}

/**
 * Build a frozen {@link AppConfig} with sane demo defaults.
 *
 * @param overrides - Partial values to merge over the defaults.
 * @returns A frozen configuration usable as an `APP_CONFIG` test double.
 */
export function buildTestConfig(overrides: ConfigOverrides = {}): AppConfig {
  const realtime: AppConfig['realtime'] = {
    transport: 'sse',
    sseEndpoint: '/api/events',
    heartbeatMs: 10000,
    replayBufferSize: 10,
    maxConnectionsPerUser: 2,
    emitConnectionEvent: true,
    wsNamespace: '/live',
    wsMaxBufferBytes: 16384,
    ...overrides.realtime,
  };
  const reauth: AppConfig['reauth'] = {
    intervalSeconds: 15,
    onFailure: 'disconnect',
    ...overrides.reauth,
  };
  return Object.freeze({
    port: overrides.port ?? 3001,
    instanceName: overrides.instanceName ?? 'app-a',
    realtime: Object.freeze(realtime),
    reauth: Object.freeze(reauth),
    redisUrl: overrides.redisUrl ?? 'redis://localhost:6379',
    pubsubDriver: overrides.pubsubDriver ?? 'memory',
    sessionSecret: overrides.sessionSecret ?? 'test-session-secret-0123456789',
    webOrigin: overrides.webOrigin ?? 'http://localhost:3000',
  });
}
