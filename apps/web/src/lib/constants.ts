/**
 * @fileoverview Environment-derived base URLs and app-wide constants.
 * @layer lib
 *
 * `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` are read once here so every
 * other module imports a resolved constant instead of touching `process.env`
 * directly. The api mounts every route (except `/health`) under a global `api`
 * prefix (see `apps/api/src/main.ts`), so `API_BASE_URL` already includes it.
 */

/** Public browser-facing base URL of the api (no trailing slash). */
const API_ORIGIN = (process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001').replace(
  /\/$/u,
  '',
);

/** REST base URL, including the api's global `/api` prefix. */
export const API_BASE_URL = `${API_ORIGIN}/api`;

/** SSE endpoint URL the browser opens with `EventSource` (cookie or ticket auth). */
export const SSE_EVENTS_URL = `${API_BASE_URL}/events`;

/** WebSocket URL (already includes the configured namespace, e.g. `/live`). */
export const WS_URL = (process.env['NEXT_PUBLIC_WS_URL'] ?? 'ws://localhost:3001/live').replace(
  /\/$/u,
  '',
);

/** Brand wordmark shown in the shell topbar. */
export const APP_NAME = 'nest-realtime-example';
