/**
 * @fileoverview Signs and verifies the demo session token with an HMAC.
 * @layer auth
 *
 * The token is `base64url(payload).base64url(hmac)`, where the HMAC-SHA256 is
 * taken over the encoded payload using the secret sourced only from
 * `SESSION_SECRET`. Verification recomputes the HMAC and compares it in constant
 * time (`timingSafeEqual`) so a forged signature cannot be discovered by timing.
 * The secret and the raw token value are never logged or returned.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';

import { APP_CONFIG } from '../config/config.tokens';
import type { AppConfig } from '../config/env.loader';

import { SESSION_TTL_SECONDS } from './auth.constants';
import type { DemoUser } from './users.seed';

/** Decoded claims carried by a signed session token. */
export interface SessionPayload {
  /** Subject: the authenticated user id. */
  readonly sub: string;
  /** Tenant id the user belongs to. */
  readonly tid: string;
  /** Roles granted to the user. */
  readonly roles: readonly string[];
  /** Expiry as an epoch-second timestamp. */
  readonly exp: number;
}

/** Runtime schema guarding a decoded payload before it is trusted. */
const payloadSchema = z.object({
  sub: z.string().min(1),
  tid: z.string().min(1),
  roles: z.array(z.string()),
  exp: z.number().int().positive(),
});

/** Number of dot-separated segments in a well-formed token. */
const TOKEN_SEGMENTS = 2;

/** Milliseconds per second, for epoch conversions. */
const MS_PER_SECOND = 1000;

/** Issues and verifies HMAC-signed demo session tokens. */
@Injectable()
export class SessionService {
  private readonly secret: string;

  /**
   * Build the session service.
   *
   * @param config - The frozen application config providing `SESSION_SECRET`.
   */
  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.secret = config.sessionSecret;
  }

  /**
   * Issue a signed token for a demo user with a fresh expiry.
   *
   * @param user - The authenticated demo user.
   * @param nowSeconds - Current epoch seconds (injectable for deterministic tests).
   * @returns The signed session token.
   */
  issue(user: DemoUser, nowSeconds: number = Math.floor(Date.now() / MS_PER_SECOND)): string {
    return this.sign({
      sub: user.id,
      tid: user.tenantId,
      roles: user.roles,
      exp: nowSeconds + SESSION_TTL_SECONDS,
    });
  }

  /**
   * Sign a payload into a `base64url(payload).base64url(hmac)` token.
   *
   * @param payload - The claims to encode and authenticate.
   * @returns The signed token.
   */
  sign(payload: SessionPayload): string {
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${encodedPayload}.${this.computeSignature(encodedPayload)}`;
  }

  /**
   * Verify a token's signature and expiry and return its claims.
   *
   * @param token - The raw session token from the cookie.
   * @param nowSeconds - Current epoch seconds (injectable for deterministic tests).
   * @returns The decoded {@link SessionPayload}, or `null` when invalid or expired.
   */
  verify(
    token: string,
    nowSeconds: number = Math.floor(Date.now() / MS_PER_SECOND),
  ): SessionPayload | null {
    const segments = token.split('.');
    if (segments.length !== TOKEN_SEGMENTS) return null;
    const [encodedPayload, providedSignature] = segments;
    if (!encodedPayload || !providedSignature) return null;
    if (!this.signatureMatches(encodedPayload, providedSignature)) return null;
    const payload = this.decodePayload(encodedPayload);
    if (!payload || payload.exp <= nowSeconds) return null;
    return payload;
  }

  /** Compute the base64url HMAC-SHA256 of the encoded payload. */
  private computeSignature(encodedPayload: string): string {
    return createHmac('sha256', this.secret).update(encodedPayload).digest('base64url');
  }

  /** Constant-time compare of the provided signature against the expected one. */
  private signatureMatches(encodedPayload: string, providedSignature: string): boolean {
    const expected = Buffer.from(this.computeSignature(encodedPayload), 'base64url');
    const provided = Buffer.from(providedSignature, 'base64url');
    if (expected.length !== provided.length) return false;
    return timingSafeEqual(expected, provided);
  }

  /** Decode and validate the payload segment, returning null on any fault. */
  private decodePayload(encodedPayload: string): SessionPayload | null {
    try {
      const json: unknown = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
      const result = payloadSchema.safeParse(json);
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  }
}
