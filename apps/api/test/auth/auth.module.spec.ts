/**
 * Unit tests for AuthModule.
 *
 * Layer: unit.
 * Goal: the module resolves its controller, session service, guard and store.
 * Mocks: the global ConfigModule is imported, then APP_CONFIG is overridden.
 */

import { Test } from '@nestjs/testing';

import { AuthController } from '../../src/auth/auth.controller';
import { AuthModule } from '../../src/auth/auth.module';
import { REVOCATION_STORE } from '../../src/auth/auth.tokens';
import { SessionGuard } from '../../src/auth/session.guard';
import { SessionService } from '../../src/auth/session.service';
import { APP_CONFIG } from '../../src/config/config.tokens';
import { ConfigModule } from '../../src/config/config.module';
import { buildTestConfig } from '../support/config.fixture';

describe('AuthModule', () => {
  /**
   * Wiring check.
   *
   * The module must resolve the controller and every provider it exports,
   * proving the Redis client, revocation store and session pieces are wired.
   */
  it('resolves the auth controller and providers', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ConfigModule, AuthModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(buildTestConfig())
      .compile();

    expect(moduleRef.get(AuthController)).toBeInstanceOf(AuthController);
    expect(moduleRef.get(SessionService)).toBeInstanceOf(SessionService);
    expect(moduleRef.get(SessionGuard)).toBeInstanceOf(SessionGuard);
    expect(moduleRef.get(REVOCATION_STORE)).toBeDefined();

    await moduleRef.close();
  });
});
