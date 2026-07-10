/**
 * Unit tests for ReplayModule.
 *
 * Layer: unit.
 * Goal: the module resolves both lab controllers against the global realtime
 *       providers, with the offline queue absent (optional) in the base profile.
 * Mocks: global RealtimeService + ConnectionRegistry stubs; APP_CONFIG overridden.
 */

import { Test } from '@nestjs/testing';

import { APP_CONFIG } from '../../src/config/config.tokens';
import { ConfigModule } from '../../src/config/config.module';
import { OfflineController } from '../../src/replay/offline.controller';
import { ReplayController } from '../../src/replay/replay.controller';
import { ReplayModule } from '../../src/replay/replay.module';
import { buildTestConfig } from '../support/config.fixture';
import { mockRealtimeService, realtimeStubModule } from '../support/realtime.fixture';

describe('ReplayModule', () => {
  /**
   * Wiring check.
   *
   * The module must expose both lab controllers with their services resolved
   * against the global realtime providers; the optional offline queue is absent
   * in this profile, proving `@Optional()` tolerates a disabled queue.
   */
  it('resolves the replay and offline controllers', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, realtimeStubModule(mockRealtimeService().service), ReplayModule],
    })
      .overrideProvider(APP_CONFIG)
      .useValue(buildTestConfig())
      .compile();

    expect(moduleRef.get(ReplayController)).toBeInstanceOf(ReplayController);
    expect(moduleRef.get(OfflineController)).toBeInstanceOf(OfflineController);

    await moduleRef.close();
  });
});
