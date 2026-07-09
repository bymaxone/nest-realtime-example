/**
 * @fileoverview Process bootstrap and testable application factory.
 * @layer bootstrap
 *
 * `createApp` is the seam end-to-end tests drive: it builds the Nest application,
 * applies the config-driven CORS policy (the SSE endpoint is a plain HTTP GET, so
 * its cross-origin access is controlled here at the app level, not in the library
 * options), and mounts every route under the `api` prefix so the library's SSE
 * controller is served at the configured `/api/events`. The liveness probe is
 * excluded from the prefix so infra checks hit a stable `/health`.
 */

import { type INestApplication, RequestMethod } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { APP_CONFIG } from './config/config.tokens';
import type { AppConfig } from './config/env.loader';

/** Global route prefix that realizes the configured `/api/events` SSE endpoint. */
const GLOBAL_PREFIX = 'api';

/**
 * Build the fully configured Nest application without listening.
 *
 * @returns The initialized application, ready for `listen` or in-memory testing.
 */
export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get<AppConfig>(APP_CONFIG);
  app.enableCors({ origin: config.webOrigin, credentials: true });
  app.setGlobalPrefix(GLOBAL_PREFIX, {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  app.enableShutdownHooks();
  return app;
}

/** Boot the application and listen on the configured port. */
async function bootstrap(): Promise<void> {
  const app = await createApp();
  const config = app.get<AppConfig>(APP_CONFIG);
  await app.listen(config.port);
}

// Start the server only when executed directly, never when imported by a test.
if (require.main === module) {
  void bootstrap();
}
