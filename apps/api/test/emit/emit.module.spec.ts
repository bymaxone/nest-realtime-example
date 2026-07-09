/**
 * Unit tests for EmitModule.
 *
 * Layer: unit.
 * Goal: the module resolves its controller against the global realtime service.
 * Mocks: a global RealtimeService stub; APP_CONFIG overridden for the auth deps.
 */

import { Test } from '@nestjs/testing';

import { APP_CONFIG } from '../../src/config/config.tokens';
import { ConfigModule } from '../../src/config/config.module';
import { EmitController } from '../../src/emit/emit.controller';
import { EmitModule } from '../../src/emit/emit.module';
import { buildTestConfig } from '../support/config.fixture';
import { mockRealtimeService, realtimeStubModule } from '../support/realtime.fixture';

describe('EmitModule', () => {
  /**
   * Wiring check.
   *
   * The module must expose EmitController with its service resolved against the
   * globally-registered RealtimeService.
   */
  it('resolves the emit controller', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, realtimeStubModule(mockRealtimeService().service), EmitModule],
    })
      .overrideProvider(APP_CONFIG)
      .useValue(buildTestConfig())
      .compile();

    expect(moduleRef.get(EmitController)).toBeInstanceOf(EmitController);

    await moduleRef.close();
  });
});
