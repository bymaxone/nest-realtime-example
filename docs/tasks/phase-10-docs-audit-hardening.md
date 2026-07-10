# Phase 10: docs-audit-hardening

> **Status**: 🔄 In Progress · **Progress**: 3 / 5 tasks · **Last updated**: 2026-07-10
> **Source roadmap**: [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) §5 (Phase 10)
> **Source spec**: [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md) §7, §8.1, §18

## Context

The finish line: the repo must read as the canonical reference and prove its own completeness. Full README with reproducible journeys, the export-usage and coverage-matrix audit (75 rows verified), Stryker mutation hardening on the api, CI finalization, and the documented (or executed) switch from the `file:` link to the published npm version.

## Rules-of-phase

1. The matrix audit is evidence-based: every row cites the route/page AND the test file:line proving it; a red row spawns a fix task inside this phase before close.
2. Mutation testing is the pre-release gate: `break: 95` minimum on `apps/api`, survivors documented or killed; it does not run per PR.
3. README journeys are executed on a fresh clone before being declared reproducible.
4. Standard global conventions (plan §4).

## Reference docs

- Spec §7 (matrix), §8.1 (npm switch), §11.2 (journeys), §18 (gates); plan §5 Phase 10.

## Task index

| ID   | Task                                                | Status | Priority | Size | Depends on |
| ---- | --------------------------------------------------- | ------ | -------- | ---- | ---------- |
| 10.1 | Branch + full README with reproducible journeys     | ✅     | P0       | M    | Phase 09   |
| 10.2 | Export-usage + coverage-matrix audit (75 rows)      | ✅     | P0       | M    | 10.1       |
| 10.3 | Stryker mutation baseline + hardening (api)         | 📋     | P0       | L    | 10.2       |
| 10.4 | CI finalization + npm-switch procedure              | ✅     | P1       | S    | 10.2       |
| 10.5 | Phase close: audit, dashboards, PR + Copilot review | 📋     | P0       | S    | 10.1-10.4  |

## Tasks

### Task 10.1: Full README with reproducible journeys

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: Phase 09

#### Description

Complete the README into the repo's front door: badges (CI now; CodeQL/Scorecard marked "activates when public"), quick start (single-instance and cluster), the §11.2 journeys as copy-paste walkthroughs, the page map, testing order, capacity/proxy notes.

#### Acceptance criteria

- [x] Branch `feat/phase-10-docs-audit-hardening` created with `git switch -c`.
- [x] README sections: mission, architecture diagram, quick start (dev + cluster), demo users table, journeys (first connection, two-tenant isolation, ticket, reconnect+replay, offline drain, eviction, revocation single+cross-instance, chat, both split-screen), page map, testing (the ordered flow), proxy/capacity notes, docs table, license.
- [x] Every journey executed on a live stack; each step's observed output quoted.
- [x] Migration section (the SSE-to-WebSocket story) integrated coherently.

#### Files to create / modify

- `README.md`

#### Agent prompt

```
You are a senior technical writer working on nest-realtime-example.

PROJECT: nest-realtime-example. Finish the README as the public front door of the canonical
reference app.

CURRENT PHASE: 10 (docs-audit-hardening), Task 10.1 of 5 (FIRST).

PRECONDITIONS
- Phases 00-09 merged; all suites green.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §11.2 (journeys), §3 (diagram source), §16 (stack commands).
- Current README (skeleton + migration section).

TASK
Create the branch and write the complete README; execute every journey to capture real outputs.

DELIVERABLES
1. `git switch -c feat/phase-10-docs-audit-hardening`.
2. README per the acceptance criteria: journeys as numbered curl/browser walkthroughs with the
   actual observed outputs (run them; quote truthfully); badges block with the private-vs-public
   note; testing section documenting the strict sequential order and the cluster manual flow.
3. Keep it public-grade: no internal references, no placeholders left.

Constraints:
- English, no em dashes, professional tone.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Fresh-clone replay of the quick start + two journeys succeeds as written.
- Commit `docs(readme): complete reference documentation (10.1)`.

Completion Protocol: task status ✅ + checkboxes; Task index; header Progress; Phase 10 row in
docs/DEVELOPMENT_PLAN.md §1; Completion log; Conventional commit, no attribution.
```

### Task 10.2: Export-usage and coverage-matrix audit

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: 10.1

#### Description

The completeness proof: an audit table mapping all 75 matrix rows to evidence (route/page + test), plus the export sweep asserting every public library export is consumed somewhere in the example. Red rows become fix tasks inside this phase.

#### Acceptance criteria

- [x] `docs/COVERAGE_AUDIT.md`: 75 rows, each with status, route/UI evidence, test evidence (file path), notes; zero red rows at close (75/75 green).
- [x] Export sweep script (`scripts/audit-exports.mjs`): reads the library's export maps (all three subpaths), greps the example source for each symbol, reports unused exports; wired as `pnpm audit:exports`; zero unjustified unused (58 referenced, 10 justified exceptions each citing a spec section).
- [x] CI runs `audit:exports` in the main pipeline (a step in the `ci` job).

#### Files to create / modify

- `docs/COVERAGE_AUDIT.md`, `scripts/audit-exports.mjs`, `.github/workflows/ci.yml`

#### Agent prompt

```
You are a senior auditor-engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. Prove the repo exercises the whole library: matrix audit +
export sweep.

CURRENT PHASE: 10, Task 10.2 of 5 (MIDDLE).

PRECONDITIONS
- Task 10.1 done.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §7 (all 75 rows), §4 (export inventory).

TASK
Produce the evidence-based audit doc and the export sweep, fixing any gap found.

DELIVERABLES
1. docs/COVERAGE_AUDIT.md: table of the 75 rows with evidence columns filled by inspecting the
   real code/tests (cite paths); any row lacking evidence gets fixed NOW (implement the missing
   piece or test) before the doc claims green.
2. scripts/audit-exports.mjs: parse the linked library package.json exports + its d.ts named
   exports per subpath; grep apps/ for each symbol; print a table; exit 1 on unused symbols
   not listed in the justified-exceptions block at the top of the script (exceptions must cite
   a spec section sanctioning them).
3. Wire `pnpm audit:exports` into ci.yml after build.

Constraints:
- Evidence over claims: no row goes green without a citation. Standard repo constraints.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- audit:exports exit 0; COVERAGE_AUDIT.md has zero red rows.
- Commit `docs(audit): matrix + export completeness proof (10.2)`.

Completion Protocol: standard steps.
```

### Task 10.3: Stryker mutation baseline and hardening

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: L
- **Depends on**: 10.2

#### Description

The assertiveness gate: Stryker over `apps/api`, baseline recorded, survivors hunted in one concentrated session, `break: 95` minimum enforced (drive toward 100 where sane; document genuine equivalents).

#### Acceptance criteria

- [ ] `stryker.config.json` on apps/api (incremental off for the gate run, `maxConcurrentTestRunners` bounded).
- [ ] Baseline + final scores recorded in `docs/stryker/mutation_results.md` with the survivor dispositions (killed / equivalent with justification).
- [ ] Final score >= 95, thresholds `high 99 / low 95 / break 95` pinned; `pnpm mutation` documented as the pre-release command (not per PR).

#### Files to create / modify

- `apps/api/stryker.config.json`, `docs/stryker/mutation_results.md`, root script

#### Agent prompt

```
You are a senior mutation-testing engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. Stryker over apps/api as the pre-release assertiveness gate.

CURRENT PHASE: 10, Task 10.3 of 5 (MIDDLE).

PRECONDITIONS
- Task 10.2 done; unit coverage is a pinned 100 (phase 09).

REQUIRED READING (only these)
- apps/api/jest.config.ts (runner integration); docs/DEVELOPMENT_PLAN.md §3 (memory bounds).

TASK
Configure Stryker, record the baseline, harden survivors to >= 95, document results.

DELIVERABLES
1. stryker.config.json: jest runner, mutate src/** excluding test utilities, thresholds
   high 99 / low 95 / break 95, bounded concurrency (respect the machine: 50% runners max),
   dashboard reporter off (private repo), html + clear-text on.
2. Run the baseline (this is slow; it runs ALONE, nothing else concurrent). Record the score
   and the survivor list in docs/stryker/mutation_results.md.
3. Hardening session: for each survivor, either write the killing spec (preferred) or document
   it as a genuine equivalent with a one-line proof. Re-run to >= 95.
4. Root script `mutation`; README testing section notes it is pre-release, not per PR.

Constraints:
- One Stryker run at a time; never alongside other suites. Standard repo constraints.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Final run >= 95 with break enforced; results doc committed.
- Commit `test(api): mutation hardening to >=95 (10.3)`.

Completion Protocol: standard steps.
```

### Task 10.4: CI finalization and the npm-switch procedure

- **Status**: ✅ Done
- **Priority**: P1
- **Size**: S
- **Depends on**: 10.2

#### Description

Freeze the pipeline (job names become contractual for branch protection), add the README badges wiring, and document (or execute, if the library has published) the switch from `file:` to the pinned npm version.

#### Acceptance criteria

- [x] `ci.yml` job ids/names finalized and documented as contractual; README badges point at the ci workflow.
- [x] `docs/NPM_SWITCH.md`: the exact diff and verification flow for moving to `"@bymax-one/nest-realtime": "^0.1.0"`; `npm view` returns 404 (unpublished), so the switch is left as the documented procedure and the committed pnpm patch is documented as a known consumer workaround.
- [x] Branch-protection recommendation block (required checks list) included in the doc for when the repo goes public.

#### Files to create / modify

- `.github/workflows/ci.yml`, `docs/NPM_SWITCH.md`, `README.md` badges

#### Agent prompt

```
You are a senior release engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. Freeze CI contracts and prepare (or execute) the switch to the
published library version.

CURRENT PHASE: 10, Task 10.4 of 5 (MIDDLE).

PRECONDITIONS
- Task 10.2 done.

REQUIRED READING (only these)
- .github/workflows/ci.yml current state; docs/TECHNICAL_SPECIFICATION.md §8.1.

TASK
Finalize CI naming/badges and write (or execute) the npm switch.

DELIVERABLES
1. ci.yml: stable job names (install, typecheck, lint, unit-api, unit-web, e2e, playwright,
   audit-exports, build); README badges for ci (plus CodeQL/Scorecard badges annotated as
   activating when the repository becomes public).
2. docs/NPM_SWITCH.md: check `npm view @bymax-one/nest-realtime version`; if resolvable,
   perform the switch on this branch (both apps' manifests, lockfile, full ordered test flow,
   audit:exports) and record the executed log in the doc; if not, leave the doc as the exact
   procedure with expected outputs.
3. Branch-protection recommendation (required checks = the contractual job names).

Constraints:
- Standard repo constraints; no em dashes; public-grade wording.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- CI green with the final job names; doc complete.
- Commit `ci(repo): contract freeze + npm switch procedure (10.4)`.

Completion Protocol: standard steps.
```

### Task 10.5: Phase close: final audit, dashboards, PR with Copilot review

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: 10.1-10.4

#### Description

The repo-level close: besides the standard phase close, this PR declares the plan complete (11/11 phases) and the matrix 75/75.

#### Acceptance criteria

- [ ] Tasks 10.1-10.4 ✅; the full ordered test flow re-run once; audit doc green.
- [ ] Plan §1 shows 11/11 phases, 60/60 tasks; tasks README total row synced.
- [ ] PR merged on green with Copilot findings addressed; branch deleted.

#### Files to create / modify

- This file, `../DEVELOPMENT_PLAN.md`, `../tasks/README.md`

#### Agent prompt

```
You are the phase-close engineer for nest-realtime-example.

PROJECT: nest-realtime-example. Branch feat/phase-10-docs-audit-hardening. This close also
declares the whole plan complete.

CURRENT PHASE: 10, Task 10.5 of 5 (LAST: phase close and plan completion).

PRECONDITIONS
- Tasks 10.1-10.4 report done.

REQUIRED READING (only these)
- docs/tasks/phase-10-docs-audit-hardening.md; docs/DEVELOPMENT_PLAN.md §6.

TASK
Final audit, dashboards to 100%, PR to merge.

DELIVERABLES
1. Re-run the full ordered flow + audit:exports + a COVERAGE_AUDIT.md spot check (5 random rows
   re-verified by hand). 2. Sync all dashboards to complete (plan §1: 11/11 phases, 60/60 tasks,
overall ✅). 3. `gh pr create` (title `docs: canonical reference complete, 75/75 matrix
verified`), body with the final numbers (coverage, mutation score, matrix, journeys); request
GitHub Copilot review; address every finding; merge on green with
`gh pr merge --squash --delete-branch`.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Never merge with failing CI.

Verification: `gh pr checks` green pre-merge; branch deleted after; plan reads complete.

Completion Protocol: standard steps + the final phase-completion line.
```

## Completion log

<!-- append: - N.M ✅ YYYY-MM-DD one-line summary -->

- 10.1 ✅ 2026-07-10 Wrote the full house-style README with badges and the nine journeys quoted from real stack output; added the offline-queue env to `.env.example`.
- 10.4 ✅ 2026-07-10 Froze the four CI job ids/names as contractual (with a note in ci.yml), added the export-audit step, and wrote docs/NPM_SWITCH.md documenting the unpublished-library switch procedure, the pnpm patch workaround, and the branch-protection required checks.
- 10.2 ✅ 2026-07-10 Committed the 75/75 coverage audit and the `audit:exports` sweep (wired into CI); strengthened matrix row 8 with a real `GET /connections/introspection` endpoint injecting the library Symbol DI tokens, and typed option/reserved-name usages so only 10 exports remain justified exceptions.
