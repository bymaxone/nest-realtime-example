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
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AdminGuard } from '../auth/admin.guard';
import { SessionTraitsParam } from '../auth/session-traits.decorator';
import { SessionGuard } from '../auth/session.guard';
import type { SessionTraits } from '../auth/session.types';
import { APP_CONFIG } from '../config/config.tokens';
import type { AppConfig } from '../config/env.loader';

import { ConnectionsService } from './connections.service';
import {
  RealtimeIntrospectionService,
  type RealtimeWiringSnapshot,
} from './realtime-introspection.service';

/**
 * The connection listing response, tagged with the reporting instance.
 *
 * `instance` is the configured instance name, the same value `/health` reports,
 * so that under the cluster profile a reader can tell which of the two api
 * instances served the request.
 */
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
   * @param introspection - The resolved realtime wiring introspection service.
   * @param config - The frozen application configuration, read for the instance name.
   */
  constructor(
    private readonly connections: ConnectionsService,
    private readonly introspection: RealtimeIntrospectionService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * List every active connection on this instance (admin only).
   *
   * @returns The instance name and its active connections.
   */
  @Get()
  @UseGuards(SessionGuard, AdminGuard)
  list(): ConnectionsResponse {
    return { instance: this.config.instanceName, connections: this.connections.list() };
  }

  /**
   * Report the realtime wiring the library resolved at boot (admin only).
   *
   * Reads the library's exported Symbol DI tokens to prove the module resolved the
   * configuration and collaborators the example handed it; it exposes only scalar
   * options and provider class names, never a live principal's metadata.
   *
   * @returns The resolved realtime wiring snapshot.
   */
  @Get('introspection')
  @UseGuards(SessionGuard, AdminGuard)
  wiring(): RealtimeWiringSnapshot {
    return this.introspection.snapshot();
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
