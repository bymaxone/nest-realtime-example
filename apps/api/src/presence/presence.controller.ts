/**
 * @fileoverview Tenant presence roster endpoint (own-tenant only).
 * @layer controller
 *
 * `GET /presence/:tenantId` returns the online users of a tenant for the UI's
 * presence roster. It is anti-IDOR by the same rule as the tenant emit: a caller
 * may only read their own tenant's roster, so a session can never enumerate who is
 * online in another tenant. Presence is truthful across instances because the
 * storage is shared, so a user connected on any instance appears here.
 */

import { Controller, ForbiddenException, Get, Param, UseGuards } from '@nestjs/common';

import { SessionTraitsParam } from '../auth/session-traits.decorator';
import { SessionGuard } from '../auth/session.guard';
import type { SessionTraits } from '../auth/session.types';

import { PresenceService } from './presence.service';

/** The presence roster response for a single tenant. */
interface PresenceResponse {
  readonly tenantId: string;
  readonly online: readonly string[];
}

/** Serves the tenant presence roster under `/presence`. */
@Controller('presence')
@UseGuards(SessionGuard)
export class PresenceController {
  /**
   * Build the presence controller.
   *
   * @param presence - The presence read service.
   */
  constructor(private readonly presence: PresenceService) {}

  /**
   * Return the online users of the caller's own tenant.
   *
   * @param tenantId - The tenant whose roster is requested.
   * @param traits - The guard-resolved caller traits.
   * @returns The tenant id and its online user ids.
   * @throws ForbiddenException when the tenant is not the caller's own.
   */
  @Get(':tenantId')
  async roster(
    @Param('tenantId') tenantId: string,
    @SessionTraitsParam() traits: SessionTraits,
  ): Promise<PresenceResponse> {
    if (tenantId !== traits.tenantId) {
      throw new ForbiddenException('cannot read another tenant presence');
    }
    return { tenantId, online: await this.presence.listOnlineByTenant(tenantId) };
  }
}
