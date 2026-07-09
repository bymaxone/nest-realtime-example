# Phase 02: sse-foundation

> **Status**: 🔄 In Progress · **Progress**: 1 / 6 tasks · **Last updated**: 2026-07-09
> **Source roadmap**: [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) §5 (Phase 02)
> **Source spec**: [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md) §9.2, §10, §11, §12.1, §12.2

## Context

Everything before this was scaffolding. This phase boots the SSE profile end to end: a NestJS app with demo cookie auth, the canonical `BymaxRealtimeModule.forRootAsync` wiring, an emit console, a domain simulator, two-tenant isolation, the audit feed, and the honest heartbeat lab. At the end, a browser (or the `eventsource` client) logs in, opens the stream, and watches real events flow. Matrix rows landed: 1, 2, 4, 7, 10, 19, 21, 22, 29, 30, 37, 52, 67, 68.

## Rules-of-phase

1. Realtime behavior comes only from the library; this repo implements authenticators, hooks and Redis storages, never transports.
2. The demo session cookie is HMAC-signed with `node:crypto`; no jsonwebtoken, no passport (lint-banned).
3. The wiring factory reads exclusively from `APP_CONFIG` (phase 01); no direct `process.env`.
4. `connection:established` must be asserted to carry client-safe traits only (no `metadata` leak).
5. The heartbeat is proven as a comment on the raw stream: no `id:`, never fires a listener.
6. Standard global conventions (plan §4).

## Reference docs

- Spec §9.2 (canonical wiring), §10.1-§10.4 (module map, authenticators, audit), §11.1 (endpoints), §12.1-§12.2 (scenarios).
- Library README (linked version): module options, `RealtimeService` API, reserved events.

## Task index

| ID  | Task                                                                       | Status | Priority | Size | Depends on |
| --- | -------------------------------------------------------------------------- | ------ | -------- | ---- | ---------- |
| 2.1 | Branch + NestJS app skeleton + /health + main.ts bootstrap                 | ✅     | P0       | M    | Phase 01   |
| 2.2 | Demo auth: users, login/logout, HMAC cookie, CookieSessionAuthenticator    | 📋     | P0       | M    | 2.1        |
| 2.3 | Canonical realtime wiring (forRootAsync, sse profile) + boot-failure specs | 📋     | P0       | L    | 2.2        |
| 2.4 | Emit console + domain simulator + two-tenant isolation E2E                 | 📋     | P0       | M    | 2.3        |
| 2.5 | Audit feed (config hooks) + heartbeat raw-capture lab                      | 📋     | P1       | M    | 2.3        |
| 2.6 | Phase close: audit, dashboards, PR + Copilot review                        | 📋     | P0       | S    | 2.1-2.5    |

## Tasks

### Task 2.1: NestJS app skeleton with health and bootstrap

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: Phase 01

#### Description

Replace the api stub with a real NestJS 11 application: `main.ts` (CORS from config, shutdown hooks), `AppModule` importing the config module, `GET /health` returning instance metadata (`INSTANCE_NAME` matters for the cluster labs later).

#### Acceptance criteria

- [x] Branch `feat/phase-02-sse-foundation` created with `git switch -c`.
- [x] `nest start` boots on `PORT` with CORS allowing `WEB_ORIGIN` (credentials true).
- [x] `GET /health` returns `{ status: 'ok', instance, transport, version }` from config.
- [x] `main.ts` split into a testable `createApp()` seam; e2e boot spec covers it.
- [x] Coverage stays 100% on implemented files.

#### Files to create / modify

- `apps/api/src/main.ts`, `app.module.ts`, `health/health.controller.ts`, `health/health.module.ts`
- `apps/api/test/e2e/boot.e2e-spec.ts`, `apps/api/jest.e2e.config.ts`

#### Agent prompt

```
You are a senior NestJS engineer working on nest-realtime-example.

PROJECT: nest-realtime-example, reference app for @bymax-one/nest-realtime. apps/api is a
NestJS 11 app; config comes from the frozen APP_CONFIG token (src/config, phase 01).

CURRENT PHASE: 02 (sse-foundation), Task 2.1 of 6 (FIRST).

PRECONDITIONS
- Phase 01 merged: config module, jest, redis compose, library linked.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §10.1 (module map) and §9.1 (PORT, INSTANCE_NAME, WEB_ORIGIN).
- apps/api/src/config/* (the token and shape you must consume).

TASK
Create the branch and the bootable app skeleton: main.ts with createApp() seam, AppModule,
health endpoint, e2e boot spec.

DELIVERABLES
1. `git switch -c feat/phase-02-sse-foundation` (NEVER git checkout -b).
2. src/main.ts: createApp(): NestFactory over AppModule, enableCors({ origin: config.webOrigin,
   credentials: true }), enableShutdownHooks; bootstrap() listens on config.port. Export
   createApp for tests.
3. health module: GET /health returning { status:'ok', instance: config.instanceName,
   transport: config.realtime.transport, version } (version from package.json import).
4. jest.e2e.config.ts (bounded workers, sequential) + test/e2e/boot.e2e-spec.ts: app boots,
   /health 200 with expected instance name.

Constraints:
- Standard repo constraints: strict TS no any/suppressions, functions <= 50 lines, files <= 800,
  @fileoverview + @layer headers, imperative JSDoc on exports, timeless comments, English only,
  no em dashes, sequential bounded tests, no .gitkeep.
- No process.env outside src/config.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- `pnpm --filter @nest-realtime-example/api test` green (unit) then
  `pnpm --filter @nest-realtime-example/api test:e2e` green (sequential, after unit).
- `curl localhost:3001/health` returns ok while `pnpm dev:api` runs.
- Commit `feat(api): app skeleton + health (2.1)`.

Completion Protocol: task status ✅ + checkboxes; Task index row; header Progress; Phase 02 row
in docs/DEVELOPMENT_PLAN.md §1; Completion log line; Conventional commit, no attribution.
```

### Task 2.2: Demo auth with HMAC cookie and the cookie authenticator

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 2.1

#### Description

Seeded demo users across two tenants (acme, globex), login/logout issuing an HttpOnly HMAC-signed session cookie via `node:crypto`, and `CookieSessionAuthenticator` implementing the library's `IConnectionAuthenticator` for Pattern A.

#### Acceptance criteria

- [ ] `POST /auth/login { username }` sets HttpOnly `session` cookie (HMAC-SHA256 over payload with `SESSION_SECRET`, exp claim); `POST /auth/logout` clears it.
- [ ] Seeded users: at least `ana@acme`, `bob@acme`, `gil@globex` with roles.
- [ ] `CookieSessionAuthenticator.authenticate(ctx)` verifies signature + expiry from `ctx.cookies`, returns `{ userId, tenantId, roles }` or null; `revalidate` checks a Redis revocation set (used by phase 03 labs; implemented now, exercised later).
- [ ] Tampered or expired cookies return null (unit-proven); values never logged.
- [ ] 100% coverage on the auth module.

#### Files to create / modify

- `apps/api/src/auth/` (module, controller, session.service.ts, users.seed.ts, cookie-session.authenticator.ts, dto/)

#### Agent prompt

```
You are a senior NestJS security-minded engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. Demo auth for the realtime reference app: HttpOnly HMAC-signed
session cookie (node:crypto only), consumed by the library through IConnectionAuthenticator.

CURRENT PHASE: 02, Task 2.2 of 6 (MIDDLE).

PRECONDITIONS
- Task 2.1 done (app boots). ioredis available; redis via compose.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §10.3 (authenticators) and §9.1 (SESSION_SECRET).
- Library README (linked version): IConnectionAuthenticator, ConnectionAuthContext,
  AuthenticationResult shapes.

TASK
Implement demo users, login/logout with the signed cookie, and CookieSessionAuthenticator
(with a Redis-revocation-aware revalidate).

DELIVERABLES
1. session.service.ts: sign(payload {sub, tid, roles, exp}) -> base64url(payload).hmac using
   createHmac('sha256', SESSION_SECRET); verify() with timingSafeEqual; 8h default exp.
2. auth.controller.ts: POST /auth/login (zod-validated username from the seed), sets HttpOnly,
   SameSite=Lax, Path=/ cookie; POST /auth/logout clears it; GET /auth/me returns traits.
3. users.seed.ts: frozen demo users for tenants 'acme' and 'globex' with roles.
4. cookie-session.authenticator.ts implementing IConnectionAuthenticator: authenticate(ctx)
   reads ctx.cookies['session'], verifies, maps to { userId, tenantId, roles }; returns null on
   any failure. revalidate(connectionId, originalAuth) returns false when
   `realtime:revoked:{userId}` exists in Redis (SETs managed in a later phase; implement the
   check now).
5. Unit specs: sign/verify roundtrip, tamper rejection, expiry rejection, authenticate mapping,
   revalidate against a mocked redis. Every it() carries a scenario comment.

Constraints:
- node:crypto only (jsonwebtoken/passport are lint-banned). Never log cookie or secret values.
- Standard repo constraints (strict TS, sizes, headers, JSDoc, timeless, English, no em dashes,
  sequential bounded tests, no .gitkeep).
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Unit suite green, auth module 100% covered.
- Manual: login via curl -c jar, GET /auth/me with -b jar returns traits.
- Commit `feat(api): demo cookie auth + authenticator (2.2)`.

Completion Protocol: standard steps.
```

### Task 2.3: Canonical realtime wiring and boot-failure specs

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: L
- **Depends on**: 2.2

#### Description

The centerpiece consumers will copy: `RealtimeWiringModule` with the options factory building `BymaxRealtimeModuleOptions` from config (transport `sse`, endpoint `/api/events`, heartbeat, replay buffer, max connections, CORS, `emitConnectionEvent`, tenantResolver, hooks placeholder, `InMemoryPubSub` default), registered through `forRootAsync` with `extraProviders`. Plus the negative boot specs and a sync `forRoot` unit.

#### Acceptance criteria

- [ ] `realtime/options.factory.ts` maps every §4.3 option from `APP_CONFIG`; fully typed, no casts.
- [ ] `BymaxRealtimeModule.forRootAsync({ imports, inject: [APP_CONFIG, ...], useFactory, extraProviders: [CookieSessionAuthenticator] })` wired in `AppModule`.
- [ ] SSE stream reachable at `/api/events` for a logged-in user (e2e with `eventsource` package: receives `connection:established` whose payload contains ONLY `{ connectionId, traits: { userId, tenantId, roles } }`, asserted no extra keys).
- [ ] Boot-failure unit specs: missing authenticator and malformed options reject boot (`REALTIME_NO_AUTHENTICATOR`, `REALTIME_INVALID_OPTIONS` observable per library behavior).
- [ ] A minimal sync `forRoot` unit proves the sync path compiles and boots in a testing module.
- [ ] Matrix rows 1, 2, 4, 7, 9(placeholder resolver), 19, 21, 29, 37, 67, 68 satisfied.

#### Files to create / modify

- `apps/api/src/realtime/` (wiring.module.ts, options.factory.ts, tokens.ts)
- `apps/api/test/e2e/sse-connect.e2e-spec.ts`, unit specs under `src/realtime/`

#### Agent prompt

```
You are a senior NestJS engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. This task writes THE canonical consumer wiring of
@bymax-one/nest-realtime that other backends will copy.

CURRENT PHASE: 02, Task 2.3 of 6 (MIDDLE, the centerpiece).

PRECONDITIONS
- Tasks 2.1-2.2 done (app boots; CookieSessionAuthenticator exists; APP_CONFIG frozen).

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §9.2 and §4.3.
- Library README (linked version): BymaxRealtimeModuleOptions, forRoot/forRootAsync,
  reserved events, error behaviors. The README of the lockfile version is the API authority;
  if a field differs from this repo's spec, follow the README and note it in the PR body.

TASK
Implement RealtimeWiringModule (options factory + forRootAsync with extraProviders), the SSE
connect e2e, the negative boot specs and the sync forRoot unit.

DELIVERABLES
1. options.factory.ts: buildRealtimeOptions(config, authenticator): BymaxRealtimeModuleOptions
   with transport from config (this phase boots 'sse'), service { name:'nest-realtime-example',
   version }, authenticator, tenantResolver: (auth) => auth.tenantId, sse { endpoint:
   config.realtime.sseEndpoint, heartbeatMs, replayBufferSize, maxConnectionsPerUser,
   cors { origin: config.webOrigin, credentials: true }, emitConnectionEvent }, hooks: undefined
   for now (task 2.5 injects the audit hooks).
2. wiring.module.ts: BymaxRealtimeModule.forRootAsync({ imports: [ConfigModule, AuthModule],
   inject: [APP_CONFIG, CookieSessionAuthenticator], useFactory, extraProviders:
   [CookieSessionAuthenticator] }); export nothing app-specific.
3. e2e sse-connect: login (cookie jar), open the stream with the 'eventsource' npm client at
   /api/events, assert connection:established arrives with EXACTLY { connectionId, traits }
   and traits has only userId/tenantId/roles (no metadata leak).
4. Negative unit specs: Test.createTestingModule with options missing authenticator rejects;
   malformed options (bad transport) rejects. Assert on the library's documented error
   codes/messages.
5. Sync-path unit: BymaxRealtimeModule.forRoot({ transport:'sse', authenticator: stub }) boots
   in a testing module.

Constraints:
- Options come ONLY from APP_CONFIG; no literals that belong in env; no process.env.
- Standard repo constraints (strict TS, sizes, headers, JSDoc, timeless, English, no em dashes,
  sequential bounded tests).
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Unit then e2e suites green sequentially; coverage 100% on src/realtime.
- Manual: curl -N with the session cookie against /api/events streams the established event.
- Commit `feat(api): canonical realtime wiring (2.3)`.

Completion Protocol: standard steps.
```

### Task 2.4: Emit console, domain simulator and tenant isolation

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 2.3

#### Description

The endpoints that make the example alive: emit console (`user`/`tenant`/`room`/`broadcast`) delegating to `RealtimeService`, and a domain simulator producing realistic `order.*` / `deployment.*` events. The two-tenant isolation e2e is the phase's flagship proof.

#### Acceptance criteria

- [ ] `POST /emit/user/:userId`, `/emit/tenant/:tenantId`, `/emit/room/:roomId`, `/emit/broadcast` with zod DTOs (`event`, `data`), delegating to `RealtimeService` (tenant guard arrives in phase 03; endpoint shape ready for it).
- [ ] `POST /domain/orders/simulate` emits a small scripted burst (created, paid, shipped) to the caller's tenant.
- [ ] E2E: two clients (acme, globex) connected; tenant emit reaches only acme; broadcast reaches both; user emit reaches only that user's connection.
- [ ] Reserved event names are not used by the app (guard test compares emitted names against `RESERVED_EVENT_NAMES`).

#### Files to create / modify

- `apps/api/src/emit/`, `apps/api/src/domain/`
- `apps/api/test/e2e/tenant-isolation.e2e-spec.ts`

#### Agent prompt

```
You are a senior NestJS engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. RealtimeService (from @bymax-one/nest-realtime) is wired; this
task adds the emit console + domain simulator + the tenant-isolation proof.

CURRENT PHASE: 02, Task 2.4 of 6 (MIDDLE).

PRECONDITIONS
- Task 2.3 done: SSE connect e2e green.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §11.1 (endpoint catalogue rows for /emit and /domain).
- Library README: RealtimeService method signatures; './shared' RESERVED_EVENT_NAMES.

TASK
Build EmitModule and DomainModule with their controllers/services, plus the two-tenant
isolation e2e and the reserved-names guard test.

DELIVERABLES
1. emit module: four POST endpoints with zod body { event: string, data: unknown }; service
   delegates 1:1 to RealtimeService methods; a guard hook point (tenant ownership) is left as a
   clearly-named service seam for the next phase, without weakening current behavior.
2. domain module: POST /domain/orders/simulate emits order.created -> order.paid ->
   order.shipped (100ms apart) to the caller's tenant (from the session traits);
   POST /domain/deployments/simulate similar with deployment.* events.
3. e2e tenant-isolation: three eventsource clients (ana@acme, bob@acme, gil@globex):
   /emit/tenant/acme reaches ana+bob only; /emit/user/:ana reaches ana only; /emit/broadcast
   reaches all three. Assert event ids are present and lexicographically increasing per client.
4. Unit guard test: the set of event names the app emits (export a frozen APP_EVENT_NAMES
   constant used by emit/domain) has zero intersection with RESERVED_EVENT_NAMES from
   '@bymax-one/nest-realtime/shared'.

Constraints:
- Controllers thin; services own logic. Standard repo constraints. Sequential bounded tests.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Unit + e2e green sequentially; 100% coverage on new modules.
- Commit `feat(api): emit console + domain simulator + isolation proof (2.4)`.

Completion Protocol: standard steps.
```

### Task 2.5: Audit feed and heartbeat raw-capture lab

- **Status**: 📋 ToDo
- **Priority**: P1
- **Size**: M
- **Depends on**: 2.3

#### Description

Wire `IConnectionLifecycleHooks` into an in-memory ring-buffer audit feed (`GET /audit/feed`), and prove the heartbeat honestly: a raw TCP/HTTP capture of the SSE stream shows `: keepalive` comment lines that carry no `id:` and never fire listeners.

#### Acceptance criteria

- [ ] `AuditService` implements the four hooks (connect, disconnect with duration, error, reauth-failed) appending typed entries (capped ring buffer, instance-tagged); wired into the options factory `hooks`.
- [ ] `GET /audit/feed` returns entries newest-first with filtering by kind.
- [ ] Heartbeat e2e: raw HTTP client (node:net or undici stream) captures bytes for > 2 heartbeat intervals with `REALTIME_HEARTBEAT_MS` lowered; asserts `: keepalive` lines present, no `id:` on them; an `eventsource` client in parallel receives zero events during the silent window.
- [ ] Matrix rows 22 and 52 satisfied.

#### Files to create / modify

- `apps/api/src/audit/`, `apps/api/src/realtime/options.factory.ts` (hooks now injected)
- `apps/api/test/e2e/heartbeat.e2e-spec.ts`

#### Agent prompt

```
You are a senior NestJS engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. Lifecycle hooks feed an audit trail; the SSE heartbeat must be
proven to be a raw comment, not an event.

CURRENT PHASE: 02, Task 2.5 of 6 (MIDDLE).

PRECONDITIONS
- Task 2.3 done (wiring factory exists with hooks: undefined).

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §10.4 and §12.2.
- Library README: IConnectionLifecycleHooks shape; heartbeat behavior (: keepalive comment).

TASK
Implement the audit module (hooks sink + feed endpoint), inject hooks into the wiring, and
write the raw heartbeat capture e2e.

DELIVERABLES
1. audit module: AuditService with onConnect/onDisconnect/onError/onReauthenticationFailed
   appending { kind, at, instance, connectionId, userId, tenantId, transport, extra } into a
   capped (500) in-memory ring; GET /audit/feed?kind= returns newest-first.
2. options.factory.ts: hooks now provided by AuditService (inject via the factory).
3. heartbeat e2e: open a raw stream (undici request with bodyTimeout disabled) to /api/events
   with the session cookie; collect raw chunks for ~2.5x heartbeatMs; assert at least two
   lines matching /^: keepalive$/m; assert none of those comment blocks contains 'id:' or
   'event:'; simultaneously an eventsource client registers handlers for all app events and
   receives none during the silent window.
4. Unit specs for the ring buffer and hook mapping; 100% coverage.

Constraints:
- Standard repo constraints; sequential bounded tests.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Suites green; commit `feat(api): audit feed + heartbeat honesty lab (2.5)`.

Completion Protocol: standard steps.
```

### Task 2.6: Phase close: audit, dashboards, PR with Copilot review

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: 2.1-2.5

#### Description

Standard phase close with one addition: record the matrix rows landed by this phase in the PR body.

#### Acceptance criteria

- [ ] Tasks 2.1-2.5 ✅, verifications re-run.
- [ ] Dashboards synced; PR body lists matrix rows 1, 2, 4, 7, 10, 19, 21, 22, 29, 30, 37, 52, 67, 68.
- [ ] Copilot review requested and findings addressed; merged on green; branch deleted.

#### Files to create / modify

- This file, `../DEVELOPMENT_PLAN.md`, `../tasks/README.md`

#### Agent prompt

```
You are the phase-close engineer for nest-realtime-example.

PROJECT: nest-realtime-example. Branch feat/phase-02-sse-foundation.

CURRENT PHASE: 02, Task 2.6 of 6 (LAST: phase close).

PRECONDITIONS
- Tasks 2.1-2.5 report done.

REQUIRED READING (only these)
- docs/tasks/phase-02-sse-foundation.md (all criteria).
- docs/tasks/README.md "Branch and PR workflow".

TASK
Audit, sync dashboards, PR to merge.

DELIVERABLES
1. Re-run all Verification commands sequentially (unit before e2e; one suite at a time).
2. Sync this header (6/6 ✅), plan §1 Phase 02 row, tasks README index.
3. `gh pr create` (title `feat: sse foundation, canonical wiring and labs`), body summarizing
   deliverables + the matrix rows landed; request the GitHub Copilot code review; address every
   finding; merge on green with `gh pr merge --squash --delete-branch`.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Never merge with failing CI.

Verification: `gh pr checks` green pre-merge; branch gone post-merge.

Completion Protocol: standard steps + phase completion line.
```

## Completion log

<!-- append: - N.M ✅ YYYY-MM-DD one-line summary -->

- 2.1 ✅ 2026-07-09 NestJS app skeleton: createApp seam, config-driven CORS, api prefix (health excluded), GET /health, e2e boot spec.
