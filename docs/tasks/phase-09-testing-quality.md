# Phase 09: testing-quality

> **Status**: 📋 ToDo · **Progress**: 0 / 5 tasks · **Last updated**: 2026-07-06
> **Source roadmap**: [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) §5 (Phase 09)
> **Source spec**: [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md) §18, §19

## Context

Every feature phase already carried its own proofs; this phase raises the whole repo to the sibling bar: 100% unit coverage on both apps, E2E of every HTTP route and every realtime flow, the cluster suite consolidated, Playwright journeys per page, and CI running all of it in the correct sequential order. Memory discipline is the defining constraint here.

## Rules-of-phase

1. Coverage thresholds are raised to 100/100/100/100 globally and never lowered; missing lines are covered with meaningful specs (every `it()` explains its scenario), never with exclusions.
2. One suite at a time, everywhere: locally and in CI. The order is: api unit, web unit, api e2e (http/sse/ws), Playwright, cluster (alone, last).
3. E2E route inventory is generated from the running app's route map and asserted complete (no untested endpoint).
4. Standard global conventions (plan §4).

## Reference docs

- Spec §18 (gates table), §19 (CI); plan §3 (memory discipline).

## Task index

| ID | Task | Status | Priority | Size | Depends on |
|---|---|---|---|---|---|
| 9.1 | Branch + api unit coverage to 100% | 📋 | P0 | L | Phase 08 |
| 9.2 | Web unit coverage to 100% | 📋 | P0 | M | 9.1 |
| 9.3 | E2E completeness: every HTTP route + SSE flows | 📋 | P0 | M | 9.1 |
| 9.4 | WS/cluster consolidation + Playwright journeys | 📋 | P0 | M | 9.3 |
| 9.5 | Phase close: audit, dashboards, PR + Copilot review | 📋 | P0 | S | 9.1-9.4 |

## Tasks

### Task 9.1: Api unit coverage to 100%

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: L
- **Depends on**: Phase 08

#### Description

Close every uncovered line/branch in `apps/api` with meaningful units; raise the pinned thresholds to global 100 and remove any per-file staging.

#### Acceptance criteria

- [ ] Branch `feat/phase-09-testing-quality` created with `git switch -c`.
- [ ] `pnpm --filter @nest-realtime-example/api test -- --coverage` reports 100/100/100/100 globally.
- [ ] No coverage exclusions (`istanbul ignore`) anywhere; no suppressions.
- [ ] Every new `it()` carries a scenario comment naming the rule it protects.

#### Files to create / modify

- `apps/api/**/*.spec.ts` additions; `apps/api/jest.config.ts` thresholds

#### Agent prompt

````
You are a senior test engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. Drive apps/api unit coverage to a pinned global 100% with
meaningful specs.

CURRENT PHASE: 09 (testing-quality), Task 9.1 of 5 (FIRST).

PRECONDITIONS
- Phases 00-08 merged; suites green at their current thresholds.

REQUIRED READING (only these)
- Coverage report output (run it); docs/DEVELOPMENT_PLAN.md §4 item 4.

TASK
Create the branch; close every gap; pin global 100 thresholds.

DELIVERABLES
1. `git switch -c feat/phase-09-testing-quality`.
2. Iterate: run coverage, pick the largest gap, write the missing scenario specs (error
   branches, guard rejections, config edge cases, storage failure paths with mocked ioredis
   errors), re-run. Repeat until 100/100/100/100.
3. jest.config.ts: coverageThreshold global 100 for all four metrics; delete any staged
   per-path thresholds.

Constraints:
- No istanbul-ignore, no test-only exports hacks; refactor for testability only when a seam is
  genuinely missing (keep functions <= 50 lines).
- maxWorkers '50%'; run suites one at a time; NODE_OPTIONS=--max-old-space-size=4096 if needed.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Standard repo constraints; scenario comments mandatory.

Verification:
- Coverage 100 on all four metrics; suite green.
- Commit `test(api): unit coverage to pinned 100 (9.1)`.

Completion Protocol: task status ✅ + checkboxes; Task index; header Progress; Phase 09 row in
docs/DEVELOPMENT_PLAN.md §1; Completion log; Conventional commit, no attribution.
````

### Task 9.2: Web unit coverage to 100%

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 9.1

#### Description

Same bar for `apps/web` under Vitest: components, lib modules and page logic at pinned 100, with the library hooks mocked at the module boundary.

#### Acceptance criteria

- [ ] `pnpm --filter @nest-realtime-example/web test -- --coverage` reports 100/100/100/100.
- [ ] Hook mocks live in one shared test util (single source for `useRealtime`/`usePresence`/`useRealtimeConnection` fakes).
- [ ] Thresholds pinned in `vitest.config.ts`; no exclusions beyond generated Next.js artifacts (explicit, justified list).

#### Files to create / modify

- `apps/web/**/*.test.tsx` additions; `apps/web/vitest.config.ts`; `apps/web/src/test-utils/realtime-mocks.tsx`

#### Agent prompt

````
You are a senior frontend test engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. apps/web to pinned 100% coverage under Vitest + RTL.

CURRENT PHASE: 09, Task 9.2 of 5 (MIDDLE).

PRECONDITIONS
- Task 9.1 done (api at 100; run AFTER it, never concurrently).

REQUIRED READING (only these)
- Web coverage report (run it); existing test-utils if any.

TASK
Close every gap with RTL specs; centralize the realtime hook mocks; pin thresholds.

DELIVERABLES
1. test-utils/realtime-mocks.tsx: typed fakes for the three hooks + provider (emitting
   scripted events), used by all page tests.
2. Missing specs: page states (loading/error/empty), control interactions, diff/timeline edge
   cases, api-client error envelopes.
3. vitest.config.ts: coverage provider v8, thresholds 100 all metrics; exclusions limited to
   .next and config files, each with a one-line justification comment.

Constraints:
- Bounded workers; sequential with other suites. Standard repo constraints; scenario comments.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Coverage 100; suite green. Commit `test(web): unit coverage to pinned 100 (9.2)`.

Completion Protocol: standard steps.
````

### Task 9.3: E2E completeness for HTTP routes and SSE flows

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 9.1

#### Description

Prove nothing is untested: a route-inventory spec walks the Nest route map and asserts every endpoint appears in the E2E registry; gaps get specs (auth failures, validation errors, happy paths). The SSE flow suite is consolidated (connect, established, emit scopes, heartbeat, replay, offline, eviction, reauth) as the canonical sequence.

#### Acceptance criteria

- [ ] `route-inventory.e2e-spec.ts`: enumerates registered routes at boot; asserts each is claimed by at least one E2E spec (registry maintained as a typed manifest); fails on unclaimed routes.
- [ ] Every route has at least: one happy path, one auth failure (where guarded), one validation failure (where zod-validated).
- [ ] The SSE flow suite runs as one ordered sequence tagged by matrix row ids in comments.

#### Files to create / modify

- `apps/api/test/e2e/route-inventory.e2e-spec.ts`, `apps/api/test/e2e/e2e-manifest.ts`, gap specs

#### Agent prompt

````
You are a senior API test engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. Route-complete E2E: no endpoint escapes testing.

CURRENT PHASE: 09, Task 9.3 of 5 (MIDDLE).

PRECONDITIONS
- Task 9.1 done.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §11.1 (endpoint catalogue).

TASK
Build the route inventory + manifest mechanism and fill every gap.

DELIVERABLES
1. e2e-manifest.ts: typed map route pattern -> spec file(s) + covered cases (happy/auth/
   validation flags).
2. route-inventory spec: boot the app, read the router (Nest's documented introspection or the
   express stack), normalize patterns, diff against the manifest; fail listing unclaimed routes
   or unclaimed mandatory cases.
3. Write the missing specs the diff reveals (401s on guarded routes, 400s on zod bodies, any
   endpoint added by labs without its negative cases).

Constraints:
- Sequential suites; bounded workers. Standard repo constraints; scenario comments.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Inventory spec green with zero unclaimed; full e2e suite green.
- Commit `test(api): route-complete e2e inventory (9.3)`.

Completion Protocol: standard steps.
````

### Task 9.4: WS/cluster consolidation and Playwright journeys

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 9.3

#### Description

The heavy finale: the WS suite consolidated (connect, chat, limits, parity), the cluster suite (SSE + WS halves) documented as the run-alone flow with compose orchestration scripted, and a Playwright journey per page against the real stack; CI wires the order.

#### Acceptance criteria

- [ ] `pnpm test:e2e:all` script runs, in order: api e2e (http/sse), ws e2e, then instructs/executes cluster (compose up, run alone, down); documented in the README testing section.
- [ ] Playwright: one journey per §13.2 page (login once, navigate, assert the page's signature interaction) against `pnpm dev` + compose redis; tagged `@smoke`.
- [ ] `ci.yml`: jobs ordered api-unit -> web-unit -> e2e (service redis) -> playwright; cluster behind `workflow_dispatch` (`e2e-cluster` job) until runners prove stable, with the manual trigger documented.
- [ ] All suites green locally in the documented order.

#### Files to create / modify

- `apps/web/playwright.config.ts`, `apps/web/e2e/*.spec.ts`, root scripts, `.github/workflows/ci.yml`

#### Agent prompt

````
You are a senior E2E engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. Consolidate the heavy suites and wire the strict sequential
order locally and in CI.

CURRENT PHASE: 09, Task 9.4 of 5 (MIDDLE).

PRECONDITIONS
- Task 9.3 done. Cluster suites exist (phases 05-06).

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §18 (order), §19 (CI); docs/DEVELOPMENT_PLAN.md §3.

TASK
Script the ordered test flow, add Playwright journeys, wire CI.

DELIVERABLES
1. Root scripts: test:e2e:all orchestrating the documented order with compose up/down around
   the cluster half (execa or shell script under scripts/, POSIX-safe).
2. Playwright config (single worker) + one journey per page: login, live feed receives a
   simulated event; broadcast 403 cross-tenant; connections kill switch; replay drop/replay;
   ticket connect; connection manual controls; presence roster updates; chat round trip (both
   profile); cluster stats render; both split-screen nonce match.
3. ci.yml: sequential jobs with needs: chaining; redis service for e2e; playwright job booting
   api+web; e2e-cluster job on workflow_dispatch only, running the cluster flow on the runner.

Constraints:
- ONE suite at a time everywhere; single Playwright worker; never parallel compose stacks.
- Standard repo constraints; scenario comments.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Local full flow green in order; CI green on the PR (cluster job manual).
- Commit `test(repo): ordered heavy suites + playwright journeys (9.4)`.

Completion Protocol: standard steps.
````

### Task 9.5: Phase close: audit, dashboards, PR with Copilot review

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: 9.1-9.4

#### Description

Standard phase close; the PR body reports the coverage numbers and the suite inventory.

#### Acceptance criteria

- [ ] Tasks 9.1-9.4 ✅; the full ordered flow re-run once end to end.
- [ ] Dashboards synced; PR merged on green with Copilot findings addressed; branch deleted.

#### Files to create / modify

- This file, `../DEVELOPMENT_PLAN.md`, `../tasks/README.md`

#### Agent prompt

````
You are the phase-close engineer for nest-realtime-example.

PROJECT: nest-realtime-example. Branch feat/phase-09-testing-quality.

CURRENT PHASE: 09, Task 9.5 of 5 (LAST: phase close).

PRECONDITIONS
- Tasks 9.1-9.4 report done.

REQUIRED READING (only these)
- docs/tasks/phase-09-testing-quality.md; docs/tasks/README.md workflow section.

TASK
Audit, sync dashboards, PR to merge.

DELIVERABLES
1. Re-run the FULL ordered flow once (unit api, unit web, e2e, playwright, cluster alone).
2. Sync header (5/5 ✅), plan §1 row, tasks README. 3. `gh pr create` (title `test: full
quality bar, route-complete e2e and journeys`), body with coverage numbers + suite inventory;
request GitHub Copilot review; address every finding; merge on green with
`gh pr merge --squash --delete-branch`.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Never merge with failing CI.

Verification: `gh pr checks` green pre-merge; branch deleted after.

Completion Protocol: standard steps + phase completion line.
````

## Completion log

<!-- append: - N.M ✅ YYYY-MM-DD one-line summary -->
