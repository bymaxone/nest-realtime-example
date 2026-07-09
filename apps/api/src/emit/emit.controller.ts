/**
 * @fileoverview Emit console endpoints (user / tenant / room / broadcast).
 * @layer controller
 *
 * Thin controllers: they validate the body with Zod, then delegate to
 * {@link EmitService}. Every endpoint requires an authenticated session.
 */

import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';

import { AdminGuard } from '../auth/admin.guard';
import { SessionTraitsParam } from '../auth/session-traits.decorator';
import { SessionGuard } from '../auth/session.guard';
import type { SessionTraits } from '../auth/session.types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

import { emitSchema, type EmitDto } from './dto/emit.dto';
import { EmitService } from './emit.service';

/** Acknowledgement returned by every emit endpoint. */
interface EmitAck {
  readonly accepted: true;
}

/** Pipe instance validating every emit body. */
const emitBody = new ZodValidationPipe(emitSchema);

/** Serves the authenticated emit console under `/emit`. */
@Controller('emit')
@UseGuards(SessionGuard)
export class EmitController {
  /**
   * Build the emit controller.
   *
   * @param emit - The emit console service.
   */
  constructor(private readonly emit: EmitService) {}

  /**
   * Emit to a single user's connections.
   *
   * @param userId - Target user id from the path.
   * @param body - The validated emit body.
   * @returns An acceptance acknowledgement.
   */
  @Post('user/:userId')
  async emitToUser(
    @Param('userId') userId: string,
    @Body(emitBody) body: EmitDto,
  ): Promise<EmitAck> {
    await this.emit.emitToUser(userId, body.event, body.data);
    return { accepted: true };
  }

  /**
   * Emit to every connection in the caller's own tenant.
   *
   * @param tenantId - Target tenant id from the path.
   * @param body - The validated emit body.
   * @param traits - The guard-resolved caller traits.
   * @returns An acceptance acknowledgement.
   */
  @Post('tenant/:tenantId')
  async emitToTenant(
    @Param('tenantId') tenantId: string,
    @Body(emitBody) body: EmitDto,
    @SessionTraitsParam() traits: SessionTraits,
  ): Promise<EmitAck> {
    await this.emit.emitToTenant(traits.tenantId, tenantId, body.event, body.data);
    return { accepted: true };
  }

  /**
   * Emit to every connection in a room.
   *
   * @param roomId - Target room id from the path.
   * @param body - The validated emit body.
   * @returns An acceptance acknowledgement.
   */
  @Post('room/:roomId')
  async emitToRoom(
    @Param('roomId') roomId: string,
    @Body(emitBody) body: EmitDto,
  ): Promise<EmitAck> {
    await this.emit.emitToRoom(roomId, body.event, body.data);
    return { accepted: true };
  }

  /**
   * Broadcast to every connected client (admin only).
   *
   * Broadcast crosses every tenant, so it is restricted to admin sessions.
   *
   * @param body - The validated emit body.
   * @returns An acceptance acknowledgement.
   */
  @Post('broadcast')
  @UseGuards(AdminGuard)
  async broadcast(@Body(emitBody) body: EmitDto): Promise<EmitAck> {
    await this.emit.broadcast(body.event, body.data);
    return { accepted: true };
  }
}
