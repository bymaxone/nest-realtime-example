/**
 * @fileoverview Module wiring the liveness endpoint.
 * @layer module
 */

import { Module } from '@nestjs/common';

import { RealtimeInfraModule } from '../realtime/realtime-infra.module';

import { HealthController } from './health.controller';

/** Registers the unauthenticated liveness controller. */
@Module({ imports: [RealtimeInfraModule], controllers: [HealthController] })
export class HealthModule {}
