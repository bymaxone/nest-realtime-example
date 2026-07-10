/**
 * @fileoverview Replay lab endpoints: burst, drop, and the recovery timeline.
 * @layer controller
 *
 * `emit-burst` and `drop` act only on the caller's own user, so they need a valid
 * session. `timeline` reads an arbitrary user's emission record and queue, so it
 * is admin-only, mirroring the eviction timeline.
 */

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { AdminGuard } from '../auth/admin.guard';
import { SessionTraitsParam } from '../auth/session-traits.decorator';
import { SessionGuard } from '../auth/session.guard';
import type { SessionTraits } from '../auth/session.types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

import { type BurstDto, burstSchema } from './dto/burst.dto';
import { type ReplayTimelineView, ReplayService } from './replay.service';

/** Acknowledgement for a completed burst. */
interface BurstAck {
  readonly emitted: number;
}

/** Acknowledgement for a completed drop. */
interface DropAck {
  readonly dropped: number;
}

/** Pipe validating the burst request body. */
const burstBody = new ZodValidationPipe(burstSchema);

/** Serves the replay lab under `/labs/replay`. */
@Controller('labs/replay')
export class ReplayController {
  /**
   * Build the replay lab controller.
   *
   * @param replay - The replay lab service.
   */
  constructor(private readonly replay: ReplayService) {}

  /**
   * Emit a numbered burst to the caller's own user.
   *
   * @param body - The validated burst body.
   * @param traits - The guard-resolved caller traits.
   * @returns The number of events emitted.
   */
  @Post('emit-burst')
  @UseGuards(SessionGuard)
  async emitBurst(
    @Body(burstBody) body: BurstDto,
    @SessionTraitsParam() traits: SessionTraits,
  ): Promise<BurstAck> {
    return { emitted: await this.replay.burst(traits.userId, body.count) };
  }

  /**
   * Force-close every stream the caller owns so the client reconnects.
   *
   * @param traits - The guard-resolved caller traits.
   * @returns The number of streams closed.
   */
  @Post('drop')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard)
  async drop(@SessionTraitsParam() traits: SessionTraits): Promise<DropAck> {
    return { dropped: await this.replay.drop(traits.userId) };
  }

  /**
   * Return a user's recovery timeline (admin only).
   *
   * @param userId - The user whose timeline is requested.
   * @returns The emissions plus the retained, evicted, and queued ranges.
   * @throws BadRequestException when the `userId` query parameter is missing.
   */
  @Get('timeline')
  @UseGuards(SessionGuard, AdminGuard)
  timeline(@Query('userId') userId?: string): Promise<ReplayTimelineView> {
    if (userId === undefined || userId.length === 0) {
      throw new BadRequestException('userId query parameter is required');
    }
    return this.replay.timelineFor(userId);
  }
}
