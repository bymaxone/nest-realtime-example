# Phase 07: both-composite

> **Status**: 🔄 In Progress · **Progress**: 1 / 4 tasks · **Last updated**: 2026-07-10
> **Source roadmap**: [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) §5 (Phase 07)
> **Source spec**: [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md) §12, library spec appendix on migration

## Context

The migration story: `transport: 'both'` runs SSE and WebSocket simultaneously, one emit reaches both, and an SSE application can adopt WS features without touching service code. Small phase, high narrative value. Matrix rows landed: 6, 50, 51.

## Rules-of-phase

1. The both profile changes only env; every existing suite that applies must still pass against it.
2. The split-screen proof is a single emit observed by one SSE client and one WS client in the same test.
3. The migration journey is written as a walkthrough a reader can follow, not marketing prose.
4. Standard global conventions (plan §4).

## Reference docs

- Library README: 'both' mode semantics (both endpoints live; emits fan to both).
- Spec §12 scenarios; docs/tasks/README.md workflow.

## Task index

| ID  | Task                                                | Status | Priority | Size | Depends on |
| --- | --------------------------------------------------- | ------ | -------- | ---- | ---------- |
| 7.1 | Branch + both profile boot + config surface         | ✅     | P0       | S    | Phase 06   |
| 7.2 | Split-screen e2e: one emit, two transports          | 📋     | P0       | M    | 7.1        |
| 7.3 | Migration journey walkthrough                       | 📋     | P1       | S    | 7.2        |
| 7.4 | Phase close: audit, dashboards, PR + Copilot review | 📋     | P0       | S    | 7.1-7.3    |

## Tasks

### Task 7.1: Both profile boot

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: S
- **Depends on**: Phase 06

#### Description

Boot with `REALTIME_TRANSPORT=both`: SSE endpoint and WS namespace both live, options factory already handles the union (verify, adjust if any option was profile-guarded too narrowly).

#### Acceptance criteria

- [x] Branch `feat/phase-07-both-composite` created with `git switch -c`.
- [x] Both profile boots; `/api/events` (cookie) and the `/live` namespace (bearer) accept connections concurrently.
- [x] `GET /health` reports `transport: 'both'`.
- [x] Boot spec asserts both endpoints respond in the same process.

#### Files to create / modify

- `apps/api/src/realtime/options.factory.ts` (verification/adjustment), `apps/api/test/e2e/both-boot.e2e-spec.ts`

#### Agent prompt

```
You are a senior NestJS engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. Boot @bymax-one/nest-realtime in 'both' mode: SSE and
WebSocket serving simultaneously from one process.

CURRENT PHASE: 07 (both-composite), Task 7.1 of 4 (FIRST).

PRECONDITIONS
- Phase 06 merged (both transports individually proven).

REQUIRED READING (only these)
- Library README: transport 'both' semantics.
- apps/api/src/realtime/options.factory.ts (current guards).

TASK
Create the branch, ensure the options factory yields a correct union under 'both', prove the
double boot.

DELIVERABLES
1. `git switch -c feat/phase-07-both-composite`.
2. Review the factory: under 'both', both sse and websocket blocks must be present; fix any
   over-narrow profile guard (keep changes minimal and covered).
3. both-boot e2e: in one app instance, an eventsource client (cookie) and a socket.io-client
   (bearer) both reach connection:established.

Constraints:
- Standard repo constraints (strict TS no any/suppressions, sizes, headers, JSDoc, timeless
  comments, English, no em dashes, sequential bounded tests, no .gitkeep).
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Suite green; commit `feat(api): both-mode boot (7.1)`.

Completion Protocol: task status ✅ + checkboxes; Task index; header Progress; Phase 07 row in
docs/DEVELOPMENT_PLAN.md §1; Completion log; Conventional commit, no attribution.
```

### Task 7.2: Split-screen e2e

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 7.1

#### Description

The composite proof: a single `emitToTenant` observed once by an SSE client and once by a WS client; room and user emits equally mirrored; no duplicates on either side.

#### Acceptance criteria

- [ ] E2E: same tenant, client S (SSE) + client W (WS); one `POST /emit/tenant/...`: S and W each receive exactly one copy (duplicate detection via event payload nonce).
- [ ] Same for user emit and room emit (both clients joined to the room).
- [ ] The parity suite from phase 06 also passes under the both profile (run it as part of this spec file or a sibling).
- [ ] Matrix rows 6, 50 satisfied.

#### Files to create / modify

- `apps/api/test/e2e/both-fanout.e2e-spec.ts`

#### Agent prompt

```
You are a senior test engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. Prove 'both' mode fan-out: one emit, exactly one delivery per
client on each transport.

CURRENT PHASE: 07, Task 7.2 of 4 (MIDDLE).

PRECONDITIONS
- Task 7.1 done.

REQUIRED READING (only these)
- apps/api/test/e2e/parity/parity.suite.ts (reuse).

TASK
Write the split-screen e2e and run the parity suite under 'both'.

DELIVERABLES
1. both-fanout e2e: nonce-stamped emits to tenant/user/room; assert exactly-once per client per
   transport within a bounded window; assert zero cross-duplicates after a settle delay.
2. Run runParitySuite with the SSE factory AND the WS factory against the both-profile app.

Constraints:
- Standard repo constraints; scenario comments; sequential bounded tests.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Suite green; commit `test(api): both-mode split-screen fanout (7.2)`.

Completion Protocol: standard steps.
```

### Task 7.3: Migration journey walkthrough

- **Status**: 📋 ToDo
- **Priority**: P1
- **Size**: S
- **Depends on**: 7.2

#### Description

The written journey: an SSE-only deployment adds chat by flipping to `both`, wiring the WS client on one page, and never touching service code. Lands in the README (migration section) with exact env/config diffs and the client snippet.

#### Acceptance criteria

- [ ] README gains a "Migrating from SSE to WebSocket (or running both)" section: before/after env, the one client-side change, what stays untouched (services, emits, auth server-side), the sticky-session caveat cross-referenced.
- [ ] Every code snippet in the walkthrough compiles (snippets extracted from real repo files, referenced by path).
- [ ] Matrix row 51 satisfied.

#### Files to create / modify

- `README.md`

#### Agent prompt

```
You are a senior technical writer working on nest-realtime-example.

PROJECT: nest-realtime-example. Document the SSE-to-both migration journey with real diffs
from this repo.

CURRENT PHASE: 07, Task 7.3 of 4 (MIDDLE).

PRECONDITIONS
- Task 7.2 done (both mode proven).

REQUIRED READING (only these)
- README.md current state; apps/web usage of useRealtime (if phase 08 not yet merged, reference
  the api-side snippets only and mark the client snippet as the canonical hook call from the
  library README).

TASK
Write the migration section of the README.

DELIVERABLES
1. README section: motivation (start SSE, add bi-directional later), the env diff
   (REALTIME_TRANSPORT sse -> both), what does NOT change (every service emit), the client
   addition (useRealtime with a wss URL for the chat page), the sticky-session caveat with a
   link to the proxy config, and the rollback story (flip back to sse).
2. All snippets sourced from real files with relative path references.

Constraints:
- English, public-grade, no em dashes, no internal references.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Markdown links/paths valid; commit `docs(readme): sse-to-both migration journey (7.3)`.

Completion Protocol: standard steps.
```

### Task 7.4: Phase close: audit, dashboards, PR with Copilot review

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: 7.1-7.3

#### Description

Standard phase close; PR body lists matrix rows 6, 50, 51.

#### Acceptance criteria

- [ ] Tasks 7.1-7.3 ✅; verifications re-run.
- [ ] Dashboards synced; PR merged on green with Copilot findings addressed; branch deleted.

#### Files to create / modify

- This file, `../DEVELOPMENT_PLAN.md`, `../tasks/README.md`

#### Agent prompt

```
You are the phase-close engineer for nest-realtime-example.

PROJECT: nest-realtime-example. Branch feat/phase-07-both-composite.

CURRENT PHASE: 07, Task 7.4 of 4 (LAST: phase close).

PRECONDITIONS
- Tasks 7.1-7.3 report done.

REQUIRED READING (only these)
- docs/tasks/phase-07-both-composite.md; docs/tasks/README.md workflow section.

TASK
Audit, sync dashboards, PR to merge.

DELIVERABLES
1. Re-run Verifications sequentially. 2. Sync header (4/4 ✅), plan §1 row, tasks README.
3. `gh pr create` (title `feat: both-mode composite and migration journey`), body with matrix
rows 6, 50, 51; request GitHub Copilot review; address every finding; merge on green with
`gh pr merge --squash --delete-branch`.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Never merge with failing CI.

Verification: `gh pr checks` green pre-merge; branch deleted after.

Completion Protocol: standard steps + phase completion line.
```

## Completion log

<!-- append: - N.M ✅ YYYY-MM-DD one-line summary -->

- 7.1 ✅ 2026-07-10 Both profile boot proven: audited every transport-literal guard in `apps/api/src` (options factory, main.ts, chat module) and confirmed each already reads `!== 'sse'` rather than `=== 'websocket'`, so `'both'` was already correctly wired with zero source changes; added `both-boot.e2e-spec.ts` asserting `GET /health` reports `transport: 'both'` and a cookie SSE client plus a bearer WS client both reach `connection:established` concurrently against one running app.
