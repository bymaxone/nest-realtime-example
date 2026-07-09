/**
 * Unit tests for HealthController.
 *
 * Layer: unit.
 * Goal: the liveness payload reflects the injected config and the package version.
 * Mocks: a frozen AppConfig fixture (no NestJS container needed).
 */

import { APP_VERSION } from '../../src/app.constants';
import { HealthController } from '../../src/health/health.controller';
import { buildTestConfig } from '../support/config.fixture';

describe('HealthController', () => {
  /**
   * Nominal liveness read.
   *
   * The endpoint must surface the configured instance name and active transport
   * plus a fixed 'ok' status and the package version, because the cluster labs
   * and infra probes rely on those exact fields.
   */
  it('returns ok with the configured instance, transport and version', () => {
    // Arrange
    const config = buildTestConfig({ instanceName: 'app-b', realtime: { transport: 'sse' } });
    const controller = new HealthController(config);

    // Act
    const result = controller.check();

    // Assert
    expect(result).toEqual({
      status: 'ok',
      instance: 'app-b',
      transport: 'sse',
      version: APP_VERSION,
    });
  });

  /**
   * Transport passthrough.
   *
   * A non-default transport profile must appear verbatim so operators can tell
   * which profile an instance booted with.
   */
  it('reflects a non-default transport profile', () => {
    const controller = new HealthController(buildTestConfig({ realtime: { transport: 'both' } }));

    expect(controller.check().transport).toBe('both');
  });
});
