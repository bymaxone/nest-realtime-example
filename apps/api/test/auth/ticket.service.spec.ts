/**
 * Unit tests for TicketService.
 *
 * Layer: unit.
 * Goal: a ticket is issued with a 60s TTL and consumed exactly once; reuse,
 *       expiry and malformed payloads all resolve to null; traits never reach a log.
 * Mocks: a hand-rolled TicketRedis double capturing set/getdel calls.
 */

import type { AuthenticationResult } from '@bymax-one/nest-realtime';

import { type TicketRedis, TicketService } from '../../src/auth/ticket.service';

/** A TicketRedis double whose responses each test controls. */
interface RedisDouble {
  readonly redis: TicketRedis;
  readonly set: jest.Mock;
  readonly getdel: jest.Mock;
}

/** Build a TicketRedis double with jest spies for set and getdel. */
function mockRedis(): RedisDouble {
  const set = jest.fn().mockResolvedValue('OK');
  const getdel = jest.fn().mockResolvedValue(null);
  return { redis: { set, getdel }, set, getdel };
}

const TRAITS: AuthenticationResult = { userId: 'ana@acme', tenantId: 'acme', roles: ['admin'] };

describe('TicketService', () => {
  /**
   * Happy-path roundtrip.
   *
   * issue must store the JSON-encoded traits under `realtime:ticket:{id}` with a
   * 60-second expiry and return the opaque id; consume must decode the same value
   * back into the original traits.
   */
  it('issues a ticket with a 60s TTL and consumes it back to the traits', async () => {
    // Arrange
    const { redis, set, getdel } = mockRedis();
    const service = new TicketService(redis);

    // Act
    const id = await service.issue(TRAITS);
    const [key, value, mode, ttl] = set.mock.calls[0] as [string, string, string, number];
    getdel.mockResolvedValueOnce(value);
    const consumed = await service.consume(id);

    // Assert
    expect(key).toBe(`realtime:ticket:${id}`);
    expect(mode).toBe('EX');
    expect(ttl).toBe(60);
    expect(JSON.parse(value)).toEqual(TRAITS);
    expect(getdel).toHaveBeenCalledWith(`realtime:ticket:${id}`);
    expect(consumed).toEqual(TRAITS);
  });

  /**
   * One-shot guarantee.
   *
   * The store consumes with GETDEL, so the key is gone after the first redeem: a
   * second consume sees null and must return null, proving reuse fails.
   */
  it('returns null on a second consume of the same ticket', async () => {
    const { redis, getdel } = mockRedis();
    const service = new TicketService(redis);
    getdel.mockResolvedValueOnce(JSON.stringify(TRAITS)).mockResolvedValueOnce(null);

    const first = await service.consume('id-1');
    const second = await service.consume('id-1');

    expect(first).toEqual(TRAITS);
    expect(second).toBeNull();
  });

  /**
   * Expiry edge case.
   *
   * After the 60s TTL elapses the key is gone, so GETDEL returns null and consume
   * must resolve to null rather than a stale identity.
   */
  it('returns null when the ticket has expired', async () => {
    const { redis, getdel } = mockRedis();
    const service = new TicketService(redis);
    getdel.mockResolvedValueOnce(null);

    await expect(service.consume('expired')).resolves.toBeNull();
  });

  /**
   * Malformed-id / malformed-payload edge case.
   *
   * A garbage id yields non-JSON (or schema-invalid) content; consume must never
   * throw and must resolve to null so a forged ticket cannot authenticate.
   */
  it('returns null for a malformed stored payload', async () => {
    const { redis, getdel } = mockRedis();
    const service = new TicketService(redis);
    getdel
      .mockResolvedValueOnce('not-json')
      .mockResolvedValueOnce(JSON.stringify({ tenantId: 'acme' }));

    await expect(service.consume('garbage')).resolves.toBeNull();
    await expect(service.consume('schema-miss')).resolves.toBeNull();
  });

  /**
   * Minimal-identity roundtrip.
   *
   * A ticket may carry only a userId (no tenant, no roles); consume must return a
   * result that omits the absent optionals rather than materializing them as
   * undefined, matching the library's AuthenticationResult shape.
   */
  it('consumes a userId-only ticket, omitting absent optionals', async () => {
    const { redis, getdel } = mockRedis();
    const service = new TicketService(redis);
    getdel.mockResolvedValueOnce(JSON.stringify({ userId: 'solo@acme' }));

    const consumed = await service.consume('solo');

    expect(consumed).toEqual({ userId: 'solo@acme' });
    expect(consumed).not.toHaveProperty('tenantId');
    expect(consumed).not.toHaveProperty('roles');
  });

  /**
   * Log-hygiene invariant.
   *
   * Tickets carry an identity, so a leaked log must never reveal them: neither
   * issue nor consume may write to any console channel.
   */
  it('never logs the ticket or its traits', async () => {
    const { redis, getdel } = mockRedis();
    const service = new TicketService(redis);
    const spies = [
      jest.spyOn(console, 'log').mockImplementation(() => undefined),
      jest.spyOn(console, 'warn').mockImplementation(() => undefined),
      jest.spyOn(console, 'error').mockImplementation(() => undefined),
    ];
    getdel.mockResolvedValueOnce(JSON.stringify(TRAITS));

    await service.issue(TRAITS);
    await service.consume('id');

    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    }
  });
});
