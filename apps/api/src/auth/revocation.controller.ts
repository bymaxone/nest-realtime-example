/**
 * @fileoverview Admin endpoints that manage the session revocation set.
 * @layer controller
 *
 * `POST /auth/revoke/:userId` marks a user revoked and `DELETE` clears it. Both
 * require an admin session, because revoking another principal's sessions is a
 * privileged action. Revocation drives the reauth lab (the next reauth cycle
 * closes the connection) and the kill switch; the marker is stored in Redis so it
 * is visible across every instance.
 */

import { Controller, Delete, Inject, Param, Post, UseGuards } from '@nestjs/common';

import { AdminGuard } from './admin.guard';
import { REVOCATION_STORE } from './auth.tokens';
import type { IRevocationStore } from './revocation.store';
import { SessionGuard } from './session.guard';

/** The acknowledgement returned by a revocation change. */
interface RevocationAck {
  readonly userId: string;
  readonly revoked: boolean;
}

/** Serves the admin-only revocation endpoints under `/auth/revoke`. */
@Controller('auth/revoke')
@UseGuards(SessionGuard, AdminGuard)
export class RevocationController {
  /**
   * Build the revocation controller.
   *
   * @param revocations - The Redis-backed revocation store.
   */
  constructor(@Inject(REVOCATION_STORE) private readonly revocations: IRevocationStore) {}

  /**
   * Revoke every live session of a user.
   *
   * @param userId - The user to revoke.
   * @returns The revoked acknowledgement.
   */
  @Post(':userId')
  async revoke(@Param('userId') userId: string): Promise<RevocationAck> {
    await this.revocations.revoke(userId);
    return { userId, revoked: true };
  }

  /**
   * Clear a user's revocation marker.
   *
   * @param userId - The user to restore.
   * @returns The restored acknowledgement.
   */
  @Delete(':userId')
  async unrevoke(@Param('userId') userId: string): Promise<RevocationAck> {
    await this.revocations.unrevoke(userId);
    return { userId, revoked: false };
  }
}
