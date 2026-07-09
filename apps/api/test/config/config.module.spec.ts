/**
 * @fileoverview Unit specs for the global configuration module wiring.
 * @layer test
 *
 * Asserts the module registers the loader under the APP_CONFIG token, exports
 * that token, and is marked global, without booting a full Nest container.
 */

import 'reflect-metadata';

import { ConfigModule } from '../../src/config/config.module';
import { APP_CONFIG } from '../../src/config/config.tokens';
import { loadEnv } from '../../src/config/env.loader';

/** The shape of the factory provider this module registers. */
interface FactoryProvider {
  readonly provide: symbol;
  readonly useFactory: unknown;
}

describe('ConfigModule', () => {
  it('registers the environment loader under the APP_CONFIG token', () => {
    // Scenario: the container resolves APP_CONFIG by running the loader factory.
    const providers = Reflect.getMetadata('providers', ConfigModule) as FactoryProvider[];
    const configProvider = providers.find((provider) => provider.provide === APP_CONFIG);
    expect(configProvider).toBeDefined();
    expect(configProvider?.useFactory).toBe(loadEnv);
  });

  it('exports the APP_CONFIG token for other modules to inject', () => {
    // Scenario: feature modules inject the frozen config without importing this
    // module, which requires the token to be exported.
    const exportsMetadata = Reflect.getMetadata('exports', ConfigModule) as symbol[];
    expect(exportsMetadata).toContain(APP_CONFIG);
  });

  it('is registered as a global module', () => {
    // Scenario: the config is available application-wide, so the module carries
    // the global marker.
    const isGlobal = Reflect.getMetadata('__module:global__', ConfigModule) as boolean;
    expect(isGlobal).toBe(true);
  });
});
