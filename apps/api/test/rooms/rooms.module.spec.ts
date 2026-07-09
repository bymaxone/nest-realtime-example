/**
 * Unit tests for RoomsModule.
 *
 * Layer: unit.
 * Goal: the module resolves its controller against the global registry, realtime
 *       and the lifecycle membership tracker.
 * Mocks: global RealtimeService + ConnectionRegistry stubs; APP_CONFIG overridden.
 */

import { Test } from '@nestjs/testing';

import { APP_CONFIG } from '../../src/config/config.tokens';
import { ConfigModule } from '../../src/config/config.module';
import { RoomsController } from '../../src/rooms/rooms.controller';
import { RoomsModule } from '../../src/rooms/rooms.module';
import { buildTestConfig } from '../support/config.fixture';
import { mockRealtimeService, realtimeStubModule } from '../support/realtime.fixture';

describe('RoomsModule', () => {
  /**
   * Wiring check.
   *
   * The module must expose RoomsController with its service resolved against the
   * global providers and the lifecycle membership tracker.
   */
  it('resolves the rooms controller', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, realtimeStubModule(mockRealtimeService().service), RoomsModule],
    })
      .overrideProvider(APP_CONFIG)
      .useValue(buildTestConfig())
      .compile();

    expect(moduleRef.get(RoomsController)).toBeInstanceOf(RoomsController);

    await moduleRef.close();
  });
});
