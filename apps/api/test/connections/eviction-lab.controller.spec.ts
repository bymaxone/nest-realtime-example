/**
 * Unit tests for EvictionLabController.
 *
 * Layer: unit.
 * Goal: the endpoint returns the requested user's timeline and rejects a missing
 *       userId.
 * Mocks: a ConnectionEventLog double.
 */

import { BadRequestException } from '@nestjs/common';

import { EvictionLabController } from '../../src/connections/eviction-lab.controller';
import type { ConnectionEventLog } from '../../src/lifecycle/connection-event-log';

describe('EvictionLabController', () => {
  /**
   * Timeline passthrough.
   *
   * The controller must return the log's timeline for the requested user under a
   * userId-tagged envelope.
   */
  it('returns the timeline for a userId', () => {
    const entry = {
      connectionId: 'c1',
      userId: 'ana@acme',
      connectedAt: '2026-07-09T12:00:00.000Z',
      evictedAt: null,
      reason: null,
    };
    const timeline = jest.fn().mockReturnValue([entry]);
    const controller = new EvictionLabController({ timeline } as unknown as ConnectionEventLog);

    expect(controller.timeline('ana@acme')).toEqual({ userId: 'ana@acme', timeline: [entry] });
    expect(timeline).toHaveBeenCalledWith('ana@acme');
  });

  /**
   * Missing userId.
   *
   * Without a userId query parameter the endpoint must 400 rather than return an
   * unbounded or ambiguous result.
   */
  it('rejects a missing userId', () => {
    const controller = new EvictionLabController({
      timeline: jest.fn(),
    } as unknown as ConnectionEventLog);

    expect(() => controller.timeline(undefined)).toThrow(BadRequestException);
    expect(() => controller.timeline('')).toThrow(BadRequestException);
  });
});
