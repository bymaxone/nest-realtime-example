/**
 * Unit tests for AuditController.
 *
 * Layer: unit.
 * Goal: the feed wraps entries with the service identity and validates the kind.
 * Mocks: a real AuditService seeded with entries.
 */

import { BadRequestException } from '@nestjs/common';

import { APP_SERVICE_NAME, APP_VERSION } from '../../src/app.constants';
import { AuditController } from '../../src/audit/audit.controller';
import { AuditService } from '../../src/audit/audit.service';
import { buildTestConfig } from '../support/config.fixture';

const META = {
  connectionId: 'c-1',
  userId: 'ana@acme',
  tenantId: 'acme',
  transport: 'sse' as const,
  ip: '127.0.0.1',
  userAgent: 'jest',
  connectedAt: new Date(),
};

function buildController(): { controller: AuditController; audit: AuditService } {
  const audit = new AuditService(buildTestConfig());
  audit.onConnect(META);
  audit.onError({ connectionId: 'c-2', error: new Error('x'), transport: 'sse' });
  return { controller: new AuditController(audit), audit };
}

describe('AuditController', () => {
  /**
   * Feed envelope.
   *
   * The feed must surface the service name and version alongside the newest-first
   * entries (spec §7 row 7).
   */
  it('returns the service identity and entries', () => {
    const { controller } = buildController();

    const response = controller.feed();

    expect(response.service).toEqual({ name: APP_SERVICE_NAME, version: APP_VERSION });
    expect(response.entries.map((entry) => entry.kind)).toEqual(['error', 'connect']);
  });

  /**
   * Kind filter.
   *
   * A valid kind must narrow the entries to that kind.
   */
  it('filters entries by a valid kind', () => {
    const { controller } = buildController();

    expect(controller.feed('connect').entries.map((entry) => entry.kind)).toEqual(['connect']);
  });

  /**
   * Invalid kind.
   *
   * An unknown kind must be rejected with a 400 rather than silently ignored.
   */
  it('rejects an invalid kind', () => {
    const { controller } = buildController();

    expect(() => controller.feed('nonsense')).toThrow(BadRequestException);
  });
});
