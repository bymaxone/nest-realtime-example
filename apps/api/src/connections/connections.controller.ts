/**
 * @fileoverview Connection introspection and kill-switch endpoints.
 * @layer controller
 *
 * `GET /connections` is an operator view of every active connection on the
 * instance, so it is admin-only (it exposes other principals' metadata).
 * `POST /connections/:id/disconnect` is the per-user kill switch: the service
 * enforces that the caller owns the target connection, so it needs only a valid
 * session (a user logging out one of their own devices).
 */

import type { PublicConnectionMeta } from '@bymax-one/nest-realtime';
import { Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';

import { APP_SERVICE_NAME } from '../app.constants';
import { AdminGuard } from '../auth/admin.guard';
import { SessionTraitsParam } from '../auth/session-traits.decorator';
import { SessionGuard } from '../auth/session.guard';
import type { SessionTraits } from '../auth/session.types';

import { ConnectionsService } from './connections.service';

/** The connection listing response, tagged with the reporting instance. */
interface ConnectionsResponse {
  readonly instance: string;
  readonly connections: readonly PublicConnectionMeta[];
}

/** Acknowledgement returned by the kill switch. */
interface DisconnectAck {
  readonly disconnected: true;
}

/** Serves connection introspection and the kill switch under `/connections`. */
@Controller('connections')
export class ConnectionsController {
  /**
   * Build the connections controller.
   *
   * @param connections - The connection introspection and kill-switch service.
   */
  constructor(private readonly connections: ConnectionsService) {}

  /**
   * List every active connection on this instance (admin only).
   *
   * @returns The instance name and its active connections.
   */
  @Get()
  @UseGuards(SessionGuard, AdminGuard)
  list(): ConnectionsResponse {
    return { instance: APP_SERVICE_NAME, connections: this.connections.list() };
  }

  /**
   * Force-disconnect one of the caller's own connections.
   *
   * @param id - The connection id to close.
   * @param traits - The guard-resolved caller traits.
   * @returns The disconnect acknowledgement.
   */
  @Post(':id/disconnect')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard)
  async disconnect(
    @Param('id') id: string,
    @SessionTraitsParam() traits: SessionTraits,
  ): Promise<DisconnectAck> {
    await this.connections.disconnectOwned(id, traits.userId);
    return { disconnected: true };
  }
}
