# Phase 03: auth-policies-rooms

> **Status**: 🔄 In Progress · **Progress**: 1 / 6 tasks · **Last updated**: 2026-07-09
> **Source roadmap**: [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) §5 (Phase 03)
> **Source spec**: [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md) §10.3, §11, §12.3, §12.6

## Context

The SSE profile works with cookie auth. This phase completes the authentication story (ticket pattern, composing authenticator, bearer minting for the WS phase), the connection policies (periodic reauth with both failure modes, instant revocation, FIFO eviction, `emitConnectionEvent` toggle) and the room features (composeRoomId, join/leave, anti-IDOR guard, reserved-names discipline, method decorators). Matrix rows landed: 3, 8, 9, 11, 13-18, 20, 31-35, 54, 55, 69-72.

## Rules-of-phase

1. Tickets are one-shot (`GETDEL`), 60 second TTL, opaque `randomUUID`; a reused or expired ticket maps to auth failure (the library sees null).
2. The reauth lab must make cause and effect observable: revoke, then watch the next cycle disconnect (or emit `connection:reauthentication-failed` first in `'event'` mode).
3. Eviction is FIFO, never a rejection: the new connection is admitted, the oldest closes with `REALTIME_TOO_MANY_CONNECTIONS`.
4. The anti-IDOR guard lives in the app (the library deliberately does not validate tenant ownership); the test proves a cross-tenant emit attempt is rejected before reaching `RealtimeService`.
5. Standard global conventions (plan §4).

## Reference docs

- Spec §10.3 (authenticators), §11.1 (auth + rooms + labs endpoints), §12.3 (eviction), §12.6 (reauth/revocation).
- Library README: reauthenticationPolicy, maxConnectionsPerUser, ROOM_PREFIXES/composeRoomId, decorators.

## Task index

| ID  | Task                                                          | Status | Priority | Size | Depends on |
| --- | ------------------------------------------------------------- | ------ | -------- | ---- | ---------- |
| 3.1 | Branch + ticket pattern (issue, one-shot consume, specs)      | ✅     | P0       | M    | Phase 02   |
| 3.2 | Composing authenticator + WS bearer mint + auth-failure specs | 📋     | P0       | M    | 3.1        |
| 3.3 | Reauth policy lab + revocation set + kill switch              | 📋     | P0       | L    | 3.2        |
| 3.4 | FIFO eviction lab + emitConnectionEvent toggle                | 📋     | P0       | M    | 3.2        |
| 3.5 | Rooms module + anti-IDOR + decorators                         | 📋     | P0       | M    | 3.2        |
| 3.6 | Phase close: audit, dashboards, PR + Copilot review           | 📋     | P0       | S    | 3.1-3.5    |

## Tasks

### Task 3.1: Ticket pattern

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: Phase 02

#### Description

Pattern B for clients that cannot send cookies cross-origin: an authenticated `POST /auth/ticket` stores traits in Redis under a `randomUUID` key with 60s TTL; `TicketAuthenticator` consumes it with `GETDEL` so reuse fails.

#### Acceptance criteria

- [x] Branch `feat/phase-03-auth-policies-rooms` created with `git switch -c`.
- [x] `POST /auth/ticket` (requires a valid session cookie) returns `{ ticket }`; Redis key `realtime:ticket:{id}` holds serialized traits, `EX 60`.
- [x] `TicketAuthenticator.authenticate` reads `ctx.query.ticket`, `GETDEL`s, returns traits or null.
- [x] Specs: happy path; second use fails; expired ticket fails; malformed ticket fails; traits never logged.

#### Files to create / modify

- `apps/api/src/auth/ticket.controller.ts`, `ticket.service.ts`, `ticket.authenticator.ts` + specs

#### Agent prompt

```
You are a senior NestJS engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. Adding the one-shot ticket auth pattern (Pattern B) for SSE
clients that cannot rely on cookies.

CURRENT PHASE: 03 (auth-policies-rooms), Task 3.1 of 6 (FIRST).

PRECONDITIONS
- Phase 02 merged (cookie auth + wiring + labs). Redis available via compose.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §10.3 (TicketAuthenticator) and §11.1 (/auth/ticket row).
- Library README: ConnectionAuthContext (query params reach the authenticator).

TASK
Create the branch and implement the ticket issue endpoint + one-shot TicketAuthenticator with
full negative coverage.

DELIVERABLES
1. `git switch -c feat/phase-03-auth-policies-rooms` (NEVER git checkout -b).
2. ticket.service.ts: issue(traits) -> randomUUID id, SET realtime:ticket:{id} = JSON traits
   EX 60; consume(id) -> GETDEL, parse or null. node:crypto randomUUID only.
3. ticket.controller.ts: POST /auth/ticket guarded by the session cookie (reuse the session
   verification from phase 02), returns { ticket }.
4. ticket.authenticator.ts implementing IConnectionAuthenticator over ctx.query['ticket'].
5. Unit specs (mocked ioredis) covering: issue+consume roundtrip; double consume null;
   expired (mock GETDEL null) null; garbage id null. Scenario comments on every it().

Constraints:
- Standard repo constraints (strict TS no any/suppressions, sizes, headers, JSDoc, timeless
  comments, English, no em dashes, sequential bounded tests, no .gitkeep). Never log traits.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Unit suite green; 100% coverage on the ticket files.
- Commit `feat(api): one-shot ticket auth (3.1)`.

Completion Protocol: task status ✅ + checkboxes; Task index; header Progress; Phase 03 row in
docs/DEVELOPMENT_PLAN.md §1; Completion log; Conventional commit, no attribution.
```

### Task 3.2: Composing authenticator, bearer mint and auth-failure specs

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 3.1

#### Description

One `IConnectionAuthenticator` to rule them all: dispatch by context (WS bearer via `handshake.auth` surface, `ticket` query param, else cookie), so the library wiring keeps a single `authenticator` option. Plus `POST /auth/ws-token` (short-lived HMAC bearer for phase 06) and the SSE 401 spec.

#### Acceptance criteria

- [ ] `CompositeAuthenticator` routes: `ctx.transport === 'websocket'` + token present -> bearer; `ctx.query.ticket` -> ticket; else cookie. `revalidate` delegates to the cookie/bearer revocation check.
- [ ] `POST /auth/ws-token` mints a 10 minute HMAC token (node:crypto), verified by `BearerAuthenticator` (structure ready; full WS use in phase 06).
- [ ] Wiring factory now injects `CompositeAuthenticator` (single option unchanged in shape).
- [ ] E2E: unauthenticated `/api/events` returns 401 (browser will not retry a fatal 401, documented in the spec assertion message).
- [ ] Matrix rows 3 (extraProviders now carry the composite), 13, 69, 72 satisfied.

#### Files to create / modify

- `apps/api/src/auth/composite.authenticator.ts`, `bearer.authenticator.ts`, `ws-token.controller.ts` + specs
- `apps/api/src/realtime/options.factory.ts`

#### Agent prompt

```
You are a senior NestJS engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. Three auth patterns must flow through ONE
IConnectionAuthenticator so the library wiring stays a single option.

CURRENT PHASE: 03, Task 3.2 of 6 (MIDDLE).

PRECONDITIONS
- Task 3.1 done (ticket authenticator exists); phase 02 cookie authenticator exists.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §10.3 (composing authenticator paragraph).
- Library README: ConnectionAuthContext fields (cookies, headers, query, transport).

TASK
Implement CompositeAuthenticator + BearerAuthenticator + the ws-token mint endpoint; swap the
wiring to the composite; add the 401 e2e.

DELIVERABLES
1. bearer.authenticator.ts: verifies an HMAC token (same session.service primitives, 10 min
   exp) from the context the WS transport exposes (per library README: socket handshake auth
   token surfaces in the authenticator context; code against that documented surface).
2. composite.authenticator.ts: dispatch order: websocket+token -> bearer; query.ticket ->
   ticket; else cookie. revalidate: false when realtime:revoked:{userId} exists in Redis.
3. ws-token.controller.ts: POST /auth/ws-token (session-guarded) -> { token, expiresAt }.
4. options.factory/wiring: authenticator = CompositeAuthenticator (extraProviders updated).
5. E2E: GET /api/events without credentials -> HTTP 401. Unit specs for dispatch order and
   revalidate; scenario comments everywhere.

Constraints:
- node:crypto only. Standard repo constraints. Sequential bounded tests.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Unit + e2e green sequentially; 100% coverage on auth files.
- Commit `feat(api): composite authenticator + ws token mint (3.2)`.

Completion Protocol: standard steps.
```

### Task 3.3: Reauthentication lab, revocation set and kill switch

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: L
- **Depends on**: 3.2

#### Description

Make long-session security observable: 15s reauth cycles against the Redis revocation set, both `onFailure` modes, the positive-auth cache counter, plus the instant kill switch (`RealtimeService.disconnect`) and registry introspection endpoints.

#### Acceptance criteria

- [ ] `POST /auth/revoke/:userId` / `DELETE /auth/revoke/:userId` manage `realtime:revoked:{userId}`.
- [ ] Reauth policy wired from config (`REAUTH_INTERVAL_SECONDS`, `REAUTH_ON_FAILURE`, `cacheTtlMs`); a revalidation counter (per user) is exposed at `GET /labs/reauth/stats` proving the cache reduces checks.
- [ ] E2E (`'disconnect'` mode): connect, revoke, stream closes within ~2 intervals; audit feed shows `reauth-failed`.
- [ ] E2E (`'event'` mode profile): client receives `connection:reauthentication-failed` `{ reason }` before the close.
- [ ] `GET /connections` lists the instance's active connections (id, user, tenant, transport, connectedAt) via the library's documented introspection surface (or app-side tracking from hooks if the library exposes none; note which path was taken in the PR body).
- [ ] `POST /connections/:id/disconnect` closes that connection (`USER_LOGGED_OUT` reason observable client-side).
- [ ] Matrix rows 14, 15, 16, 17 (single instance half), 35, 54, 70 satisfied.

#### Files to create / modify

- `apps/api/src/connections/`, `apps/api/src/auth/revocation.controller.ts`
- `apps/api/test/e2e/reauth.e2e-spec.ts`, `kill-switch.e2e-spec.ts`

#### Agent prompt

```
You are a senior NestJS engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. Long-lived connections must react to credential revocation:
periodic reauth (both failure modes) + instant kill switch.

CURRENT PHASE: 03, Task 3.3 of 6 (MIDDLE).

PRECONDITIONS
- Task 3.2 done (composite authenticator with Redis-backed revalidate).

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §12.6 and §11.1 (revoke, connections rows).
- Library README: reauthenticationPolicy options; RealtimeService.disconnect; the
  connection:reauthentication-failed reserved event; any registry introspection it exports.

TASK
Implement revocation endpoints, the reauth lab with stats, the connections module with the
kill switch, and both e2e modes.

DELIVERABLES
1. revocation.controller.ts: POST/DELETE /auth/revoke/:userId over the Redis set.
2. options.factory: reauthenticationPolicy { intervalSeconds, onFailure, cacheTtlMs } from
   config; a RevalidationStats provider counts revalidate() calls per user (wrap the composite's
   revalidate) exposed at GET /labs/reauth/stats.
3. connections module: GET /connections (prefer the library's documented introspection; if the
   linked version exports none, maintain an app-side registry fed by the audit hooks and say so
   in JSDoc + PR body); POST /connections/:id/disconnect -> RealtimeService.disconnect(id,
   'USER_LOGGED_OUT').
4. reauth e2e: with REAUTH_INTERVAL_SECONDS=2 in the test env: (a) disconnect mode: connect,
   revoke, assert close within 3 intervals and an audit 'reauth-failed' entry; (b) event mode
   (boot a second app instance in-process with the profile flipped): assert the reserved event
   arrives with { reason } before the close.
5. kill-switch e2e: connect two tabs, disconnect one by id, the other survives; stats endpoint
   shows cacheTtlMs reducing revalidate counts across a burst.

Constraints:
- Standard repo constraints; scenario comments; sequential bounded tests (reauth e2e uses short
  intervals, never sleeps longer than needed).
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Suites green; coverage 100% on new files.
- Commit `feat(api): reauth lab + revocation + kill switch (3.3)`.

Completion Protocol: standard steps.
```

### Task 3.4: FIFO eviction lab and emitConnectionEvent toggle

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 3.2

#### Description

Prove the library's most counterintuitive policy: exceeding `maxConnectionsPerUser` (2 in this repo) admits the new connection and evicts the oldest with `REALTIME_TOO_MANY_CONNECTIONS`; there is never an HTTP 429. Plus the `emitConnectionEvent: false` profile assertion.

#### Acceptance criteria

- [ ] E2E: open connections A, B, C for the same user in order; A closes with the eviction reason observable client-side; B and C stay; a 4th evicts B; HTTP status for every connect is success (never 429).
- [ ] `GET /labs/eviction/timeline` returns the eviction history (from hooks/disconnect reasons) for the frontend visualizer.
- [ ] A test profile with `REALTIME_EMIT_CONNECTION_EVENT=false` boots in-process and the e2e asserts no `connection:established` arrives while emits still flow.
- [ ] Matrix rows 18, 20, 71 satisfied.

#### Files to create / modify

- `apps/api/src/connections/eviction.controller.ts` + service additions
- `apps/api/test/e2e/eviction.e2e-spec.ts`, `connection-event-toggle.e2e-spec.ts`

#### Agent prompt

```
You are a senior NestJS engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. FIFO eviction must be demonstrated exactly as the library
defines it: newest admitted, oldest evicted, never a 429.

CURRENT PHASE: 03, Task 3.4 of 6 (MIDDLE).

PRECONDITIONS
- Task 3.2 done. maxConnectionsPerUser is 2 via env (phase 01 config).

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §12.3.
- Library README: maxConnectionsPerUser semantics + REALTIME_TOO_MANY_CONNECTIONS;
  sse.emitConnectionEvent.

TASK
Build the eviction timeline endpoint and the two e2e suites (eviction order; connection-event
toggle).

DELIVERABLES
1. Track disconnect reasons in the audit-fed registry; GET /labs/eviction/timeline?userId=
   returns ordered entries { connectionId, connectedAt, evictedAt, reason }.
2. eviction e2e: same-user clients A,B,C,(D) via eventsource with the session cookie; assert
   eviction order A then B; every connect HTTP handshake succeeds (no 429 anywhere); the evicted
   stream's close carries/coincides with the REALTIME_TOO_MANY_CONNECTIONS reason in the
   timeline.
3. toggle e2e: boot an in-process app with emitConnectionEvent=false; connect; assert no
   connection:established within a bounded window while a subsequent emit IS received.

Constraints:
- Standard repo constraints; scenario comments; sequential bounded tests.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Suites green; commit `feat(api): fifo eviction lab + connection-event toggle (3.4)`.

Completion Protocol: standard steps.
```

### Task 3.5: Rooms, anti-IDOR guard and method decorators

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 3.2

#### Description

Resource rooms (`composeRoomId`), join/leave endpoints (idempotent), the app-side anti-IDOR guard on tenant emits, and the `@OnConnect`/`@OnDisconnect` decorators coexisting with config hooks (order proven).

#### Acceptance criteria

- [ ] `POST /rooms/:roomId/join` + `/leave` operate on the caller's connection id (client sends its `connectionId` from `connection:established`); double join/leave are no-ops.
- [ ] Room ids composed via `composeRoomId('RESOURCE', 'incident', id)`; raw prefixed strings rejected by the DTO (must use the documented convention).
- [ ] Emit service now enforces tenant ownership: emitting to a tenant other than the caller's returns 403 before touching `RealtimeService` (unit + e2e proven).
- [ ] `@OnConnect`/`@OnDisconnect` handlers in the audit module increment feature-local counters; a unit proves config hooks fire before decorator handlers.
- [ ] Matrix rows 31, 32, 33, 55 satisfied (34 landed in phase 02's guard test; extend it to room event names).

#### Files to create / modify

- `apps/api/src/rooms/`, `apps/api/src/emit/emit.service.ts` (guard), `apps/api/src/audit/decorator-handlers.ts`
- `apps/api/test/e2e/rooms.e2e-spec.ts`

#### Agent prompt

```
You are a senior NestJS engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. Rooms + the anti-IDOR guard the library deliberately leaves to
the application, + both lifecycle-hook styles coexisting.

CURRENT PHASE: 03, Task 3.5 of 6 (MIDDLE).

PRECONDITIONS
- Task 3.2 done. Emit module exists with a guard seam (phase 02).

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §11.1 (rooms rows) and library README: joinRoom/leaveRoom,
  composeRoomId/ROOM_PREFIXES, @OnConnect/@OnDisconnect semantics and ordering vs config hooks.

TASK
Implement the rooms module, harden the emit guard, add decorator handlers, and the rooms e2e.

DELIVERABLES
1. rooms module: join/leave endpoints (zod: connectionId + resource type/id composed through
   composeRoomId from '@bymax-one/nest-realtime/shared'); GET /rooms/mine listing the caller's
   rooms from app-side tracking; idempotency proven.
2. emit.service.ts: the tenant guard seam now rejects (403, stable error body) when
   :tenantId differs from the session tenant; broadcast restricted to an 'admin' role.
3. decorator-handlers.ts: a provider with @OnConnect() and @OnDisconnect() methods bumping
   counters exposed at GET /audit/decorator-stats; unit asserts config hooks fired first
   (order observable via the audit ring sequence).
4. rooms e2e: two acme users join resource:incident:i1; emitToRoom reaches both; leave removes
   one; globex user joining the same room still never receives acme tenant emits (rooms are
   orthogonal to tenants; assert both).
5. Extend the reserved-names guard: room event names used by the app stay outside
   RESERVED_EVENT_NAMES.

Constraints:
- Standard repo constraints; scenario comments; sequential bounded tests.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Suites green; 100% coverage; commit `feat(api): rooms + anti-idor guard + decorators (3.5)`.

Completion Protocol: standard steps.
```

### Task 3.6: Phase close: audit, dashboards, PR with Copilot review

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: 3.1-3.5

#### Description

Standard phase close; PR body lists the matrix rows landed.

#### Acceptance criteria

- [ ] Tasks 3.1-3.5 ✅, verifications re-run sequentially.
- [ ] Dashboards synced; PR body lists rows 3, 8, 9, 11, 13-18, 20, 31-35, 54, 55, 69-72.
- [ ] Copilot findings addressed; merged on green; branch deleted.

#### Files to create / modify

- This file, `../DEVELOPMENT_PLAN.md`, `../tasks/README.md`

#### Agent prompt

```
You are the phase-close engineer for nest-realtime-example.

PROJECT: nest-realtime-example. Branch feat/phase-03-auth-policies-rooms.

CURRENT PHASE: 03, Task 3.6 of 6 (LAST: phase close).

PRECONDITIONS
- Tasks 3.1-3.5 report done.

REQUIRED READING (only these)
- docs/tasks/phase-03-auth-policies-rooms.md (criteria); docs/tasks/README.md workflow section.

TASK
Audit, sync dashboards, PR to merge.

DELIVERABLES
1. Re-run all Verifications (one suite at a time). 2. Sync header (6/6 ✅), plan §1 row, tasks
README. 3. `gh pr create` (title `feat: auth patterns, connection policies and rooms`), body
with the matrix rows; request GitHub Copilot review; address every finding; merge on green
with `gh pr merge --squash --delete-branch`.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Never merge with failing CI.

Verification: `gh pr checks` green pre-merge; branch deleted after.

Completion Protocol: standard steps + phase completion line.
```

## Completion log

<!-- append: - N.M ✅ YYYY-MM-DD one-line summary -->

- 3.1 ✅ 2026-07-09 one-shot ticket auth: `POST /auth/ticket`, Redis `GETDEL` consume (60s TTL), negative coverage
