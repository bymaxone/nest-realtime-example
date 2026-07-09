/**
 * @fileoverview Liveness endpoint exposing instance and transport metadata.
 * @layer controller
 *
 * The health payload names the running instance and the active transport so the
 * cluster labs and the compose/CI liveness probes can tell instances apart. It
 * reads only the frozen application config, never the process environment.
 */

import type { TransportMode } from '@bymax-one/nest-realtime/shared';
import { Controller, Get, Inject } from '@nestjs/common';

import { APP_VERSION } from '../app.constants';
import { APP_CONFIG } from '../config/config.tokens';
import type { AppConfig } from '../config/env.loader';

/** Shape returned by the liveness endpoint. */
export interface HealthStatus {
  readonly status: 'ok';
  readonly instance: string;
  readonly transport: TransportMode;
  readonly version: string;
}

/** Serves the unauthenticated liveness probe at `GET /health`. */
@Controller('health')
export class HealthController {
  /**
   * Build the health controller.
   *
   * @param config - The frozen application configuration.
   */
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  /**
   * Report liveness with the instance name, active transport and version.
   *
   * @returns The current {@link HealthStatus}.
   */
  @Get()
  check(): HealthStatus {
    return {
      status: 'ok',
      instance: this.config.instanceName,
      transport: this.config.realtime.transport,
      version: APP_VERSION,
    };
  }
}
