/**
 * @fileoverview Root application module composing the feature modules.
 * @layer module
 *
 * Imports the global config module first so every feature can inject the frozen
 * {@link AppConfig}, then the liveness endpoint. Realtime wiring and the demo
 * feature modules are added as the SSE profile is built out.
 */

import { Module } from '@nestjs/common';

import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';

/** Wires configuration and the liveness endpoint. */
@Module({
  imports: [ConfigModule, HealthModule],
})
export class AppModule {}
