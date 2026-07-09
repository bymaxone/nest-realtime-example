/**
 * @fileoverview Static application identity constants (service name and version).
 * @layer config
 *
 * The version mirrors `apps/api/package.json`. A unit test asserts the two stay
 * in sync, so `/health` and the realtime `service` metadata report the package's
 * real version without importing the manifest, which would fall outside the
 * TypeScript compiler `rootDir` and break the build.
 */

/** Human-readable service name surfaced in health output and audit metadata. */
export const APP_SERVICE_NAME = 'nest-realtime-example';

/** Semantic version reported by `/health` and the realtime `service` metadata. */
export const APP_VERSION = '0.1.0';
