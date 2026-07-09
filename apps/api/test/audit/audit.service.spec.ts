/**
 * Unit tests for AuditService.
 *
 * Layer: unit.
 * Goal: each hook records a typed, instance-tagged entry; the ring is capped;
 *       the feed reads newest-first with an optional kind filter.
 * Mocks: a frozen config fixture; hand-built lifecycle metas.
 */

import type { ConnectionEventMeta } from '@bymax-one/nest-realtime';

import { AuditService } from '../../src/audit/audit.service';
import { buildTestConfig } from '../support/config.fixture';

const META: ConnectionEventMeta = {
  connectionId: 'c-1',
  userId: 'ana@acme',
  tenantId: 'acme',
  transport: 'sse',
  ip: '127.0.0.1',
  userAgent: 'jest',
  connectedAt: new Date(),
};

const build = (): AuditService => new AuditService(buildTestConfig({ instanceName: 'app-a' }));

describe('AuditService', () => {
  /**
   * Connect recording.
   *
   * onConnect must append a connect entry tagged with the instance and carrying
   * the connection's identity for the audit page.
   */
  it('records a connect entry tagged with the instance', () => {
    const audit = build();

    audit.onConnect(META);

    const [entry] = audit.feed();
    expect(entry).toMatchObject({
      kind: 'connect',
      instance: 'app-a',
      connectionId: 'c-1',
      userId: 'ana@acme',
      tenantId: 'acme',
      transport: 'sse',
    });
    expect(typeof entry?.at).toBe('string');
  });

  /**
   * Disconnect duration.
   *
   * onDisconnect must record the duration and reason in extra so the feed shows
   * session length (spec §7 row 52).
   */
  it('records disconnect duration and reason', () => {
    const audit = build();

    audit.onDisconnect({ ...META, reason: 'client closed', durationMs: 4200 });

    expect(audit.feed('disconnect')[0]?.extra).toEqual({
      durationMs: 4200,
      reason: 'client closed',
    });
  });

  /**
   * Error recording.
   *
   * onError has no user context; it must record the transport and error message
   * only, never a user or tenant.
   */
  it('records a transport error without user context', () => {
    const audit = build();

    audit.onError({ connectionId: 'c-9', error: new Error('boom'), transport: 'sse' });

    const [entry] = audit.feed('error');
    expect(entry).toMatchObject({ kind: 'error', connectionId: 'c-9', extra: { message: 'boom' } });
    expect(entry?.userId).toBeUndefined();
  });

  /**
   * Reauth failure recording.
   *
   * onReauthenticationFailed must record a reauth-failed entry for the connection.
   */
  it('records a reauthentication failure', () => {
    const audit = build();

    audit.onReauthenticationFailed(META);

    expect(audit.feed('reauth-failed')[0]?.kind).toBe('reauth-failed');
  });

  /**
   * Newest-first ordering and filtering.
   *
   * The feed must return entries newest-first, and the kind filter must return
   * only the matching kind.
   */
  it('returns entries newest-first and filters by kind', () => {
    const audit = build();

    audit.onConnect({ ...META, connectionId: 'first' });
    audit.onReauthenticationFailed({ ...META, connectionId: 'second' });

    expect(audit.feed().map((entry) => entry.connectionId)).toEqual(['second', 'first']);
    expect(audit.feed('connect').map((entry) => entry.connectionId)).toEqual(['first']);
  });

  /**
   * Ring-buffer cap.
   *
   * Beyond the capacity the oldest entry is dropped so a long-lived instance
   * never grows unboundedly.
   */
  it('caps the ring buffer at 500 entries', () => {
    const audit = build();

    for (let index = 0; index < 501; index += 1) {
      audit.onConnect({ ...META, connectionId: `c-${index}` });
    }

    const entries = audit.feed();
    expect(entries).toHaveLength(500);
    expect(entries[0]?.connectionId).toBe('c-500');
    expect(entries.some((entry) => entry.connectionId === 'c-0')).toBe(false);
  });
});
