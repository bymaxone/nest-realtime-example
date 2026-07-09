/**
 * Unit tests for LifecycleModule.
 *
 * Layer: unit.
 * Goal: the module resolves the connection event log and the composite hooks.
 * Mocks: the global ConfigModule is imported, then APP_CONFIG is overridden.
 */

import { Test } from '@nestjs/testing';

import { APP_CONFIG } from '../../src/config/config.tokens';
import { ConfigModule } from '../../src/config/config.module';
import { ConnectionEventLog } from '../../src/lifecycle/connection-event-log';
import { CompositeLifecycleHooks } from '../../src/lifecycle/lifecycle-hooks';
import { LifecycleModule } from '../../src/lifecycle/lifecycle.module';
import { RoomMembershipTracker } from '../../src/lifecycle/room-membership.tracker';
import { buildTestConfig } from '../support/config.fixture';

describe('LifecycleModule', () => {
  /**
   * Wiring check.
   *
   * The module must resolve the connection event log and the composite hooks, so
   * the realtime wiring can inject a single lifecycle-hooks object.
   */
  it('resolves the event log and composite hooks', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ConfigModule, LifecycleModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(buildTestConfig())
      .compile();

    expect(moduleRef.get(ConnectionEventLog)).toBeInstanceOf(ConnectionEventLog);
    expect(moduleRef.get(RoomMembershipTracker)).toBeInstanceOf(RoomMembershipTracker);
    expect(moduleRef.get(CompositeLifecycleHooks)).toBeInstanceOf(CompositeLifecycleHooks);

    await moduleRef.close();
  });
});
