/**
 * Unit tests for HealthModule.
 *
 * Layer: unit.
 * Goal: the module resolves its controller against the global config token.
 * Mocks: the global ConfigModule is imported, then APP_CONFIG is overridden.
 */

import { Test } from '@nestjs/testing';

import { APP_CONFIG } from '../../src/config/config.tokens';
import { ConfigModule } from '../../src/config/config.module';
import { HealthController } from '../../src/health/health.controller';
import { HealthModule } from '../../src/health/health.module';
import { buildTestConfig } from '../support/config.fixture';

describe('HealthModule', () => {
  /**
   * Wiring check.
   *
   * The module must expose HealthController with its APP_CONFIG dependency
   * satisfied from the global config module, proving the controller is
   * registered and injectable against the real token.
   */
  it('resolves the health controller against the config token', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ConfigModule, HealthModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(buildTestConfig({ instanceName: 'app-x' }))
      .compile();

    const controller = moduleRef.get(HealthController);

    expect(controller).toBeInstanceOf(HealthController);
    expect(controller.check().instance).toBe('app-x');
    await moduleRef.close();
  });
});
