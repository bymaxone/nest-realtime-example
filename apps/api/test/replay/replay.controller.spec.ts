/**
 * Unit tests for ReplayController.
 *
 * Layer: unit.
 * Goal: each endpoint forwards to the service with the caller's id, and the
 *       timeline rejects a missing userId before touching the service.
 * Mocks: a ReplayService double.
 */

import { BadRequestException } from '@nestjs/common';

import type { SessionTraits } from '../../src/auth/session.types';
import { ReplayController } from '../../src/replay/replay.controller';
import type { ReplayService, ReplayTimelineView } from '../../src/replay/replay.service';

const TRAITS: SessionTraits = { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] };

/** Build the controller over a ReplayService double. */
function build() {
  const burst = jest.fn().mockResolvedValue(3);
  const drop = jest.fn().mockResolvedValue(2);
  const timelineFor = jest.fn().mockResolvedValue({ userId: 'ana@acme' } as ReplayTimelineView);
  const service = { burst, drop, timelineFor } as unknown as ReplayService;
  return { controller: new ReplayController(service), burst, drop, timelineFor };
}

describe('ReplayController', () => {
  /**
   * Burst forwarding.
   *
   * emit-burst must forward the caller's id and requested count and echo how many
   * events were emitted.
   */
  it('forwards a burst for the caller', async () => {
    const { controller, burst } = build();

    expect(await controller.emitBurst({ count: 3 }, TRAITS)).toEqual({ emitted: 3 });
    expect(burst).toHaveBeenCalledWith('ana@acme', 3);
  });

  /**
   * Drop forwarding.
   *
   * drop must force-close the caller's streams and echo the count closed.
   */
  it('forwards a drop for the caller', async () => {
    const { controller, drop } = build();

    expect(await controller.drop(TRAITS)).toEqual({ dropped: 2 });
    expect(drop).toHaveBeenCalledWith('ana@acme');
  });

  /**
   * Timeline forwarding.
   *
   * With a userId present, timeline must delegate to the service.
   */
  it('returns the timeline for a named user', async () => {
    const { controller, timelineFor } = build();

    await controller.timeline('bob@acme');

    expect(timelineFor).toHaveBeenCalledWith('bob@acme');
  });

  /**
   * Missing userId.
   *
   * A blank or absent userId must 400 before the service is touched, so the
   * endpoint never queries an empty user.
   */
  it('rejects a missing userId', () => {
    const { controller, timelineFor } = build();

    expect(() => controller.timeline(undefined)).toThrow(BadRequestException);
    expect(() => controller.timeline('')).toThrow(BadRequestException);
    expect(timelineFor).not.toHaveBeenCalled();
  });
});
