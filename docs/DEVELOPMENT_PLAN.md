# nest-realtime-example: Development Plan

> **Status:** 🔄 In execution
> **Last updated:** 2026-07-06
> **Source spec:** [TECHNICAL_SPECIFICATION.md](./TECHNICAL_SPECIFICATION.md) (v1.0.0; §7 Feature Coverage Matrix is the contract this plan implements)
> **Scope:** build the canonical reference implementation of `@bymax-one/nest-realtime`, exercising every library feature and path, with sibling-grade quality gates.

**Status legend:** 📋 ToDo · 🔄 In Progress · 👀 Review · ✅ Done · ⛔ Blocked · 🟡 Partial

---

## 1. Progress dashboard

> **Progress:** 8 / 11 phases complete (73%) · 50 / 60 tasks
> **Active phase:** phase 08 (in review)
> **Blockers:** none

| #   | Phase                  | Tasks file                                 | Status    | Progress | Size | Last updated |
| --- | ---------------------- | ------------------------------------------ | --------- | -------- | ---- | ------------ |
| 00  | repo-foundation        | `tasks/phase-00-repo-foundation.md`        | ✅ Done   | 6/6      | M    | 2026-07-09   |
| 01  | infra-and-library-link | `tasks/phase-01-infra-and-library-link.md` | ✅ Done   | 5/5      | M    | 2026-07-09   |
| 02  | sse-foundation         | `tasks/phase-02-sse-foundation.md`         | ✅ Done   | 6/6      | L    | 2026-07-09   |
| 03  | auth-policies-rooms    | `tasks/phase-03-auth-policies-rooms.md`    | ✅ Done   | 6/6      | L    | 2026-07-09   |
| 04  | replay-and-offline     | `tasks/phase-04-replay-and-offline.md`     | ✅ Done   | 5/5      | M    | 2026-07-09   |
| 05  | scaling-cluster        | `tasks/phase-05-scaling-cluster.md`        | ✅ Done   | 6/6      | L    | 2026-07-10   |
| 06  | websocket-transport    | `tasks/phase-06-websocket-transport.md`    | ✅ Done   | 6/6      | L    | 2026-07-10   |
| 07  | both-composite         | `tasks/phase-07-both-composite.md`         | ✅ Done   | 4/4      | S    | 2026-07-10   |
| 08  | web-frontend           | `tasks/phase-08-web-frontend.md`           | 👀 Review | 6/6      | L    | 2026-07-10   |
| 09  | testing-quality        | `tasks/phase-09-testing-quality.md`        | 📋 ToDo   | 0/5      | L    | 2026-07-06   |
| 10  | docs-audit-hardening   | `tasks/phase-10-docs-audit-hardening.md`   | 📋 ToDo   | 0/5      | M    | 2026-07-06   |

### External precondition

The library `@bymax-one/nest-realtime` is consumed via a local `file:` link until it publishes to npm (spec §8.1). Phase 01 verifies the sibling checkout builds; if the library later publishes, the pinned-version switch is executed inside phase 10 (or as a standalone PR) without renumbering this plan.

---

## 2. Dependency graph

```
00 ──► 01 ──► 02 ──► 03 ──► 04 ──► 05 ──► 06 ──► 07 ──► 09 ──► 10
                │                                        ▲
                └─────────► 08 (web: skeleton after 02, ─┘
                             full after 07)
```

Reading: the backend track is linear (each phase consumes the previous one's wiring). The web track (08) can begin its skeleton and early pages once 02 exists (live feed, audit) but only closes after 07 (chat, cluster and both-mode pages need the WS and composite profiles). 09 (testing to the full bar) requires every feature phase; 10 audits and hardens last.

## 3. Parallelization notes

- **One implementer at a time remains the rule for autonomous execution.** The overlap noted for phase 08 is an option for human parallel work, not for concurrent agents in the same repo.
- **Test suites never run in parallel**: one suite at a time, Jest and Vitest pinned to `maxWorkers: '50%'`, `NODE_OPTIONS=--max-old-space-size=4096` as a guard. SSE/WS E2E suites hold long-lived connections; the cluster E2E (phase 09) additionally holds a compose stack with two api containers and nginx, so it always runs alone, after unit suites, never alongside them.
- **One compose stack at a time.** Labs and E2E share the same ports (3001/3002/8080/6379); tear down (`docker compose down`) between profile switches.
- Static gates (`typecheck`, `lint`, `build`) are safe to run normally at any point.

## 4. Global conventions (all phases)

1. **English only** in code, comments, JSDoc, identifiers, commits (Conventional Commits) and docs. No em dashes anywhere.
2. **TypeScript strict** (`noImplicitAny`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), zero `any`, zero suppression comments (`@ts-ignore`, `eslint-disable`).
3. **Clean Code:** functions <= 50 lines, files <= 800 (200-400 typical), `@fileoverview` + `@layer` header per file, imperative JSDoc on every export.
4. **Coverage 100%** (line/branch/function/statement) on both apps via pinned thresholds; every `it()` carries a scenario comment.
5. **Timeless comments:** never reference plan phases or task ids in committed source or `.github` config. Doc-section references (spec §7) are allowed.
6. **Library-first boundary:** realtime behavior comes exclusively from `@bymax-one/nest-realtime`; the example never reimplements transports, replay, or connection tracking. Redis-backed implementations of the library's storage interfaces (`IRealtimePubSub`, `IOfflineQueueStorage`, `IPresenceStorage`) are the sanctioned consumer-side code this repo exists to demonstrate.
7. **Frontend boundary:** `apps/web` imports only `/react` and `/shared` subpaths (lint-enforced); `apps/api` never imports `/react`.
8. **PR per phase** with GitHub Copilot review requested and every finding addressed; merge only with CI green. Branches via `git switch -c feat/phase-NN-<slug>` (never `git checkout -b`). No AI attribution lines anywhere in commits or PRs.
9. **No `.gitkeep`**, no empty scaffold directories, no secrets (demo values only; secret scan stays clean).
10. **Honor the library's documented invariants** when designing demos: the SSE heartbeat is a comment (never an event), EventSource cannot send custom headers (cookie/ticket only for SSE), sticky sessions are mandatory for scaled WS with polling fallback, `connection:established` carries only client-safe traits. Where the library README differs from its spec at implementation time, verify against the published README.

---

## 5. Per-phase detail

### Phase 00: repo-foundation (M)

- **Goal:** a clean pnpm workspace with strict tooling and CI green from the very first PR.
- **Scope (in):** root `package.json` (`private: true`, engines Node >= 24), `pnpm-workspace.yaml` (`apps/*`), strict base `tsconfig`, ESLint flat config + Prettier, husky + commitlint + lint-staged, `.gitmessage`, minimal `ci.yml` (install, typecheck, lint, build, unit with `--passWithNoTests` until real specs land), `codeql.yml` + `scorecard.yml` committed but gated on repository visibility, `dependabot.yml`, README skeleton linking spec/plan/design system.
- **Scope (out):** application code, docker, library consumption.
- **Definition of Done:** clean clone passes `pnpm install && pnpm typecheck && pnpm lint && pnpm build`; the phase PR itself runs the new CI and merges green; visibility-gated workflows are skipped (repo private) without failing.
- **References:** spec §5, §6, §19.

### Phase 01: infra-and-library-link (M)

- **Goal:** Redis available, the library consumable, subpaths proven, env contract typed.
- **Scope (in):** `docker-compose.yml` with `redis:7-alpine` (healthcheck), `docker/api.Dockerfile` (multi-stage, non-root), `file:` link to the sibling library in both apps' manifests, a subpath probe spec (`.`, `./shared`, `./react` resolve in ESM and CJS), typed env config module for `apps/api` (spec §9.1 registry), `.env.example`.
- **Definition of Done:** `docker compose up -d redis` healthy; probe spec green against the linked library; env module rejects malformed values with an aggregated error.
- **References:** spec §8, §9.1, §16.

### Phase 02: sse-foundation (L)

- **Goal:** the SSE profile boots end to end: cookie auth, canonical wiring, emit console, tenant isolation, audit feed, honest heartbeat.
- **Scope (in):** NestJS skeleton + `/health`; demo users + `POST /auth/login|logout` with HMAC-signed HttpOnly cookie (`node:crypto`); `CookieSessionAuthenticator`; `RealtimeWiringModule` with the canonical `forRootAsync` options factory (transport `sse`, configured endpoint `/api/events`, heartbeat, CORS, `InMemoryPubSub` default, hooks); boot-failure specs (`REALTIME_INVALID_OPTIONS`, `REALTIME_NO_AUTHENTICATOR`) and a sync `forRoot` unit; emit console endpoints + domain simulator; two-tenant isolation E2E; audit feed (config hooks) and the heartbeat raw-capture lab proving `: keepalive` comments carry no id and fire no listeners.
- **Definition of Done:** `curl` walkthrough: login, open `/api/events` with `eventsource`, receive `connection:established` (client-safe traits only), receive emitted events, observe keepalive comments; tenant isolation E2E green; matrix rows 1, 2, 4, 7, 10, 19, 21, 22, 29, 30, 37, 52, 67, 68 land.
- **References:** spec §9.2, §10, §11, §12.1, §12.2.

### Phase 03: auth-policies-rooms (L)

- **Goal:** every auth pattern, connection policy and room feature of the library demonstrated with observable outcomes.
- **Scope (in):** ticket pattern (issue endpoint, one-shot `GETDEL`, 60s TTL, reuse-fails spec); composing authenticator dispatching cookie/ticket/bearer by context; auth-failure specs (SSE 401, ticket invalid maps to auth failed); reauthentication lab (15s interval, Redis revocation set, `'disconnect'` and `'event'` modes, positive-auth cache counter); instant revocation endpoint; FIFO eviction lab (`maxConnectionsPerUser: 2`, oldest evicted with `REALTIME_TOO_MANY_CONNECTIONS`, new admitted, never 429); `emitConnectionEvent` toggle; rooms module (`composeRoomId`, join/leave idempotency, anti-IDOR tenant guard on `emitToTenant`); reserved-event-names guard test; `@OnConnect`/`@OnDisconnect` decorators coexisting with config hooks (order proven).
- **Definition of Done:** matrix rows 3, 8, 9, 11, 13-18, 20, 31-35, 54, 55, 69-72 land with routes + tests; the eviction and reauth labs return machine-readable timelines the frontend will render.
- **References:** spec §10.3, §11, §12.3, §12.6.

### Phase 04: replay-and-offline (M)

- **Goal:** the replay story proven end to end, including the dead ends.
- **Scope (in):** replay lab (drop endpoint force-closes the caller's stream; reconnect with `Last-Event-ID` replays in order; buffer size 10 makes eviction visible); `RedisOfflineQueue` implementing `IOfflineQueueStorage` (append on zero connections, `retrieveSince`, `acknowledge`, TTL + `maxPerUser` trim, unit-proven); buffer-miss fallback path (`REALTIME_REPLAY_BUFFER_MISS`); lexicographic id ordering spec; offline drain E2E.
- **Definition of Done:** matrix rows 23-28, 75 land; the replay lab timeline distinguishes buffer replay from offline-queue replay from unrecoverable gap.
- **References:** spec §12.4, library spec §10.

### Phase 05: scaling-cluster (L)

- **Goal:** true multi-instance SSE with observable fan-out, loop prevention, cross-instance revocation and graceful degradation.
- **Scope (in):** `RedisRealtimePubSub` implementing `IRealtimePubSub` (duplicate() subscriber, origin id self-filter); nginx SSE-safe config + `cluster` compose profile (app-a, app-b, proxy, round-robin HTTP); cluster lab with per-instance delivery and publish counters (exactly-once per client, no republish storm); cross-instance kill switch (`op:'disconnect'` observable); degradation lab (`REALTIME_PUBSUB_UNAVAILABLE` warn + single-instance continue); `RedisPresenceStorage` implementing `IPresenceStorage`.
- **Definition of Done:** with the cluster profile up, an emit on app-a reaches a client connected to app-b; counters prove no loop; revoking a connection owned by the other instance closes it; stopping Redis degrades with a warning and no crash; matrix rows 38-41 land (17 gains its cross-instance half).
- **References:** spec §15, §12.8, library spec §11.

### Phase 06: websocket-transport (L)

- **Goal:** the WebSocket profile at parity, plus everything only WS can do.
- **Scope (in):** optional peers installed; WS boot profile with config-driven `/live` namespace via the custom IoAdapter; bearer authentication from `handshake.auth.token`; incident chat with `@Subscribe` handlers (and the no-op-under-SSE proof); rooms over WS; `@socket.io/redis-adapter` wiring + adapter-aware `disconnectSockets(true)` revocation; nginx sticky sessions (`ip_hash`) for the polling fallback, with the honest failure-mode documentation; payload lab (`maxHttpBufferSize` exceeded drops with `REALTIME_PAYLOAD_TOO_LARGE`); WS `cors`; `error` reserved event + `hooks.onError`; WS E2E with `socket.io-client` including cluster chat fan-out.
- **Definition of Done:** matrix rows 5, 12, 42-49, 53, 36, 74 land; switching `REALTIME_TRANSPORT` between `sse` and `websocket` changes zero service code (asserted by running the same emit E2E against both profiles).
- **References:** spec §12.5, §15, library spec §6.2, §11.4, §11.5.

### Phase 07: both-composite (S)

- **Goal:** the migration story: one emit, two transports, zero service changes.
- **Scope (in):** `both` boot profile; split-screen lab endpoints; E2E asserting a single `emitToTenant` lands on an SSE client and a WS client simultaneously; the documented SSE-to-WS migration journey.
- **Definition of Done:** matrix rows 6, 50, 51 land.
- **References:** spec §12, library spec §6.3.

### Phase 08: web-frontend (L)

- **Goal:** the full dashboard, built exclusively on `./react` + `/shared`, following the shared design system.
- **Scope (in):** Next.js 16 skeleton with the design-system files copied verbatim from a sibling and the standard shell; `RealtimeProvider` + global connection badge (`useRealtimeConnection`); pages per spec §13.2 (live feed, presence, chat, broadcast, connections/eviction, audit, and the labs: connection, ticket, replay, cluster, both); typed event map shared with the api; ticket flow via `auth.fetchTicket`; manual connect/disconnect + backoff visibility; bundle assertion that the SSE-only build excludes `socket.io-client`.
- **Definition of Done:** matrix rows 56-66 land; Playwright smoke opens every page; the app is visually consistent with the sibling dashboards (spec §14 acceptance criterion).
- **References:** spec §13, §14.
- **Note:** the skeleton and read-only pages may start any time after phase 02; the phase closes only after 07.

### Phase 09: testing-quality (L)

- **Goal:** the sibling-grade quality bar, fully green.
- **Scope (in):** unit coverage to 100% on `apps/api` (Jest) and `apps/web` (Vitest); E2E of every HTTP route; SSE flow suite (`eventsource`); WS flow suite (`socket.io-client`); the multi-instance cluster suite (compose profile, sequential, heaviest, includes revocation and chat fan-out); Playwright journey per page; CI wiring for the E2E jobs (service Redis; cluster suite behind `workflow_dispatch` until stable).
- **Definition of Done:** all gates in spec §18 green locally and in CI; coverage thresholds pinned; no suite runs concurrently with another.
- **References:** spec §18, §19.

### Phase 10: docs-audit-hardening (M)

- **Goal:** the repo reads as the canonical reference and proves its own completeness.
- **Scope (in):** full README (badges, quick start, the §11.2 journeys as curl/browser walkthroughs, capacity notes, proxy guidance); export-usage audit (every library export referenced; every §7 matrix row verified against a real route/page/test, red rows spawn fix tasks); Stryker pre-release baseline + survivor hardening (`break: 95` minimum on `apps/api`); CI finalization (badges, job names frozen); the npm-switch procedure documented (file: link to published version) and executed here if the library has published.
- **Definition of Done:** matrix audit table committed with 75/75 verified; mutation score >= 95; README journeys reproduce cleanly on a fresh clone.
- **References:** spec §7, §18, §8.1.

---

## 6. Update protocol

1. Task state changes update: the task block, the task-index row, the phase-file header progress, and this file's §1 dashboard row (progress + last updated).
2. Phase completion flips the §1 row to ✅, updates the overall counters, and appends the phase's completion-log line in its task file.
3. This file is the **canonical dashboard**; `docs/tasks/README.md` only mirrors it.
4. One status legend everywhere: 📋🔄👀✅⛔🟡. Never invent a second vocabulary.
5. Commit dashboards with `docs(plan): ...` Conventional Commits; never with failing verification, never with `--no-verify`.
6. Changing the phase decomposition (add/split/remove) updates §1, §2, §3 and §5 in the same edit.
