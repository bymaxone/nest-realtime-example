/**
 * Unit tests for ClusterStatsController.
 *
 * Layer: unit.
 * Goal: the endpoint returns the service's current counter snapshot verbatim.
 * Mocks: a ClusterStatsService double.
 */

import {
  type ClusterStats,
  ClusterStatsService,
} from '../../src/connections/cluster-stats.service';
import { ClusterStatsController } from '../../src/connections/cluster-stats.controller';

describe('ClusterStatsController', () => {
  /**
   * Snapshot passthrough.
   *
   * The controller must return the service's snapshot unchanged so the lab reads
   * this instance's live fan-out counters.
   */
  it('returns the current stats snapshot', () => {
    const snapshot: ClusterStats = {
      instance: 'app-a',
      published: 1,
      receivedRemote: 0,
      deliveredLocal: 1,
    };
    const service = {
      snapshot: jest.fn().mockReturnValue(snapshot),
    } as unknown as ClusterStatsService;
    const controller = new ClusterStatsController(service);

    expect(controller.read()).toBe(snapshot);
    expect(service.snapshot).toHaveBeenCalledTimes(1);
  });
});
