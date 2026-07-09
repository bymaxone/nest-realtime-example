/**
 * Unit tests for AppModule composition.
 *
 * Layer: unit.
 * Goal: the root module composes the config and liveness modules.
 * Mocks: none; inspects the module metadata without booting providers.
 */

import 'reflect-metadata';

import { AppModule } from '../src/app.module';
import { ConfigModule } from '../src/config/config.module';
import { HealthModule } from '../src/health/health.module';

describe('AppModule', () => {
  /**
   * Composition guard.
   *
   * The root module must import the global config module and the liveness
   * module; these are the foundation every later feature builds on, so their
   * presence is pinned here.
   */
  it('composes the config and health modules', () => {
    const imports: unknown[] = Reflect.getMetadata('imports', AppModule) as unknown[];

    expect(imports).toContain(ConfigModule);
    expect(imports).toContain(HealthModule);
  });
});
