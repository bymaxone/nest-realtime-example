/**
 * End-to-end route inventory: no HTTP endpoint escapes testing.
 *
 * Layer: e2e.
 * Goal: the set of routes the running app registers is exactly the set the
 *       manifest claims (no unclaimed route, no stale entry); every claiming spec
 *       file exists; every guarded route rejects an anonymous caller with 401; and
 *       every validated route rejects a malformed body with 400.
 * Mocks: none; a real Nest application introspected through its Express router.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Test } from 'supertest';

import { createApp } from '../../src/main';
import { login } from '../support/sse.fixture';

import { E2E_MANIFEST, type HttpMethod, type RouteContract } from './e2e-manifest';

/** An Express router layer: either a leaf route or a nested router. */
interface ExpressLayer {
  readonly route?: { readonly path: unknown; readonly methods: Record<string, boolean> };
  readonly name?: string;
  readonly handle?: { readonly stack?: readonly ExpressLayer[] };
}

/** The verbs the manifest models; other method keys (e.g. `_all`) are ignored. */
const KNOWN_METHODS: readonly HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

/** Key a route by `METHOD path` so the two sets can be compared directly. */
function key(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}

/** Walk an Express router stack, collecting every registered `METHOD path` key. */
function collectRoutes(stack: readonly ExpressLayer[] | undefined, into: Set<string>): void {
  for (const layer of stack ?? []) {
    if (layer.route && typeof layer.route.path === 'string') {
      for (const method of Object.keys(layer.route.methods)) {
        if (KNOWN_METHODS.includes(method.toUpperCase() as HttpMethod)) {
          into.add(key(method, layer.route.path));
        }
      }
    } else if (layer.name === 'router') {
      collectRoutes(layer.handle?.stack, into);
    }
  }
}

/** Read every registered route key from the app's Express instance. */
function registeredRoutes(app: INestApplication): Set<string> {
  const instance = app.getHttpAdapter().getInstance() as {
    router?: { stack: readonly ExpressLayer[] };
    _router?: { stack: readonly ExpressLayer[] };
  };
  const found = new Set<string>();
  collectRoutes((instance.router ?? instance._router)?.stack, found);
  return found;
}

/** Substitute a placeholder for every `:param` segment to form a probeable path. */
function probePath(path: string): string {
  return path.replace(/:[^/]+/gu, 'x');
}

/** Issue a request for the given method against the app's server. */
function send(app: INestApplication, method: HttpMethod, path: string): Test {
  const server = app.getHttpServer() as Parameters<typeof request>[0];
  const agent = request(server);
  const dispatch: Record<HttpMethod, (url: string) => Test> = {
    GET: (url) => agent.get(url),
    POST: (url) => agent.post(url),
    PUT: (url) => agent.put(url),
    PATCH: (url) => agent.patch(url),
    DELETE: (url) => agent.delete(url),
  };
  return dispatch[method](probePath(path));
}

describe('Route inventory (e2e)', () => {
  let app: INestApplication;
  let adminCookie: string;
  const guarded = E2E_MANIFEST.filter((entry) => entry.guarded && !entry.streaming);
  const validated = E2E_MANIFEST.filter((entry) => entry.validated);

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    adminCookie = await login(app, 'ana@acme');
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * Completeness in both directions.
   *
   * The registered set and the manifest set must be identical: a route added
   * without a manifest entry (unclaimed) or an entry whose route was removed
   * (stale) both fail here, so the inventory can never silently drift.
   */
  it('claims exactly the routes the app registers', () => {
    const registered = registeredRoutes(app);
    const claimed = new Set(E2E_MANIFEST.map((entry) => key(entry.method, entry.path)));
    const unclaimed = [...registered].filter((route) => !claimed.has(route)).sort();
    const stale = [...claimed].filter((route) => !registered.has(route)).sort();
    expect({ unclaimed, stale }).toEqual({ unclaimed: [], stale: [] });
  });

  /**
   * Every claim points at a real file.
   *
   * A manifest entry must name at least one existing spec file, so a coverage
   * claim can never reference a spec that was renamed or deleted.
   */
  it('references only spec files that exist on disk', () => {
    const missing = E2E_MANIFEST.flatMap((entry: RouteContract) =>
      entry.specs
        .filter((spec) => !existsSync(join(__dirname, spec)))
        .map((spec) => `${key(entry.method, entry.path)} -> ${spec}`),
    );
    expect(E2E_MANIFEST.every((entry) => entry.specs.length > 0)).toBe(true);
    expect(missing).toEqual([]);
  });

  /**
   * Guarded routes reject anonymous callers.
   *
   * A request with no session cookie must be refused by the guard (401) before any
   * handler or validation pipe runs, proving every guarded route is actually
   * protected rather than merely declared so in the manifest.
   */
  it.each(guarded)('refuses anonymous $method $path with 401', async ({ method, path }) => {
    await send(app, method, path).expect(401);
  });

  /**
   * Validated routes reject a malformed body.
   *
   * With a valid admin session but an empty body, the `ZodValidationPipe` must
   * reject the request with 400, proving every validated route enforces its schema
   * rather than merely declaring so in the manifest.
   */
  it.each(validated)(
    'rejects a malformed body on $method $path with 400',
    async ({ method, path }) => {
      await send(app, method, path).set('Cookie', adminCookie).send({}).expect(400);
    },
  );
});
