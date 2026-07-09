/**
 * @fileoverview Demo login, logout and identity endpoints.
 * @layer controller
 *
 * Login issues an HttpOnly, SameSite=Lax session cookie signed with the HMAC
 * secret; logout clears it; `/me` echoes the guard-resolved traits. The cookie is
 * marked `Secure` whenever the configured web origin is HTTPS. The raw token
 * value is never returned in a response body.
 */

import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { CookieOptions, Response } from 'express';

import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { APP_CONFIG } from '../config/config.tokens';
import type { AppConfig } from '../config/env.loader';

import { SESSION_COOKIE_NAME, SESSION_TTL_MS } from './auth.constants';
import { loginSchema, type LoginDto } from './dto/login.dto';
import { SessionTraitsParam } from './session-traits.decorator';
import { SessionGuard } from './session.guard';
import { SessionService } from './session.service';
import type { SessionTraits } from './session.types';
import { findDemoUser } from './users.seed';

/** Confirmation returned by logout. */
interface LogoutResponse {
  readonly ok: true;
}

/** Serves the demo authentication endpoints under `/auth`. */
@Controller('auth')
export class AuthController {
  private readonly isSecureCookie: boolean;

  /**
   * Build the auth controller.
   *
   * @param sessions - Issues and verifies session tokens.
   * @param config - The frozen config used to decide the cookie `Secure` flag.
   */
  constructor(
    private readonly sessions: SessionService,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.isSecureCookie = config.webOrigin.startsWith('https://');
  }

  /**
   * Log in a demo user and set the signed session cookie.
   *
   * @param body - The validated login body.
   * @param res - The passthrough response used to set the cookie.
   * @returns The authenticated client-safe traits.
   * @throws UnauthorizedException when the username is not a known demo user.
   */
  @Post('login')
  login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): SessionTraits {
    const user = findDemoUser(body.username);
    if (!user) throw new UnauthorizedException('unknown demo user');
    const token = this.sessions.issue(user);
    res.cookie(SESSION_COOKIE_NAME, token, this.cookieOptions(SESSION_TTL_MS));
    return { userId: user.id, tenantId: user.tenantId, roles: user.roles };
  }

  /**
   * Clear the session cookie.
   *
   * @param res - The passthrough response used to clear the cookie.
   * @returns A confirmation object.
   */
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response): LogoutResponse {
    res.clearCookie(SESSION_COOKIE_NAME, this.cookieOptions());
    return { ok: true };
  }

  /**
   * Return the traits of the currently authenticated session.
   *
   * @param traits - The guard-resolved client-safe traits.
   * @returns The current session traits.
   */
  @Get('me')
  @UseGuards(SessionGuard)
  me(@SessionTraitsParam() traits: SessionTraits): SessionTraits {
    return traits;
  }

  /** Build the cookie attributes shared by set and clear. */
  private cookieOptions(maxAge?: number): CookieOptions {
    const base: CookieOptions = {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isSecureCookie,
      path: '/',
    };
    return maxAge === undefined ? base : { ...base, maxAge };
  }
}
