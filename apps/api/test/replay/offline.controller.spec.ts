/**
 * Unit tests for OfflineController.
 *
 * Layer: unit.
 * Goal: emit and ack forward to the service; peek rejects a missing userId before
 *       the service is touched and otherwise returns the user's queue.
 * Mocks: an OfflineService double.
 */

import { BadRequestException } from '@nestjs/common';

import type { SessionTraits } from '../../src/auth/session.types';
import { OfflineController } from '../../src/replay/offline.controller';
import type { OfflineService } from '../../src/replay/offline.service';

const TRAITS: SessionTraits = { userId: 'gil@globex', tenantId: 'globex', roles: ['admin'] };

/** Build the controller over an OfflineService double. */
function build() {
  const emit = jest.fn().mockResolvedValue(5);
  const peek = jest.fn().mockResolvedValue([]);
  const acknowledge = jest.fn().mockResolvedValue(undefined);
  const service = { emit, peek, acknowledge } as unknown as OfflineService;
  return { controller: new OfflineController(service), emit, peek, acknowledge };
}

describe('OfflineController', () => {
  /**
   * Emit forwarding.
   *
   * emit must forward the target user and count and echo how many were enqueued.
   */
  it('forwards an offline emit', async () => {
    const { controller, emit } = build();

    expect(await controller.emit({ userId: 'gil@globex', count: 5 })).toEqual({ emitted: 5 });
    expect(emit).toHaveBeenCalledWith('gil@globex', 5);
  });

  /**
   * Peek forwarding.
   *
   * With a userId present, peek must return the user id alongside the queue.
   */
  it('returns the queue for a named user', async () => {
    const { controller, peek } = build();
    peek.mockResolvedValue([{ seq: 1, id: 'x', emittedAt: 'now' }]);

    const result = await controller.peek('gil@globex');

    expect(result).toEqual({
      userId: 'gil@globex',
      events: [{ seq: 1, id: 'x', emittedAt: 'now' }],
    });
    expect(peek).toHaveBeenCalledWith('gil@globex');
  });

  /**
   * Missing userId.
   *
   * A blank or absent userId must 400 before the service is touched.
   */
  it('rejects a peek with a missing userId', async () => {
    const { controller, peek } = build();

    await expect(controller.peek(undefined)).rejects.toThrow(BadRequestException);
    await expect(controller.peek('')).rejects.toThrow(BadRequestException);
    expect(peek).not.toHaveBeenCalled();
  });

  /**
   * Acknowledge forwarding.
   *
   * ack must purge the caller's own queue up to the given id and confirm.
   */
  it('forwards an acknowledge for the caller', async () => {
    const { controller, acknowledge } = build();

    expect(await controller.ack({ upToId: 'id-9' }, TRAITS)).toEqual({ acknowledged: true });
    expect(acknowledge).toHaveBeenCalledWith('gil@globex', 'id-9');
  });
});
