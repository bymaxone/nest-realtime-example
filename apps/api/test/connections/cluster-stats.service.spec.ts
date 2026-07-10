/**
 * Unit tests for ClusterStatsService.
 *
 * Layer: unit.
 * Goal: the counters increment independently and deliveredLocal derives from them.
 * Mocks: a frozen test config supplying the instance name.
 */

import { ClusterStatsService } from '../../src/connections/cluster-stats.service';
import { buildTestConfig } from '../support/config.fixture';

describe('ClusterStatsService', () => {
  /**
   * Initial snapshot.
   *
   * A fresh instance must report its name with all counts at zero, so the lab
   * reads a clean baseline before any emit.
   */
  it('starts at zero for the configured instance', () => {
    const stats = new ClusterStatsService(buildTestConfig({ instanceName: 'app-b' }));

    expect(stats.snapshot()).toEqual({
      instance: 'app-b',
      published: 0,
      receivedRemote: 0,
      deliveredLocal: 0,
    });
  });

  /**
   * Independent counters and derived delivery.
   *
   * publish and remote-delivery counts move independently, and deliveredLocal is
   * their sum, so one origin publish and one peer delivery each read as a single
   * local fan-out operation.
   */
  it('increments each counter independently and derives deliveredLocal', () => {
    const stats = new ClusterStatsService(buildTestConfig({ instanceName: 'app-a' }));

    stats.recordPublish();
    stats.recordPublish();
    stats.recordRemoteDelivery();

    expect(stats.snapshot()).toEqual({
      instance: 'app-a',
      published: 2,
      receivedRemote: 1,
      deliveredLocal: 3,
    });
  });
});
