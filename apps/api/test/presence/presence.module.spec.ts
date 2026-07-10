/**
 * Unit tests for PresenceModule.
 *
 * Layer: unit (module integration).
 * Goal: the module resolves the roster controller and the lifecycle tracker.
 * Mocks: the global ConfigModule plus an overridden APP_CONFIG.
 */

import { Test } from '@nestjs/testing';

import { APP_CONFIG } from '../../src/config/config.tokens';
import { ConfigModule } from '../../src/config/config.module';
import { PresenceController } from '../../src/presence/presence.controller';
import { PresenceModule } from '../../src/presence/presence.module';
import { PresenceTracker } from '../../src/presence/presence.tracker';
import { buildTestConfig } from '../support/config.fixture';

describe('PresenceModule', () => {
  /**
   * Wiring check.
   *
   * The module must expose the presence controller and the presence tracker so the
   * roster endpoint is served and the lifecycle composite can populate presence.
   */
  it('resolves the presence controller and tracker', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ConfigModule, PresenceModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(buildTestConfig())
      .compile();

    expect(moduleRef.get(PresenceController)).toBeInstanceOf(PresenceController);
    expect(moduleRef.get(PresenceTracker)).toBeInstanceOf(PresenceTracker);

    await moduleRef.close();
  });
});
