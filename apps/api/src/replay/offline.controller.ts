/**
 * @fileoverview Offline lab endpoints: enqueue for an offline user, peek, acknowledge.
 * @layer controller
 *
 * `emit` and `peek` target an arbitrary user, so they are admin-only. `ack`
 * purges the caller's own queue, so it needs only a valid session.
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

import { type OfflineAckDto, offlineAckSchema } from './dto/offline-ack.dto';
import { type OfflineEmitDto, offlineEmitSchema } from './dto/offline-emit.dto';
import type { OfflineQueuedView } from './offline-view';
import { OfflineService } from './offline.service';

/** Acknowledgement for a completed offline emit. */
interface OfflineEmitAck {
  readonly emitted: number;
}

/** A user's queued events. */
interface OfflinePeekResponse {
  readonly userId: string;
  readonly events: readonly OfflineQueuedView[];
}

/** Acknowledgement for a completed purge. */
interface OfflineAckResponse {
  readonly acknowledged: true;
}

/** Pipe validating the offline emit request body. */
const offlineEmitBody = new ZodValidationPipe(offlineEmitSchema);

/** Serves the offline lab under `/labs/offline`. */
@Controller('labs/offline')
export class OfflineController {
  /**
   * Build the offline lab controller.
   *
   * @param offline - The offline lab service.
   */
  constructor(private readonly offline: OfflineService) {}

  /**
   * Enqueue a numbered burst for a disconnected user (admin only).
   *
   * @param body - The validated offline emit body.
   * @returns The number of events enqueued.
   */
  @Post('emit')
  @UseGuards(SessionGuard, AdminGuard)
  async emit(@Body(offlineEmitBody) body: OfflineEmitDto): Promise<OfflineEmitAck> {
    return { emitted: await this.offline.emit(body.userId, body.count) };
  }

  /**
   * List a user's queued events (admin only).
   *
   * @param userId - The user whose queue is inspected.
   * @returns The user id and its queued events.
   * @throws BadRequestException when the `userId` query parameter is missing.
   */
  @Get('peek')
  @UseGuards(SessionGuard, AdminGuard)
  async peek(@Query('userId') userId?: string): Promise<OfflinePeekResponse> {
    if (userId === undefined || userId.length === 0) {
      throw new BadRequestException('userId query parameter is required');
    }
    return { userId, events: await this.offline.peek(userId) };
  }

  /**
   * Purge the caller's own queue up to a delivery watermark.
   *
   * @param body - The validated acknowledge body.
   * @param traits - The guard-resolved caller traits.
   * @returns The purge acknowledgement.
   */
  @Post('ack')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard)
  async ack(
    @Body(new ZodValidationPipe(offlineAckSchema)) body: OfflineAckDto,
    @SessionTraitsParam() traits: SessionTraits,
  ): Promise<OfflineAckResponse> {
    await this.offline.acknowledge(traits.userId, body.upToId);
    return { acknowledged: true };
  }
}
