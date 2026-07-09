/**
 * @fileoverview Root application module composing the feature modules.
 * @layer module
 *
 * Imports the global config module first so every feature can inject the frozen
 * {@link AppConfig}, then the liveness endpoint and demo auth. Realtime wiring and
 * the remaining feature modules are added as the SSE profile is built out.
 */

import { Module } from '@nestjs/common';

import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from './config/config.module';
import { ConnectionsModule } from './connections/connections.module';
import { DomainModule } from './domain/domain.module';
import { EmitModule } from './emit/emit.module';
import { HealthModule } from './health/health.module';
import { RealtimeWiringModule } from './realtime/wiring.module';
import { RoomsModule } from './rooms/rooms.module';

/** Wires configuration, liveness, demo auth, realtime and the demo features. */
@Module({
  imports: [
    ConfigModule,
    HealthModule,
    AuthModule,
    RealtimeWiringModule,
    EmitModule,
    DomainModule,
    AuditModule,
    ConnectionsModule,
    RoomsModule,
  ],
})
export class AppModule {}
