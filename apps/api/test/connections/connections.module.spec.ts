/**
 * Unit tests for ConnectionsModule.
 *
 * Layer: unit.
 * Goal: the module resolves its controller against the global registry and realtime.
 * Mocks: global RealtimeService + ConnectionRegistry stubs; APP_CONFIG overridden.
 */

import { Test } from '@nestjs/testing';

import { APP_CONFIG } from '../../src/config/config.tokens';
import { ConfigModule } from '../../src/config/config.module';
import { ConnectionsController } from '../../src/connections/connections.controller';
import { ConnectionsModule } from '../../src/connections/connections.module';
import { EvictionLabController } from '../../src/connections/eviction-lab.controller';
import { buildTestConfig } from '../support/config.fixture';
import { mockRealtimeService, realtimeStubModule } from '../support/realtime.fixture';

describe('ConnectionsModule', () => {
  /**
   * Wiring check.
   *
   * The module must expose ConnectionsController with its service resolved against
   * the globally-registered ConnectionRegistry and RealtimeService.
   */
  it('resolves the connections controller', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, realtimeStubModule(mockRealtimeService().service), ConnectionsModule],
    })
      .overrideProvider(APP_CONFIG)
      .useValue(buildTestConfig())
      .compile();

    expect(moduleRef.get(ConnectionsController)).toBeInstanceOf(ConnectionsController);
    expect(moduleRef.get(EvictionLabController)).toBeInstanceOf(EvictionLabController);

    await moduleRef.close();
  });
});
