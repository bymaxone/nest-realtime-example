/**
 * @fileoverview Unit specs for the typed environment loader.
 * @layer test
 *
 * Covers the four behaviors the api relies on: defaults for a bare environment,
 * explicit overrides, a single aggregated error that names every offending
 * variable without echoing its value, and deep immutability of the result.
 */

import { type AppConfig, loadEnv } from '../../src/config/env.loader';

describe('loadEnv', () => {
  it('applies every documented default for a bare environment', () => {
    // Scenario: `pnpm dev` with no .env still boots on the documented defaults.
    const config = loadEnv({});
    expect(config.port).toBe(3001);
    expect(config.instanceName).toBe('app-a');
    expect(config.realtime.transport).toBe('sse');
    expect(config.realtime.sseEndpoint).toBe('/api/events');
    expect(config.realtime.heartbeatMs).toBe(10000);
    expect(config.realtime.replayBufferSize).toBe(10);
    expect(config.realtime.maxConnectionsPerUser).toBe(2);
    expect(config.realtime.emitConnectionEvent).toBe(true);
    expect(config.realtime.wsNamespace).toBe('/live');
    expect(config.realtime.wsMaxBufferBytes).toBe(16384);
    expect(config.reauth.intervalSeconds).toBe(15);
    expect(config.reauth.onFailure).toBe('disconnect');
    expect(config.reauth.cacheTtlMs).toBe(10000);
    expect(config.redisUrl).toBe('redis://localhost:6379');
    expect(config.pubsubDriver).toBe('memory');
    expect(config.webOrigin).toBe('http://localhost:3000');
  });

  it('coerces and maps explicit overrides', () => {
    // Scenario: cluster and websocket profiles override the defaults; numeric
    // strings are coerced and the boolean toggle reads 'false' as false.
    const config = loadEnv({
      PORT: '3002',
      INSTANCE_NAME: 'app-b',
      REALTIME_TRANSPORT: 'websocket',
      REALTIME_EMIT_CONNECTION_EVENT: 'false',
      PUBSUB_DRIVER: 'redis',
      REAUTH_ON_FAILURE: 'event',
      REAUTH_CACHE_TTL_MS: '0',
    });
    expect(config.port).toBe(3002);
    expect(config.instanceName).toBe('app-b');
    expect(config.realtime.transport).toBe('websocket');
    expect(config.realtime.emitConnectionEvent).toBe(false);
    expect(config.pubsubDriver).toBe('redis');
    expect(config.reauth.onFailure).toBe('event');
    expect(config.reauth.cacheTtlMs).toBe(0);
  });

  it('aggregates every violation into one error that never echoes values', () => {
    // Scenario: several malformed variables fail at once; the boot error names
    // each variable and its fault kind but leaks none of the received values.
    const parse = (): AppConfig =>
      loadEnv({
        PORT: 'not-a-number',
        REALTIME_TRANSPORT: 'carrier-pigeon',
        REDIS_URL: 'ftp://wrong-scheme',
        SESSION_SECRET: 'tiny',
      });
    expect(parse).toThrow(/PORT/);
    let message = '';
    try {
      parse();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain('REALTIME_TRANSPORT');
    expect(message).toContain('REDIS_URL');
    expect(message).toContain('SESSION_SECRET');
    expect(message).not.toContain('not-a-number');
    expect(message).not.toContain('carrier-pigeon');
    expect(message).not.toContain('ftp://wrong-scheme');
    expect(message).not.toContain('tiny');
  });

  it('reads process.env when no source argument is given', () => {
    // Scenario: the production boot calls loadEnv() with no argument, so the
    // default parameter must read the live process environment.
    const original = process.env.PORT;
    process.env.PORT = '3005';
    try {
      const config = loadEnv();
      expect(config.port).toBe(3005);
    } finally {
      if (original === undefined) {
        delete process.env.PORT;
      } else {
        process.env.PORT = original;
      }
    }
  });

  it('rejects a value outside an enum', () => {
    // Scenario: an unknown reauth policy is refused rather than silently defaulted.
    expect(() => loadEnv({ REAUTH_ON_FAILURE: 'ignore' })).toThrow(/REAUTH_ON_FAILURE/);
  });

  it('returns a deeply frozen configuration', () => {
    // Scenario: the config is shared process-wide, so neither the root nor its
    // grouped sub-objects may be mutated after boot.
    const config = loadEnv({});
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.realtime)).toBe(true);
    expect(Object.isFrozen(config.reauth)).toBe(true);
    expect(() => {
      (config as { port: number }).port = 9999;
    }).toThrow(TypeError);
    expect(() => {
      (config.realtime as { heartbeatMs: number }).heartbeatMs = 1;
    }).toThrow(TypeError);
  });
});
