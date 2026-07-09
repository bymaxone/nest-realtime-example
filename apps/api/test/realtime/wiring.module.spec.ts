/**
 * Unit tests for RealtimeWiringModule.
 *
 * Layer: unit (module integration).
 * Goal: the async wiring boots and exposes RealtimeService via the options factory.
 * Mocks: the global ConfigModule is imported, then APP_CONFIG is overridden.
 */

import { RealtimeService } from '@bymax-one/nest-realtime';
import { Test } from '@nestjs/testing';

import { APP_CONFIG } from '../../src/config/config.tokens';
import { ConfigModule } from '../../src/config/config.module';
import { RealtimeWiringModule } from '../../src/realtime/wiring.module';
import { buildTestConfig } from '../support/config.fixture';

describe('RealtimeWiringModule', () => {
  /**
   * Async boot.
   *
   * Compiling the module must resolve the options factory (invoking the injected
   * config and authenticator) and expose the library's RealtimeService, proving
   * the canonical forRootAsync wiring works end to end in the container.
   */
  it('boots the async wiring and exposes RealtimeService', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, RealtimeWiringModule],
    })
      .overrideProvider(APP_CONFIG)
      .useValue(buildTestConfig())
      .compile();

    expect(moduleRef.get(RealtimeService)).toBeInstanceOf(RealtimeService);

    await moduleRef.close();
  });
});
