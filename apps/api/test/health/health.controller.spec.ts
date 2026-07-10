/**
 * Unit tests for HealthController.
 *
 * Layer: unit.
 * Goal: the liveness payload reflects the injected config and the package version.
 * Mocks: a frozen AppConfig fixture (no NestJS container needed).
 */

import { APP_VERSION } from '../../src/app.constants';
import { HealthController } from '../../src/health/health.controller';
import type { RedisRealtimePubSub } from '../../src/realtime/redis-realtime-pubsub';
import { buildTestConfig } from '../support/config.fixture';

/** A pub/sub double reporting a fixed availability. */
function pubsub(available: boolean): RedisRealtimePubSub {
  return { isAvailable: available } as unknown as RedisRealtimePubSub;
}

describe('HealthController', () => {
  /**
   * Nominal liveness read (single-instance).
   *
   * With no Redis pub/sub driver the endpoint must surface the configured instance,
   * transport, version, a fixed 'ok' status and pub/sub 'ok', because the cluster
   * labs and infra probes rely on those exact fields.
   */
  it('returns ok with the configured fields and ok pub/sub in single-instance mode', () => {
    // Arrange
    const config = buildTestConfig({ instanceName: 'app-b', realtime: { transport: 'sse' } });
    const controller = new HealthController(config, undefined);

    // Act
    const result = controller.check();

    // Assert
    expect(result).toEqual({
      status: 'ok',
      instance: 'app-b',
      transport: 'sse',
      version: APP_VERSION,
      pubsub: 'ok',
    });
  });

  /**
   * Transport passthrough.
   *
   * A non-default transport profile must appear verbatim so operators can tell
   * which profile an instance booted with.
   */
  it('reflects a non-default transport profile', () => {
    const controller = new HealthController(
      buildTestConfig({ realtime: { transport: 'both' } }),
      undefined,
    );

    expect(controller.check().transport).toBe('both');
  });

  /**
   * Healthy pub/sub driver.
   *
   * With a Redis driver reporting available, the pub/sub flag must be 'ok' so the
   * frontend shows cross-instance fan-out is live.
   */
  it('reports ok pub/sub when the driver is available', () => {
    const controller = new HealthController(buildTestConfig(), pubsub(true));

    expect(controller.check().pubsub).toBe('ok');
  });

  /**
   * Degraded pub/sub driver.
   *
   * With a Redis driver reporting unavailable (Redis lost), the pub/sub flag must be
   * 'degraded' so the frontend can show the instance has fallen back to
   * single-instance delivery.
   */
  it('reports degraded pub/sub when the driver is unavailable', () => {
    const controller = new HealthController(buildTestConfig(), pubsub(false));

    expect(controller.check().pubsub).toBe('degraded');
  });
});
