/**
 * @fileoverview Typed inventory of every registered HTTP route and its e2e claim.
 * @layer test-support
 *
 * This manifest is the contract the route-inventory suite enforces: every route
 * the running application registers must appear here exactly once, and every entry
 * must still be registered, so a route added without a test (or a test left behind
 * after a route is removed) fails the build. Each entry also declares whether the
 * route is authentication-guarded and whether its body is validated by a
 * `ZodValidationPipe`; the inventory suite drives those flags data-first, proving
 * every guarded route rejects an anonymous caller with 401 and every validated
 * route rejects a malformed body with 400. `specs` names the e2e files that
 * exercise the route's happy path; the inventory asserts each file exists on disk.
 */

/** The HTTP verbs the application registers. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** One registered route, its security posture and the e2e files that claim it. */
export interface RouteContract {
  readonly method: HttpMethod;
  /** The exact Express pattern including the global `/api` prefix (or `/health`). */
  readonly path: string;
  /** True when the route requires authentication (SessionGuard or the SSE authenticator). */
  readonly guarded: boolean;
  /** True when the request body is checked by a `ZodValidationPipe`. */
  readonly validated: boolean;
  /** True for long-lived streaming responses (SSE); excluded from synchronous probes. */
  readonly streaming: boolean;
  /** The e2e spec files (relative to this directory) that exercise the happy path. */
  readonly specs: readonly string[];
}

/**
 * Build a route contract, defaulting the boolean flags so each entry states only
 * what differs from a plain, public, non-streaming route.
 *
 * @param entry - The route method, path, claiming specs and any set flags.
 * @returns The fully defaulted {@link RouteContract}.
 */
function route(
  entry: Pick<RouteContract, 'method' | 'path' | 'specs'> & Partial<RouteContract>,
): RouteContract {
  return {
    guarded: false,
    validated: false,
    streaming: false,
    ...entry,
  };
}

/** Every HTTP route the application registers, paired with its e2e coverage. */
export const E2E_MANIFEST: readonly RouteContract[] = [
  route({ method: 'GET', path: '/health', specs: ['boot.e2e-spec.ts', 'both-boot.e2e-spec.ts'] }),
  route({
    method: 'GET',
    path: '/api/events',
    guarded: true,
    streaming: true,
    specs: ['sse-connect.e2e-spec.ts', 'ticket-auth.e2e-spec.ts', 'tenant-isolation.e2e-spec.ts'],
  }),
  route({
    method: 'POST',
    path: '/api/auth/login',
    validated: true,
    specs: ['auth-routes.e2e-spec.ts'],
  }),
  route({ method: 'POST', path: '/api/auth/logout', specs: ['auth-routes.e2e-spec.ts'] }),
  route({ method: 'GET', path: '/api/auth/me', guarded: true, specs: ['auth-routes.e2e-spec.ts'] }),
  route({
    method: 'POST',
    path: '/api/auth/ticket',
    guarded: true,
    specs: ['ticket-auth.e2e-spec.ts'],
  }),
  route({
    method: 'POST',
    path: '/api/auth/ws-token',
    guarded: true,
    specs: ['auth-routes.e2e-spec.ts'],
  }),
  route({
    method: 'POST',
    path: '/api/auth/revoke/:userId',
    guarded: true,
    specs: ['reauth.e2e-spec.ts', 'kill-switch.e2e-spec.ts'],
  }),
  route({
    method: 'DELETE',
    path: '/api/auth/revoke/:userId',
    guarded: true,
    specs: ['reauth.e2e-spec.ts', 'kill-switch.e2e-spec.ts'],
  }),
  route({
    method: 'GET',
    path: '/api/connections',
    guarded: true,
    specs: ['offline-drain.e2e-spec.ts', 'kill-switch.e2e-spec.ts'],
  }),
  route({
    method: 'POST',
    path: '/api/connections/:id/disconnect',
    guarded: true,
    specs: ['kill-switch.e2e-spec.ts'],
  }),
  route({
    method: 'GET',
    path: '/api/audit/feed',
    guarded: true,
    specs: ['audit.e2e-spec.ts', 'reauth.e2e-spec.ts'],
  }),
  route({
    method: 'GET',
    path: '/api/audit/decorator-stats',
    guarded: true,
    specs: ['audit.e2e-spec.ts'],
  }),
  route({
    method: 'GET',
    path: '/api/presence/:tenantId',
    guarded: true,
    specs: ['presence.e2e-spec.ts'],
  }),
  route({
    method: 'POST',
    path: '/api/emit/user/:userId',
    guarded: true,
    validated: true,
    specs: ['tenant-isolation.e2e-spec.ts', 'replay.e2e-spec.ts'],
  }),
  route({
    method: 'POST',
    path: '/api/emit/tenant/:tenantId',
    guarded: true,
    validated: true,
    specs: ['tenant-isolation.e2e-spec.ts', 'rooms.e2e-spec.ts'],
  }),
  route({
    method: 'POST',
    path: '/api/emit/room/:roomId',
    guarded: true,
    validated: true,
    specs: ['rooms.e2e-spec.ts', 'both-fanout.e2e-spec.ts'],
  }),
  route({
    method: 'POST',
    path: '/api/emit/broadcast',
    guarded: true,
    validated: true,
    specs: ['tenant-isolation.e2e-spec.ts'],
  }),
  route({
    method: 'POST',
    path: '/api/rooms/join',
    guarded: true,
    validated: true,
    specs: ['rooms.e2e-spec.ts'],
  }),
  route({
    method: 'POST',
    path: '/api/rooms/leave',
    guarded: true,
    validated: true,
    specs: ['rooms.e2e-spec.ts'],
  }),
  route({ method: 'GET', path: '/api/rooms/mine', guarded: true, specs: ['rooms.e2e-spec.ts'] }),
  route({
    method: 'POST',
    path: '/api/domain/orders/simulate',
    guarded: true,
    specs: ['domain.e2e-spec.ts'],
  }),
  route({
    method: 'POST',
    path: '/api/domain/deployments/simulate',
    guarded: true,
    specs: ['domain.e2e-spec.ts'],
  }),
  route({
    method: 'GET',
    path: '/api/labs/cluster/stats',
    guarded: true,
    specs: ['cluster-stats.e2e-spec.ts'],
  }),
  route({
    method: 'GET',
    path: '/api/labs/eviction/timeline',
    guarded: true,
    specs: ['eviction.e2e-spec.ts'],
  }),
  route({
    method: 'GET',
    path: '/api/labs/reauth/stats',
    guarded: true,
    specs: ['kill-switch.e2e-spec.ts'],
  }),
  route({
    method: 'GET',
    path: '/api/labs/replay/timeline',
    guarded: true,
    specs: ['replay.e2e-spec.ts', 'replay-gap.e2e-spec.ts'],
  }),
  route({
    method: 'POST',
    path: '/api/labs/replay/drop',
    guarded: true,
    specs: ['replay.e2e-spec.ts', 'replay-gap.e2e-spec.ts'],
  }),
  route({
    method: 'POST',
    path: '/api/labs/replay/emit-burst',
    guarded: true,
    validated: true,
    specs: ['replay.e2e-spec.ts', 'replay-gap.e2e-spec.ts'],
  }),
  route({
    method: 'GET',
    path: '/api/labs/offline/peek',
    guarded: true,
    specs: ['offline-drain.e2e-spec.ts'],
  }),
  route({
    method: 'POST',
    path: '/api/labs/offline/emit',
    guarded: true,
    validated: true,
    specs: ['offline-drain.e2e-spec.ts', 'replay-gap.e2e-spec.ts'],
  }),
  route({
    method: 'POST',
    path: '/api/labs/offline/ack',
    guarded: true,
    validated: true,
    specs: ['offline-drain.e2e-spec.ts'],
  }),
];
