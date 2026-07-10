/**
 * Unit tests for buildRealtimeOptions.
 *
 * Layer: unit.
 * Goal: every option is sourced from config, tenant resolves, hooks are optional.
 * Mocks: a stub authenticator and hooks object.
 */

import type {
  IConnectionAuthenticator,
  IConnectionLifecycleHooks,
  IOfflineQueueStorage,
  IPresenceStorage,
  IRealtimePubSub,
} from '@bymax-one/nest-realtime';

import { APP_SERVICE_NAME, APP_VERSION } from '../../src/app.constants';
import { buildRealtimeOptions } from '../../src/realtime/options.factory';
import { buildTestConfig } from '../support/config.fixture';

const authenticator: IConnectionAuthenticator = { authenticate: () => Promise.resolve(null) };

describe('buildRealtimeOptions', () => {
  /**
   * Config-sourced mapping.
   *
   * Every SSE tunable and the service metadata must come from the frozen config,
   * proving the factory never invents values, and no `sse.cors` is set (the
   * installed library has no such option; app-level CORS governs the endpoint).
   */
  it('maps every option from configuration', () => {
    const config = buildTestConfig({
      realtime: {
        transport: 'sse',
        sseEndpoint: '/api/events',
        heartbeatMs: 12000,
        replayBufferSize: 7,
        maxConnectionsPerUser: 3,
        emitConnectionEvent: true,
      },
    });

    const options = buildRealtimeOptions(config, authenticator);

    expect(options.transport).toBe('sse');
    expect(options.service).toEqual({ name: APP_SERVICE_NAME, version: APP_VERSION });
    expect(options.authenticator).toBe(authenticator);
    expect(options.sse).toEqual({
      endpoint: '/api/events',
      heartbeatMs: 12000,
      replayBufferSize: 7,
      maxConnectionsPerUser: 3,
      emitConnectionEvent: true,
    });
    expect(options.sse).not.toHaveProperty('cors');
  });

  /**
   * SSE profile carries no WebSocket block.
   *
   * An SSE-only boot must not carry any `websocket` configuration, so Socket.IO is
   * never booted and the SSE profile stays free of WebSocket peer dependencies.
   */
  it('omits the websocket block for the SSE profile', () => {
    const options = buildRealtimeOptions(
      buildTestConfig({ realtime: { transport: 'sse' } }),
      authenticator,
    );

    expect(options).not.toHaveProperty('websocket');
  });

  /**
   * WebSocket profile sources every Socket.IO tunable from config.
   *
   * The websocket block must carry the config-driven namespace, the transport's
   * own CORS (origin plus credentials), the payload cap, the ping cadence and
   * timeout, the per-user connection limit and the connection-event toggle, so the
   * custom IoAdapter and gateway are driven entirely by env, never by literals.
   */
  it('builds the websocket block for the WebSocket profile from configuration', () => {
    const config = buildTestConfig({
      realtime: {
        transport: 'websocket',
        wsNamespace: '/live',
        wsMaxBufferBytes: 16384,
        wsPingIntervalMs: 5000,
        wsPingTimeoutMs: 4000,
        maxConnectionsPerUser: 3,
        emitConnectionEvent: true,
      },
      webOrigin: 'http://localhost:3000',
    });

    const options = buildRealtimeOptions(config, authenticator);

    expect(options.transport).toBe('websocket');
    expect(options.websocket).toEqual({
      namespace: '/live',
      cors: { origin: 'http://localhost:3000', credentials: true },
      maxHttpBufferSize: 16384,
      pingIntervalMs: 5000,
      pingTimeoutMs: 4000,
      maxConnectionsPerUser: 3,
      emitConnectionEvent: true,
    });
  });

  /**
   * The `both` composite profile also carries the websocket block.
   *
   * Migration mode fans one emit to both transports, so it must carry both the SSE
   * options and the websocket block; the block is present for any non-SSE profile.
   */
  it('builds the websocket block for the both profile', () => {
    const options = buildRealtimeOptions(
      buildTestConfig({ realtime: { transport: 'both' } }),
      authenticator,
    );

    expect(options.websocket?.namespace).toBe('/live');
  });

  /**
   * Reauthentication policy.
   *
   * The reauth interval, failure mode and positive-cache TTL must all be sourced
   * from the frozen config, so the reauth lab is driven by env, not literals.
   */
  it('wires the reauthentication policy from configuration', () => {
    const config = buildTestConfig({
      reauth: { intervalSeconds: 2, onFailure: 'event', cacheTtlMs: 0 },
    });

    const options = buildRealtimeOptions(config, authenticator);

    expect(options.reauthenticationPolicy).toEqual({
      intervalSeconds: 2,
      onFailure: 'event',
      cacheTtlMs: 0,
    });
  });

  /**
   * Tenant resolution.
   *
   * The resolver must map an auth result to its tenant id, and pass through
   * undefined for a tenantless principal.
   */
  it('resolves the tenant from the auth result', () => {
    const options = buildRealtimeOptions(buildTestConfig(), authenticator);

    expect(options.tenantResolver?.({ userId: 'ana@acme', tenantId: 'acme' })).toBe('acme');
    expect(options.tenantResolver?.({ userId: 'ghost' })).toBeUndefined();
  });

  /**
   * Hooks omitted by default.
   *
   * With no hooks argument the options must omit the property so the library uses
   * its no-op default (exactOptionalPropertyTypes forbids an explicit undefined).
   */
  it('omits hooks when none are provided', () => {
    expect(buildRealtimeOptions(buildTestConfig(), authenticator)).not.toHaveProperty('hooks');
  });

  /**
   * Hooks wired when provided.
   *
   * When hooks are supplied (the audit sink) they must be attached verbatim.
   */
  it('attaches hooks when provided', () => {
    const hooks: IConnectionLifecycleHooks = { onConnect: () => undefined };

    expect(buildRealtimeOptions(buildTestConfig(), authenticator, hooks).hooks).toBe(hooks);
  });

  /**
   * Offline queue omitted by default.
   *
   * With no offline queue the options must omit the property so the library keeps
   * its no-queue default (exactOptionalPropertyTypes forbids an explicit undefined).
   */
  it('omits the offline queue when none is provided', () => {
    expect(buildRealtimeOptions(buildTestConfig(), authenticator)).not.toHaveProperty(
      'offlineQueue',
    );
  });

  /**
   * Offline queue wired when provided.
   *
   * When a durable queue is supplied it must be attached verbatim so the library
   * persists events for disconnected users.
   */
  it('attaches the offline queue when provided', () => {
    const offlineQueue: IOfflineQueueStorage = {
      append: () => Promise.resolve(),
      retrieveSince: () => Promise.resolve([]),
      acknowledge: () => Promise.resolve(),
    };

    const options = buildRealtimeOptions(buildTestConfig(), authenticator, undefined, offlineQueue);

    expect(options.offlineQueue).toBe(offlineQueue);
    expect(options).not.toHaveProperty('hooks');
  });

  /**
   * Pub/sub omitted by default.
   *
   * With no pub/sub bus the options must omit the property so the library keeps its
   * single-instance InMemoryPubSub default.
   */
  it('omits the pub/sub bus when none is provided', () => {
    expect(buildRealtimeOptions(buildTestConfig(), authenticator)).not.toHaveProperty('pubsub');
  });

  /**
   * Pub/sub wired when provided.
   *
   * When a cross-instance bus is supplied it must be attached verbatim so emits
   * fan out across instances.
   */
  it('attaches the pub/sub bus when provided', () => {
    const pubsub: IRealtimePubSub = {
      publish: () => Promise.resolve(),
      subscribe: () => Promise.resolve(() => Promise.resolve()),
    };

    const options = buildRealtimeOptions(
      buildTestConfig(),
      authenticator,
      undefined,
      undefined,
      pubsub,
    );

    expect(options.pubsub).toBe(pubsub);
    expect(options).not.toHaveProperty('presence');
  });

  /**
   * Presence wired when provided.
   *
   * When presence storage is supplied it must be attached verbatim so
   * presence-dependent features can answer "who is online?".
   */
  it('attaches presence storage when provided', () => {
    const presence: IPresenceStorage = {
      setOnline: () => Promise.resolve(),
      setOffline: () => Promise.resolve(),
      isOnline: () => Promise.resolve(false),
      listOnlineByTenant: () => Promise.resolve([]),
      countOnline: () => Promise.resolve(0),
    };

    const options = buildRealtimeOptions(
      buildTestConfig(),
      authenticator,
      undefined,
      undefined,
      undefined,
      presence,
    );

    expect(options.presence).toBe(presence);
  });
});
