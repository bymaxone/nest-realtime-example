/**
 * @fileoverview Unit specs for the typed environment loader.
 * @layer test
 *
 * Covers the four behaviors the api relies on: defaults for a bare environment,
 * explicit overrides, a single aggregated error that names every offending
 * variable without echoing its value, and deep immutability of the result.
 */

import { type AppConfig, loadEnv, resolveBootTransport } from '../../src/config/env.loader';

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
    expect(config.realtime.maxConnectionsPerUser).toBe(5);
    expect(config.realtime.emitConnectionEvent).toBe(true);
    expect(config.realtime.wsNamespace).toBe('/live');
    expect(config.realtime.wsMaxBufferBytes).toBe(16384);
    expect(config.realtime.wsPingIntervalMs).toBe(25000);
    expect(config.realtime.wsPingTimeoutMs).toBe(20000);
    expect(config.reauth.intervalSeconds).toBe(15);
    expect(config.reauth.onFailure).toBe('disconnect');
    expect(config.reauth.cacheTtlMs).toBe(10000);
    expect(config.offlineQueue.enabled).toBe(false);
    expect(config.offlineQueue.ttlSeconds).toBe(3600);
    expect(config.offlineQueue.maxPerUser).toBe(500);
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
      REALTIME_WS_PING_INTERVAL_MS: '5000',
      REALTIME_WS_PING_TIMEOUT_MS: '4000',
      PUBSUB_DRIVER: 'redis',
      REAUTH_ON_FAILURE: 'event',
      REAUTH_CACHE_TTL_MS: '0',
      OFFLINE_QUEUE_ENABLED: 'true',
      OFFLINE_QUEUE_TTL_SECONDS: '120',
      OFFLINE_QUEUE_MAX_PER_USER: '25',
    });
    expect(config.port).toBe(3002);
    expect(config.instanceName).toBe('app-b');
    expect(config.realtime.transport).toBe('websocket');
    expect(config.realtime.emitConnectionEvent).toBe(false);
    expect(config.realtime.wsPingIntervalMs).toBe(5000);
    expect(config.realtime.wsPingTimeoutMs).toBe(4000);
    expect(config.pubsubDriver).toBe('redis');
    expect(config.reauth.onFailure).toBe('event');
    expect(config.reauth.cacheTtlMs).toBe(0);
    expect(config.offlineQueue.enabled).toBe(true);
    expect(config.offlineQueue.ttlSeconds).toBe(120);
    expect(config.offlineQueue.maxPerUser).toBe(25);
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

  it('resolves the boot transport from the environment', () => {
    // Scenario: the module tree reads the transport hint before DI; a valid value is
    // returned, and an unset or invalid value falls back to the default so the hint
    // never fails the boot on its own (loadEnv reports the real error).
    const original = process.env.REALTIME_TRANSPORT;
    try {
      process.env.REALTIME_TRANSPORT = 'websocket';
      expect(resolveBootTransport()).toBe('websocket');
      delete process.env.REALTIME_TRANSPORT;
      expect(resolveBootTransport()).toBe('sse');
      process.env.REALTIME_TRANSPORT = 'carrier-pigeon';
      expect(resolveBootTransport()).toBe('sse');
    } finally {
      if (original === undefined) delete process.env.REALTIME_TRANSPORT;
      else process.env.REALTIME_TRANSPORT = original;
    }
  });

  it('returns a deeply frozen configuration', () => {
    // Scenario: the config is shared process-wide, so neither the root nor its
    // grouped sub-objects may be mutated after boot.
    const config = loadEnv({});
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.realtime)).toBe(true);
    expect(Object.isFrozen(config.reauth)).toBe(true);
    expect(Object.isFrozen(config.offlineQueue)).toBe(true);
    expect(() => {
      (config as { port: number }).port = 9999;
    }).toThrow(TypeError);
    expect(() => {
      (config.realtime as { heartbeatMs: number }).heartbeatMs = 1;
    }).toThrow(TypeError);
  });
});

describe('loadEnv numeric bounds', () => {
  /**
   * Boundary rejection and mid-range acceptance for every bounded numeric.
   *
   * Each field must reject a value below its floor and above its ceiling, and
   * accept a distinct in-range value, so neither bound can be relaxed, dropped or
   * collapsed onto the other without a test failing. `variable` names the env key,
   * `below`/`above` are out-of-range, and `valid` is an in-range value read back
   * through `read` to prove it is mapped, not silently defaulted.
   */
  const cases: ReadonlyArray<{
    readonly variable: string;
    readonly below: string;
    readonly above: string;
    readonly valid: string;
    readonly read: (config: AppConfig) => number;
    readonly expected: number;
  }> = [
    {
      variable: 'PORT',
      below: '0',
      above: '65536',
      valid: '4100',
      read: (c) => c.port,
      expected: 4100,
    },
    {
      variable: 'REALTIME_HEARTBEAT_MS',
      below: '999',
      above: '600001',
      valid: '5000',
      read: (c) => c.realtime.heartbeatMs,
      expected: 5000,
    },
    {
      variable: 'REALTIME_REPLAY_BUFFER_SIZE',
      below: '0',
      above: '10001',
      valid: '25',
      read: (c) => c.realtime.replayBufferSize,
      expected: 25,
    },
    {
      variable: 'REALTIME_MAX_CONNECTIONS_PER_USER',
      below: '0',
      above: '1001',
      valid: '7',
      read: (c) => c.realtime.maxConnectionsPerUser,
      expected: 7,
    },
    {
      variable: 'REALTIME_WS_MAX_BUFFER_BYTES',
      below: '1023',
      above: '10485761',
      valid: '2048',
      read: (c) => c.realtime.wsMaxBufferBytes,
      expected: 2048,
    },
    {
      variable: 'REALTIME_WS_PING_INTERVAL_MS',
      below: '999',
      above: '300001',
      valid: '9000',
      read: (c) => c.realtime.wsPingIntervalMs,
      expected: 9000,
    },
    {
      variable: 'REALTIME_WS_PING_TIMEOUT_MS',
      below: '999',
      above: '300001',
      valid: '8000',
      read: (c) => c.realtime.wsPingTimeoutMs,
      expected: 8000,
    },
    {
      variable: 'REAUTH_INTERVAL_SECONDS',
      below: '0',
      above: '86401',
      valid: '42',
      read: (c) => c.reauth.intervalSeconds,
      expected: 42,
    },
    {
      variable: 'REAUTH_CACHE_TTL_MS',
      below: '-1',
      above: '3600001',
      valid: '2500',
      read: (c) => c.reauth.cacheTtlMs,
      expected: 2500,
    },
    {
      variable: 'OFFLINE_QUEUE_TTL_SECONDS',
      below: '0',
      above: '604801',
      valid: '900',
      read: (c) => c.offlineQueue.ttlSeconds,
      expected: 900,
    },
    {
      variable: 'OFFLINE_QUEUE_MAX_PER_USER',
      below: '0',
      above: '100001',
      valid: '250',
      read: (c) => c.offlineQueue.maxPerUser,
      expected: 250,
    },
  ];

  it.each(cases)('bounds $variable at both ends and maps a valid value', (testCase) => {
    // Below the floor and above the ceiling are refused, naming the variable.
    expect(() => loadEnv({ [testCase.variable]: testCase.below })).toThrow(
      new RegExp(testCase.variable),
    );
    expect(() => loadEnv({ [testCase.variable]: testCase.above })).toThrow(
      new RegExp(testCase.variable),
    );
    // A distinct in-range value is coerced and mapped, not defaulted.
    expect(testCase.read(loadEnv({ [testCase.variable]: testCase.valid }))).toBe(testCase.expected);
  });

  it('rejects a non-integer for a coerced numeric', () => {
    // Scenario: fractional input for an `.int()` field is refused rather than floored.
    expect(() => loadEnv({ PORT: '3001.5' })).toThrow(/PORT/);
  });
});

describe('loadEnv format constraints', () => {
  /**
   * Path fields must start with a slash.
   *
   * The SSE endpoint and WebSocket namespace are mounted paths, so a value without
   * a leading slash is refused and a custom slash-prefixed value is mapped through,
   * proving the `startsWith('/')` and non-empty guards are both live.
   */
  it('requires a leading slash on path fields and maps a custom one', () => {
    expect(() => loadEnv({ REALTIME_SSE_ENDPOINT: 'api/events' })).toThrow(/REALTIME_SSE_ENDPOINT/);
    expect(() => loadEnv({ REALTIME_WS_NAMESPACE: 'live' })).toThrow(/REALTIME_WS_NAMESPACE/);
    const config = loadEnv({ REALTIME_SSE_ENDPOINT: '/stream', REALTIME_WS_NAMESPACE: '/rt' });
    expect(config.realtime.sseEndpoint).toBe('/stream');
    expect(config.realtime.wsNamespace).toBe('/rt');
  });

  /**
   * Redis URL scheme anchoring.
   *
   * Both `redis://` and `rediss://` are accepted, but the scheme must be at the
   * start of the string, so a URL whose scheme appears mid-string is refused. This
   * kills mutations that drop the `^` anchor or the optional TLS `s`.
   */
  it('accepts redis and rediss schemes anchored at the start', () => {
    expect(loadEnv({ REDIS_URL: 'redis://host:6379' }).redisUrl).toBe('redis://host:6379');
    expect(loadEnv({ REDIS_URL: 'rediss://host:6380' }).redisUrl).toBe('rediss://host:6380');
    expect(() => loadEnv({ REDIS_URL: 'not-redis://host' })).toThrow(/REDIS_URL/);
    expect(() => loadEnv({ REDIS_URL: 'http://host' })).toThrow(/REDIS_URL/);
  });

  /**
   * Web origin scheme anchoring.
   *
   * Both `http://` and `https://` are accepted anchored at the start; a mid-string
   * scheme or a foreign scheme is refused, killing the anchor and optional-`s`
   * mutations on the origin pattern.
   */
  it('accepts http and https origins anchored at the start', () => {
    expect(loadEnv({ WEB_ORIGIN: 'http://app.local' }).webOrigin).toBe('http://app.local');
    expect(loadEnv({ WEB_ORIGIN: 'https://app.example' }).webOrigin).toBe('https://app.example');
    expect(() => loadEnv({ WEB_ORIGIN: 'x-http://app' })).toThrow(/WEB_ORIGIN/);
    expect(() => loadEnv({ WEB_ORIGIN: 'ftp://app' })).toThrow(/WEB_ORIGIN/);
  });

  /**
   * Session secret minimum length.
   *
   * A secret shorter than sixteen characters is refused so a weak HMAC key never
   * boots; a sixteen-character secret is accepted at the boundary.
   */
  it('enforces the session secret minimum length', () => {
    expect(() => loadEnv({ SESSION_SECRET: 'fifteen-chars-x' })).toThrow(/SESSION_SECRET/);
    expect(loadEnv({ SESSION_SECRET: 'sixteen-chars-ok' }).sessionSecret).toBe('sixteen-chars-ok');
  });

  /**
   * Non-empty string fields.
   *
   * The instance name must be non-empty and is mapped through, so the `min(1)`
   * guard and the field mapping both stay live.
   */
  it('requires a non-empty instance name and maps it', () => {
    expect(() => loadEnv({ INSTANCE_NAME: '' })).toThrow(/INSTANCE_NAME/);
    expect(loadEnv({ INSTANCE_NAME: 'app-x' }).instanceName).toBe('app-x');
  });
});
