/**
 * Unit tests for AuditModule.
 *
 * Layer: unit.
 * Goal: the module resolves the controller and the shared audit service.
 * Mocks: the global ConfigModule is imported, then APP_CONFIG is overridden.
 */

import { Test } from '@nestjs/testing';

import { AuditController } from '../../src/audit/audit.controller';
import { AuditModule } from '../../src/audit/audit.module';
import { AuditService } from '../../src/audit/audit.service';
import { APP_CONFIG } from '../../src/config/config.tokens';
import { ConfigModule } from '../../src/config/config.module';
import { buildTestConfig } from '../support/config.fixture';

describe('AuditModule', () => {
  /**
   * Wiring check.
   *
   * The module must expose both the audit controller and the audit service (the
   * latter is shared with the realtime hooks).
   */
  it('resolves the audit controller and service', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ConfigModule, AuditModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(buildTestConfig())
      .compile();

    expect(moduleRef.get(AuditController)).toBeInstanceOf(AuditController);
    expect(moduleRef.get(AuditService)).toBeInstanceOf(AuditService);

    await moduleRef.close();
  });
});
