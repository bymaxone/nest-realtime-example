/**
 * @fileoverview Endpoint that mints a short-lived WebSocket bearer token.
 * @layer controller
 *
 * `POST /auth/ws-token` requires a valid session cookie and returns a 10-minute
 * bearer bound to the caller's client-safe traits, for use as the Socket.IO
 * `handshake.auth.token` when the WebSocket profile is enabled.
 */

import { Controller, Post, UseGuards } from '@nestjs/common';

import { SessionTraitsParam } from './session-traits.decorator';
import { SessionGuard } from './session.guard';
import type { SessionTraits } from './session.types';
import { type WsTokenGrant, WsTokenService } from './ws-token.service';

/** Serves the WebSocket bearer mint endpoint under `/auth`. */
@Controller('auth')
export class WsTokenController {
  /**
   * Build the ws-token controller.
   *
   * @param wsTokens - The bearer token service.
   */
  constructor(private readonly wsTokens: WsTokenService) {}

  /**
   * Mint a WebSocket bearer for the authenticated caller.
   *
   * @param traits - The guard-resolved client-safe traits.
   * @returns The signed token and its absolute expiry.
   */
  @Post('ws-token')
  @UseGuards(SessionGuard)
  mint(@SessionTraitsParam() traits: SessionTraits): WsTokenGrant {
    return this.wsTokens.mint(traits);
  }
}
