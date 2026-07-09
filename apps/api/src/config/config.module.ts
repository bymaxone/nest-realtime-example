/**
 * @fileoverview Global NestJS module exposing the frozen application config.
 * @layer config
 *
 * The module runs the environment loader exactly once at startup and shares the
 * resulting frozen {@link AppConfig} under the {@link APP_CONFIG} token. It is
 * global so feature modules inject the configuration without importing this
 * module explicitly.
 */

import { Global, Module } from '@nestjs/common';

import { APP_CONFIG } from './config.tokens';
import { loadEnv } from './env.loader';

/**
 * Provide the frozen application configuration application-wide. Consumers inject
 * it with `@Inject(APP_CONFIG) private readonly config: AppConfig`.
 */
@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: loadEnv }],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
