/**
 * @fileoverview Root application module composing the feature modules.
 * @layer module
 *
 * Imports the global config module first so every feature can inject the frozen
 * {@link AppConfig}, then the liveness endpoint and demo auth. Realtime wiring and
 * the remaining feature modules are added as the SSE profile is built out.
 */

import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';

/** Wires configuration, the liveness endpoint and demo auth. */
@Module({
  imports: [ConfigModule, HealthModule, AuthModule],
})
export class AppModule {}
