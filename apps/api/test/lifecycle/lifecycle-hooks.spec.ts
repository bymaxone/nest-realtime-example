/**
 * Unit tests for CompositeLifecycleHooks.
 *
 * Layer: unit.
 * Goal: every lifecycle call fans out to all consumers, and the audit consumer
 *       (registered first) always runs before later consumers.
 * Mocks: AuditService and ConnectionEventLog doubles with spied hook methods.
 */

import type { ConnectionEventMeta } from '@bymax-one/nest-realtime';

import type { AuditService } from '../../src/audit/audit.service';
import type { ConnectionEventLog } from '../../src/lifecycle/connection-event-log';
import { CompositeLifecycleHooks } from '../../src/lifecycle/lifecycle-hooks';

const META: ConnectionEventMeta = {
  connectionId: 'c1',
  userId: 'ana@acme',
  tenantId: 'acme',
  transport: 'sse',
  ip: '127.0.0.1',
  userAgent: undefined,
  connectedAt: new Date('2026-07-09T12:00:00.000Z'),
};

/** The consumer doubles and the composite built over them. */
interface Harness {
  readonly composite: CompositeLifecycleHooks;
  readonly audit: Record<string, jest.Mock>;
  readonly log: Record<string, jest.Mock>;
}

/** Build the composite over spied audit and connection-log consumers. */
function build(): Harness {
  const audit = {
    onConnect: jest.fn(),
    onDisconnect: jest.fn(),
    onError: jest.fn(),
    onReauthenticationFailed: jest.fn(),
  };
  const log = { onConnect: jest.fn(), onDisconnect: jest.fn() };
  const composite = new CompositeLifecycleHooks(
    audit as unknown as AuditService,
    log as unknown as ConnectionEventLog,
  );
  return { composite, audit, log };
}

describe('CompositeLifecycleHooks', () => {
  /**
   * Connect fan-out and order.
   *
   * onConnect must reach both consumers, and the audit consumer (a config hook)
   * must run before the connection log, proving the documented ordering.
   */
  it('fans onConnect out with audit first', async () => {
    const { composite, audit, log } = build();

    await composite.onConnect(META);

    expect(audit.onConnect).toHaveBeenCalledWith(META);
    expect(log.onConnect).toHaveBeenCalledWith(META);
    expect(audit.onConnect.mock.invocationCallOrder[0]).toBeLessThan(
      log.onConnect.mock.invocationCallOrder[0] as number,
    );
  });

  /**
   * Disconnect fan-out.
   *
   * onDisconnect must reach both consumers with the reason and duration intact.
   */
  it('fans onDisconnect out to every consumer', async () => {
    const { composite, audit, log } = build();
    const meta = { ...META, reason: 'REALTIME_TOO_MANY_CONNECTIONS', durationMs: 12 };

    await composite.onDisconnect(meta);

    expect(audit.onDisconnect).toHaveBeenCalledWith(meta);
    expect(log.onDisconnect).toHaveBeenCalledWith(meta);
  });

  /**
   * Error and reauth fan-out.
   *
   * onError and onReauthenticationFailed must reach a consumer that implements
   * them, and silently skip a consumer that does not (optional hooks).
   */
  it('fans error and reauth-failed to the implementing consumers', async () => {
    const { composite, audit, log } = build();
    const errorMeta = { connectionId: 'c1', error: new Error('boom'), transport: 'sse' as const };

    await composite.onError(errorMeta);
    await composite.onReauthenticationFailed(META);

    expect(audit.onError).toHaveBeenCalledWith(errorMeta);
    expect(audit.onReauthenticationFailed).toHaveBeenCalledWith(META);
    // The connection log does not implement these hooks; optional chaining skips it.
    expect(log.onError).toBeUndefined();
  });
});
