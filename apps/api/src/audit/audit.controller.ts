/**
 * @fileoverview Audit feed endpoint.
 * @layer controller
 *
 * Returns the lifecycle audit entries newest-first, optionally filtered by kind,
 * wrapped with the service identity so the audit surface shows which service and
 * version produced them.
 */

import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';

import { APP_SERVICE_NAME, APP_VERSION } from '../app.constants';
import { SessionGuard } from '../auth/session.guard';

import { type AuditEntry, type AuditKind, AuditService, isAuditKind } from './audit.service';
import { type DecoratorStats, DecoratorHandlers } from './decorator-handlers';

/** The audit feed response: service identity plus the newest-first entries. */
interface AuditFeedResponse {
  readonly service: { readonly name: string; readonly version: string };
  readonly entries: readonly AuditEntry[];
}

/** Serves the authenticated audit feed under `/audit`. */
@Controller('audit')
@UseGuards(SessionGuard)
export class AuditController {
  /**
   * Build the audit controller.
   *
   * @param audit - The audit sink and feed.
   * @param decorators - The decorator-driven lifecycle counters.
   */
  constructor(
    private readonly audit: AuditService,
    private readonly decorators: DecoratorHandlers,
  ) {}

  /**
   * Return the audit feed, optionally filtered by `kind`.
   *
   * @param kind - Optional kind filter from the query string.
   * @returns The service identity and matching entries.
   * @throws BadRequestException when `kind` is present but not a valid kind.
   */
  @Get('feed')
  feed(@Query('kind') kind?: string): AuditFeedResponse {
    return {
      service: { name: APP_SERVICE_NAME, version: APP_VERSION },
      entries: this.audit.feed(this.parseKind(kind)),
    };
  }

  /**
   * Return the decorator-driven lifecycle counters.
   *
   * @returns The connect and disconnect counts bumped by the `@OnConnect` /
   *   `@OnDisconnect` handlers.
   */
  @Get('decorator-stats')
  decoratorStats(): DecoratorStats {
    return this.decorators.stats();
  }

  /** Validate and narrow the optional kind query parameter. */
  private parseKind(kind: string | undefined): AuditKind | undefined {
    if (kind === undefined) return undefined;
    if (!isAuditKind(kind)) throw new BadRequestException('invalid audit kind');
    return kind;
  }
}
