# Phase 01: infra-and-library-link

> **Status**: 🔄 In Progress · **Progress**: 3 / 5 tasks · **Last updated**: 2026-07-09
> **Source roadmap**: [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) §5 (Phase 01)
> **Source spec**: [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md) §8, §9.1, §16

## Context

Phase 00 delivered the tooling shell. This phase makes the library consumable and the infrastructure real: Redis via compose, the api Dockerfile, the `file:` link to the sibling `nest-realtime` checkout, a probe spec proving all three subpaths resolve, and the typed env module that every later phase reads. The first real test lands here, which also removes the temporary `--passWithNoTests` allowance from CI.

## Rules-of-phase

1. The library is consumed via `file:../../../nest-realtime` until it publishes (spec §8.1); never copy library code into this repo.
2. The subpath probe is the phase's proof: `.`, `./shared`, `./react` must resolve for both ESM and CJS consumers.
3. The env module is the single place `process.env` is read in `apps/api`; it produces a frozen, typed config object and fails fast with an aggregated error.
4. Compose services get healthchecks; nothing depends on an unhealthy service.
5. Standard global conventions (plan §4) apply.

## Reference docs

- Spec §8 (library consumption), §9.1 (environment registry), §16 (local stack).
- Plan §5 Phase 01 block.

## Task index

| ID  | Task                                                                        | Status | Priority | Size | Depends on |
| --- | --------------------------------------------------------------------------- | ------ | -------- | ---- | ---------- |
| 1.1 | Branch + docker-compose (redis:7) + api Dockerfile                          | ✅     | P0       | M    | Phase 00   |
| 1.2 | Link `@bymax-one/nest-realtime` via file: + install optional peers          | ✅     | P0       | S    | 1.1        |
| 1.3 | Subpath probe spec (., /shared, /react; ESM + CJS) + remove passWithNoTests | ✅     | P0       | M    | 1.2        |
| 1.4 | Typed env config module + .env.example                                      | 📋     | P0       | M    | 1.1        |
| 1.5 | Phase close: audit, dashboards, PR + Copilot review                         | 📋     | P0       | S    | 1.1-1.4    |

## Tasks

### Task 1.1: Branch, docker-compose with Redis, api Dockerfile

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: Phase 00

#### Description

The local stack skeleton: `redis:7-alpine` with a healthcheck as the always-on service, plus the multi-stage non-root `api.Dockerfile` (used by the cluster profile in phase 05; built and smoke-run here).

#### Acceptance criteria

- [x] Branch `feat/phase-01-infra-and-library-link` created with `git switch -c`.
- [x] `docker-compose.yml`: `redis` service (`redis:7-alpine`, healthcheck `redis-cli ping`, port 6379).
- [x] `docker/api.Dockerfile`: multi-stage (deps, build, runtime), Node 24 alpine, non-root user, `HEALTHCHECK`.
- [x] `docker compose up -d redis` reaches healthy; `docker build -f docker/api.Dockerfile .` succeeds.

#### Files to create / modify

- `docker-compose.yml`, `docker/api.Dockerfile`, `.dockerignore`

#### Agent prompt

```
You are a senior infrastructure engineer working on nest-realtime-example.

PROJECT: nest-realtime-example, reference app for @bymax-one/nest-realtime. pnpm workspace,
apps/api (NestJS 11) + apps/web (Next.js 16). Redis backs pub/sub, tickets, offline queue
and presence in later phases.

CURRENT PHASE: 01 (infra-and-library-link), Task 1.1 of 5 (FIRST).

PRECONDITIONS
- Phase 00 merged: workspace, tooling and CI exist. apps are compiling stubs.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §16 (local stack) and §15 (topology, for context only).

TASK
Create the branch, the compose file with a healthchecked Redis, and the multi-stage api
Dockerfile.

DELIVERABLES
1. `git switch -c feat/phase-01-infra-and-library-link` (NEVER `git checkout -b`).
2. docker-compose.yml: service `redis` (image redis:7-alpine, ports 6379:6379, healthcheck
   `redis-cli ping` interval 5s). Leave room for a later `cluster` profile but do NOT add
   app services yet.
3. docker/api.Dockerfile: multi-stage (pnpm fetch/install, build, slim runtime), node:24-alpine,
   non-root user, HEALTHCHECK hitting /health (route lands in phase 02; use CMD-based check that
   tolerates absence for now via start-period).
4. .dockerignore (node_modules, dist, .next, docs, .git).

Constraints:
- Standard repo constraints: strict TS untouched, timeless comments, English only, no em dashes,
  no .gitkeep, no secrets.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- `docker compose up -d redis && docker compose ps` shows healthy.
- `docker build -f docker/api.Dockerfile .` exit 0.
- Commit `infra(compose): redis + api dockerfile (1.1)`.

Completion Protocol: update this task's status/index/header progress, the Phase 01 row in
docs/DEVELOPMENT_PLAN.md §1, append to Completion log, Conventional commit, no attribution.
```

### Task 1.2: Link the library and install optional peers

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: S
- **Depends on**: 1.1

#### Description

Wire `@bymax-one/nest-realtime` into both apps via `file:` protocol and install the peer sets this example needs (Nest core peers in api; React peers in web; optional WS peers in api; `socket.io-client` in web as an optional runtime for the WS pages).

#### Acceptance criteria

- [x] `apps/api/package.json`: `"@bymax-one/nest-realtime": "file:../../vendor/bymax-one-nest-realtime-0.1.0.tgz"` (committed pack tarball, resolves in tree, clone and CI) + `@nestjs/common@^11`, `@nestjs/core@^11`, `reflect-metadata`, `rxjs@^7.8`, `ioredis@^5`, and the optional WS peers (`@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io@^4`, `@socket.io/redis-adapter@^8`).
- [x] `apps/web/package.json`: same tarball link + `react@^19`, `react-dom@^19`, `socket.io-client@^4`, `next@^16` (plus `@types/react`, `@types/react-dom` for the `./react` probe typecheck).
- [x] `pnpm install` resolves the link; `pnpm typecheck` still green.
- [x] Sibling `dist/` built and packed into `vendor/`; the consumption strategy is documented in the README quick-start.

#### Files to create / modify

- `apps/api/package.json`, `apps/web/package.json`, `README.md` (prereq note)

#### Agent prompt

```
You are a senior Node.js engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. The library under test lives as a sibling checkout at
../nest-realtime (relative to this repo's parent directory) and is NOT yet on npm.

CURRENT PHASE: 01, Task 1.2 of 5 (MIDDLE).

PRECONDITIONS
- Task 1.1 done. Sibling nest-realtime checkout exists with its own package.json.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §8.1 (linking modes) and §4 (peer inventory).

TASK
Add the file: dependency and the peer sets to both apps; make install and typecheck green.

DELIVERABLES
1. apps/api: dependency "@bymax-one/nest-realtime": "file:../../../nest-realtime"; peers
   @nestjs/common ^11, @nestjs/core ^11, reflect-metadata ^0.2, rxjs ^7.8; ioredis ^5; optional
   WS set @nestjs/websockets ^11, @nestjs/platform-socket.io ^11, socket.io ^4,
   @socket.io/redis-adapter ^8. Dev deps for tests arrive later; do not add them now.
2. apps/web: same file: link; react ^19, react-dom ^19, next ^16, socket.io-client ^4.
3. If ../nest-realtime has no dist/, build it once (its own package scripts) so the link
   resolves; note the prerequisite in README's quick-start placeholder.

Constraints:
- Never copy library source into this repo; the link is the only consumption path.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- English only; no em dashes.

Verification:
- `pnpm install` exit 0; `node -e "require.resolve('@bymax-one/nest-realtime')"` from apps/api works.
- `pnpm typecheck` exit 0.
- Commit `chore(deps): link nest-realtime + peer sets (1.2)`.

Completion Protocol: standard steps (status, index, header, plan §1 row, log, commit).
```

### Task 1.3: Subpath probe spec and honest CI tests

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: 1.2

#### Description

The first real tests: Jest in the api proving `.` and `./shared` resolve (ESM + CJS), Vitest in the web proving `./react` and `./shared` resolve. Removing `--passWithNoTests` makes CI honest from here on.

#### Acceptance criteria

- [x] `apps/api` Jest configured (`maxWorkers: '50%'`, coverage collected with 100% thresholds; the bootstrap entry is excluded) with `test/probe/subpaths.spec.ts` importing `BymaxRealtimeModule`, `RealtimeService` from `.` (via both `import` and `createRequire`) and `RESERVED_EVENT_NAMES`, `ROOM_PREFIXES` from `./shared`. `composeRoomId` is imported from the root `.` subpath, not `./shared`: the shipped library exports the helper from the server subpath (spec drift, see the PR body).
- [x] `apps/web` Vitest configured (jsdom, `maxWorkers: '50%'`) with a probe importing `useRealtime`, `useRealtimeConnection`, `usePresence`, `RealtimeProvider` from `./react` and types from `./shared`.
- [x] `--passWithNoTests` removed from both app test scripts; the two CI unit steps run the real suites sequentially with a heap-cap guard.
- [x] `pnpm test` green from a clean install (with the sibling library packed into `vendor/`).

#### Files to create / modify

- `apps/api/jest.config.ts`, `apps/api/test/probe/subpaths.spec.ts`
- `apps/web/vitest.config.ts`, `apps/web/src/probe/subpaths.test.ts`
- `.github/workflows/ci.yml`

#### Agent prompt

```
You are a senior test engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. Library @bymax-one/nest-realtime linked via file: with three
subpaths: . (server), ./shared (zero-dep types/constants), ./react (React 19 hooks).

CURRENT PHASE: 01, Task 1.3 of 5 (MIDDLE).

PRECONDITIONS
- Task 1.2 done: link resolves, peers installed.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §8.2 (subpath boundaries) and §4.1-§4.2 (export inventory).

TASK
Add Jest (api) + Vitest (web) with bounded workers and the subpath probe specs; remove the
temporary --passWithNoTests from CI.

DELIVERABLES
1. apps/api/jest.config.ts: ts-jest or SWC transform, maxWorkers '50%', coverage collection on
   src, thresholds 100/100/100/100 (only implemented files exist, so this stays honest).
2. test/probe/subpaths.spec.ts: it() blocks (each with a scenario comment) asserting:
   - ESM import of BymaxRealtimeModule and RealtimeService from '@bymax-one/nest-realtime' resolves;
   - CJS require via node:module createRequire resolves the same;
   - './shared' exports RESERVED_EVENT_NAMES (frozen object), ROOM_PREFIXES, composeRoomId
     ('RESOURCE','incident','i1') === 'resource:incident:i1'.
3. apps/web/vitest.config.ts (jsdom, bounded workers) + src/probe/subpaths.test.ts asserting
   './react' exports useRealtime, useRealtimeConnection, usePresence, RealtimeProvider and
   './shared' types import cleanly.
4. ci.yml: drop --passWithNoTests; keep the two unit steps SEQUENTIAL.

Constraints:
- Every it() carries a scenario comment. No suppressions. Timeless comments.
- Suites run sequentially with bounded workers; never fan out.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- English only; no em dashes.

Verification:
- `pnpm --filter @nest-realtime-example/api test` exit 0.
- `pnpm --filter @nest-realtime-example/web test` exit 0 (run AFTER the api suite, not concurrently).
- Commit `test(probe): subpath resolution + honest ci (1.3)`.

Completion Protocol: standard steps.
```

### Task 1.4: Typed env config module

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 1.1

#### Description

The single `process.env` reader of `apps/api`: parses the §9.1 registry into a frozen typed object, aggregating all violations into one boot error. (When `@bymax-one/nest-config` publishes, swapping to it is a documented follow-up; this local module keeps the example self-contained today.)

#### Acceptance criteria

- [ ] `apps/api/src/config/`: schema + loader + Nest module exposing `APP_CONFIG` (Symbol token) with the full §9.1 registry (ports, transport profile, realtime tunables, redis url, pubsub driver, session secret, web origin).
- [ ] Malformed env produces ONE aggregated error listing every violation; values are never echoed (names + issue only).
- [ ] Config object is deep-frozen; unit specs cover happy path, aggregation, freeze, defaults.
- [ ] `.env.example` documents every variable with its default.

#### Files to create / modify

- `apps/api/src/config/env.schema.ts`, `env.loader.ts`, `config.module.ts`, `config.tokens.ts`
- `.env.example`

#### Agent prompt

```
You are a senior NestJS engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. apps/api needs a typed, frozen config sourced from process.env
exactly once at boot, with fail-fast aggregated errors that never echo values.

CURRENT PHASE: 01, Task 1.4 of 5 (MIDDLE).

PRECONDITIONS
- Tasks 1.1-1.3 done (jest exists for the specs).

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §9.1 (the full environment registry with defaults).

TASK
Implement the config module (schema, loader, Nest module, Symbol token) plus .env.example.

DELIVERABLES
1. env.schema.ts: zod schema mirroring §9.1 exactly (names, defaults, enums like
   REALTIME_TRANSPORT in {'sse','websocket','both'}, PUBSUB_DRIVER in {'memory','redis'},
   numeric coercions with sane bounds).
2. env.loader.ts: parse once, aggregate ALL issues into a single Error whose message lists
   variable names and issue kinds only (never the received values), deep-freeze the result.
3. config.module.ts: global Nest module providing APP_CONFIG (Symbol from config.tokens.ts)
   via useFactory over the loader. Explicit @Inject usage documented in JSDoc.
4. Unit specs: happy path with defaults; multi-violation aggregation (assert names present,
   values absent); frozen object rejects mutation; enum rejection.
5. .env.example with every variable + default from §9.1.

Constraints:
- This is the ONLY file set reading process.env in apps/api (lint-guarded later; keep the
  boundary clean now).
- Standard constraints: strict TS no any/suppressions, functions <= 50 lines, @fileoverview
  + @layer headers, imperative JSDoc, timeless comments, English, no em dashes.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Api unit suite green including the new specs; coverage of the config files 100%.
- Commit `feat(api): typed frozen env config (1.4)`.

Completion Protocol: standard steps.
```

### Task 1.5: Phase close: audit, dashboards, PR with Copilot review

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: 1.1-1.4

#### Description

Standard phase close: re-verify criteria, sync dashboards, PR, Copilot review, merge on green.

#### Acceptance criteria

- [ ] Tasks 1.1-1.4 ✅ with verifications re-run.
- [ ] Dashboards synced (this header, plan §1, tasks README).
- [ ] PR merged with Copilot findings addressed and CI green; branch deleted.

#### Files to create / modify

- This file, `../DEVELOPMENT_PLAN.md`, `../tasks/README.md`

#### Agent prompt

```
You are the phase-close engineer for nest-realtime-example.

PROJECT: nest-realtime-example. Branch feat/phase-01-infra-and-library-link.

CURRENT PHASE: 01, Task 1.5 of 5 (LAST: phase close).

PRECONDITIONS
- Tasks 1.1-1.4 report done.

REQUIRED READING (only these)
- docs/tasks/phase-01-infra-and-library-link.md (all acceptance criteria).
- docs/tasks/README.md "Branch and PR workflow".

TASK
Audit the phase, sync dashboards, drive the PR to merge.

DELIVERABLES
1. Re-run every task's Verification commands; fix or reopen red items first.
2. Update this file's header (5/5 ✅), docs/DEVELOPMENT_PLAN.md §1 Phase 01 row, tasks README index.
3. `gh pr create` (title `feat: local stack, library link and typed config`), request the
   GitHub Copilot code review, address EVERY finding, merge on green with
   `gh pr merge --squash --delete-branch`, return to main.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Never merge with failing CI.

Verification:
- `gh pr checks` green pre-merge; branch gone after merge.

Completion Protocol: standard steps + phase completion line in the log.
```

## Completion log

<!-- append: - N.M ✅ YYYY-MM-DD one-line summary -->

- 1.1 ✅ 2026-07-09 Branch, healthchecked redis:7-alpine compose service, and multi-stage non-root api Dockerfile (verified healthy + build exit 0).
- 1.2 ✅ 2026-07-09 Linked the library into both apps via a committed pack tarball plus the Nest/WS/React peer sets; install and typecheck green.
- 1.3 ✅ 2026-07-09 Subpath probes (api Jest CJS: `.` + `./shared`; web Vitest ESM: `./react` + `./shared`) with 100% coverage thresholds; removed passWithNoTests so CI runs real suites.
