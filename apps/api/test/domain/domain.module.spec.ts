/**
 * Unit tests for DomainModule.
 *
 * Layer: unit.
 * Goal: the module resolves its controller and supplies the event delay.
 * Mocks: a global RealtimeService stub; APP_CONFIG overridden for the auth deps.
 */

import { Test } from '@nestjs/testing';

import { APP_CONFIG } from '../../src/config/config.tokens';
import { ConfigModule } from '../../src/config/config.module';
import { DomainController } from '../../src/domain/domain.controller';
import { DomainModule } from '../../src/domain/domain.module';
import { DEFAULT_EVENT_DELAY_MS, EVENT_DELAY_MS } from '../../src/domain/domain.tokens';
import { buildTestConfig } from '../support/config.fixture';
import { mockRealtimeService, realtimeStubModule } from '../support/realtime.fixture';

describe('DomainModule', () => {
  /**
   * Wiring check.
   *
   * The module must expose DomainController and provide the default event delay.
   */
  it('resolves the domain controller and delay', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, realtimeStubModule(mockRealtimeService().service), DomainModule],
    })
      .overrideProvider(APP_CONFIG)
      .useValue(buildTestConfig())
      .compile();

    expect(moduleRef.get(DomainController)).toBeInstanceOf(DomainController);
    expect(moduleRef.get(EVENT_DELAY_MS)).toBe(DEFAULT_EVENT_DELAY_MS);

    await moduleRef.close();
  });
});
