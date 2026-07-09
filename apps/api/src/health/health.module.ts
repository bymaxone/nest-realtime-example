/**
 * @fileoverview Module wiring the liveness endpoint.
 * @layer module
 */

import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';

/** Registers the unauthenticated liveness controller. */
@Module({ controllers: [HealthController] })
export class HealthModule {}
