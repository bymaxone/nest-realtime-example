/**
 * Unit tests for buildRealtimeOptions.
 *
 * Layer: unit.
 * Goal: every option is sourced from config, tenant resolves, hooks are optional.
 * Mocks: a stub authenticator and hooks object.
 */

import type { IConnectionAuthenticator, IConnectionLifecycleHooks } from '@bymax-one/nest-realtime';

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
});
