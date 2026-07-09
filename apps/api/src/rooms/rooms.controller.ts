/**
 * @fileoverview Resource-room membership endpoints.
 * @layer controller
 *
 * `POST /rooms/join` and `/leave` operate on the caller's own connection (the
 * `connectionId` it learned from `connection:established`) and compose the room
 * id from a resource type + id, so a raw prefixed room id can never be supplied.
 * `GET /rooms/mine` lists the caller's rooms for one of their connections. Every
 * route requires a valid session; the service enforces per-connection ownership.
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { SessionTraitsParam } from '../auth/session-traits.decorator';
import { SessionGuard } from '../auth/session.guard';
import type { SessionTraits } from '../auth/session.types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

import { type RoomMembershipDto, roomMembershipSchema } from './dto/room-membership.dto';
import { RoomsService } from './rooms.service';

/** Acknowledgement returned by a join. */
interface JoinAck {
  readonly roomId: string;
  readonly joined: true;
}

/** Acknowledgement returned by a leave. */
interface LeaveAck {
  readonly roomId: string;
  readonly left: true;
}

/** The caller's rooms for one connection. */
interface MyRoomsResponse {
  readonly connectionId: string;
  readonly rooms: readonly string[];
}

/** Pipe validating every membership body. */
const membershipBody = new ZodValidationPipe(roomMembershipSchema);

/** Serves the resource-room membership endpoints under `/rooms`. */
@Controller('rooms')
@UseGuards(SessionGuard)
export class RoomsController {
  /**
   * Build the rooms controller.
   *
   * @param rooms - The rooms service.
   */
  constructor(private readonly rooms: RoomsService) {}

  /**
   * Join the caller's connection to a resource room.
   *
   * @param body - The validated membership body.
   * @param traits - The guard-resolved caller traits.
   * @returns The composed room id.
   */
  @Post('join')
  @HttpCode(HttpStatus.OK)
  async join(
    @Body(membershipBody) body: RoomMembershipDto,
    @SessionTraitsParam() traits: SessionTraits,
  ): Promise<JoinAck> {
    const roomId = await this.rooms.join(
      body.connectionId,
      body.resourceType,
      body.resourceId,
      traits.userId,
    );
    return { roomId, joined: true };
  }

  /**
   * Remove the caller's connection from a resource room.
   *
   * @param body - The validated membership body.
   * @param traits - The guard-resolved caller traits.
   * @returns The composed room id.
   */
  @Post('leave')
  @HttpCode(HttpStatus.OK)
  async leave(
    @Body(membershipBody) body: RoomMembershipDto,
    @SessionTraitsParam() traits: SessionTraits,
  ): Promise<LeaveAck> {
    const roomId = await this.rooms.leave(
      body.connectionId,
      body.resourceType,
      body.resourceId,
      traits.userId,
    );
    return { roomId, left: true };
  }

  /**
   * List the rooms one of the caller's connections belongs to.
   *
   * @param connectionId - The caller's connection id.
   * @param traits - The guard-resolved caller traits.
   * @returns The connection id and its rooms.
   */
  @Get('mine')
  mine(
    @Query('connectionId') connectionId: string,
    @SessionTraitsParam() traits: SessionTraits,
  ): MyRoomsResponse {
    return { connectionId, rooms: this.rooms.mine(connectionId, traits.userId) };
  }
}
