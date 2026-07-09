# Phase 00: repo-foundation

> **Status**: 🔄 In Progress · **Progress**: 3 / 6 tasks · **Last updated**: 2026-07-09
> **Source roadmap**: [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) §5 (Phase 00)
> **Source spec**: [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md) §5, §6, §19

## Context

The repository contains only `docs/` on `main`. This phase produces a clean pnpm workspace with strict tooling and a CI pipeline that gates this very phase's PR. No application code yet: `apps/api` and `apps/web` receive placeholder `package.json` + `tsconfig` + an empty-but-compiling entry so that `typecheck`, `lint` and `build` run truthfully across the workspace from day one.

## Rules-of-phase

1. CI must exist before any application code: the phase PR itself runs `ci.yml`.
2. `codeql.yml` and `scorecard.yml` are committed complete but gated with `if: ${{ !github.event.repository.private }}`; they must be skipped (not failed) while the repo is private.
3. `--passWithNoTests` is a temporary allowance, removed by the first real spec (phase 01's probe).
4. No `.gitkeep`, no empty directories, no secrets. Root `package.json` is `private: true`, engines `>= 24`.
5. All global conventions from the plan §4 apply from this phase onward.

## Reference docs

- Plan §4 (global conventions), §5 Phase 00 block.
- Spec §5 (tech stack), §6 (layout), §19 (CI and visibility).

## Task index

| ID  | Task                                                        | Status | Priority | Size | Depends on |
| --- | ----------------------------------------------------------- | ------ | -------- | ---- | ---------- |
| 0.1 | Branch + pnpm workspace + root manifests                    | ✅     | P0       | S    | none       |
| 0.2 | Strict TypeScript + ESLint flat config + Prettier           | ✅     | P0       | M    | 0.1        |
| 0.3 | husky + commitlint + lint-staged + .gitmessage              | ✅     | P1       | S    | 0.1        |
| 0.4 | CI: ci.yml + visibility-gated codeql/scorecard + dependabot | 🟡     | P0       | M    | 0.2        |
| 0.5 | README skeleton + docs cross-links                          | 📋     | P1       | S    | 0.1        |
| 0.6 | Phase close: audit, dashboards, PR + Copilot review         | 📋     | P0       | S    | 0.1-0.5    |

## Tasks

### Task 0.1: Create the branch, pnpm workspace and root manifests

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: S
- **Depends on**: none

#### Description

Bootstrap the workspace skeleton: root manifest, workspace file, and minimal `apps/api` / `apps/web` package stubs that compile, so every later gate runs against real workspace members.

#### Acceptance criteria

- [x] Branch `feat/phase-00-repo-foundation` created with `git switch -c`.
- [x] Root `package.json`: `private: true`, `engines.node ">=24"`, scripts `typecheck` / `lint` / `build` / `test` fanning out via `pnpm -r --workspace-concurrency=1`.
- [x] `pnpm-workspace.yaml` covers `apps/*`.
- [x] `apps/api` (name `@nest-realtime-example/api`) and `apps/web` (name `@nest-realtime-example/web`) exist with `private: true`, a compiling `src/index.ts` placeholder and per-app scripts.
- [x] `.npmrc` with `engine-strict=true`; `.gitignore` for node/dist/next/env files.
- [x] `pnpm install && pnpm typecheck && pnpm build` succeed from a clean clone.

#### Files to create / modify

- `package.json`, `pnpm-workspace.yaml`, `.npmrc`, `.gitignore`
- `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/src/index.ts`
- `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/src/index.ts`

#### Agent prompt

```
You are a senior TypeScript platform engineer working on nest-realtime-example.

PROJECT: nest-realtime-example, the canonical reference app for @bymax-one/nest-realtime
(dual-transport realtime for NestJS 11). pnpm workspace: apps/api (NestJS 11) + apps/web
(Next.js 16). Node >= 24. Repo is private today, public later.

CURRENT PHASE: 00 (repo-foundation), Task 0.1 of 6 (FIRST).

PRECONDITIONS
- main contains only docs/ (spec, plan, tasks, design_system.html). No code yet.

REQUIRED READING (only these)
- docs/DEVELOPMENT_PLAN.md, section "Phase 00: repo-foundation" and §4 Global conventions.
- docs/TECHNICAL_SPECIFICATION.md §6 (repository layout).

TASK
Create the working branch and the pnpm workspace skeleton with root manifests and two
compiling app stubs.

DELIVERABLES
1. Create the branch FIRST: `git switch -c feat/phase-00-repo-foundation` (NEVER `git checkout -b`).
2. Root `package.json`: private true, engines node >=24, packageManager pnpm, scripts:
   "typecheck", "lint", "build", "test" implemented as `pnpm -r --workspace-concurrency=1 run <script>`.
3. `pnpm-workspace.yaml` with `packages: ["apps/*"]`.
4. `apps/api/package.json` (@nest-realtime-example/api, private) and `apps/web/package.json`
   (@nest-realtime-example/web, private), each with typecheck/lint/build/test scripts (test may
   be a placeholder echoing "no tests yet" ONLY if the root test script still passes; prefer
   jest/vitest configs arriving in later tasks).
5. Minimal `src/index.ts` in each app with a `@fileoverview` header so typecheck/build are real.
6. `.npmrc` (engine-strict=true), `.gitignore` (node_modules, dist, .next, .env*, coverage).

Constraints:
- TypeScript strict mode everywhere; no `any`; no suppression comments.
- Timeless comments only (no plan/phase references in committed files).
- English-only code and comments. No em dashes anywhere.
- No .gitkeep, no empty directories, no secrets.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- `pnpm install` exit 0.
- `pnpm typecheck && pnpm build` exit 0.
- `git status` clean after commit `chore(repo): scaffold pnpm workspace (0.1)`.

Completion Protocol:
1. Set this task's Status to ✅ here and in the Task index; tick all acceptance boxes.
2. Bump the header Progress (1/6).
3. Update the Phase 00 row in docs/DEVELOPMENT_PLAN.md §1 (canonical dashboard).
4. Append `- 0.1 ✅ <date> workspace scaffold` to the Completion log.
5. Commit with Conventional Commits; no attribution trailers.
```

### Task 0.2: Strict TypeScript, ESLint flat config and Prettier

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: 0.1

#### Description

Wire the strict compiler and lint floor the whole repo inherits: shared `tsconfig.base.json`, per-app tsconfigs, ESLint flat config with the Bymax banned-import rules and the subpath-boundary rules, Prettier.

#### Acceptance criteria

- [x] `tsconfig.base.json`: `strict`, `noImplicitAny`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, ES2022, NodeNext for the api.
- [x] ESLint flat config at root with per-app overrides; zero-warning policy (`--max-warnings 0`).
- [x] Banned imports enforced: `axios`, `bcrypt`, `jsonwebtoken`, `moment`, `lodash`, `uuid`, `passport`, `dotenv`.
- [x] Boundary rules: `apps/web` may not import `@bymax-one/nest-realtime` (server subpath); `apps/api` may not import `@bymax-one/nest-realtime/react`.
- [x] Prettier config + `pnpm lint` and `pnpm format:check` green.

#### Files to create / modify

- `tsconfig.base.json`, `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`
- `apps/api/tsconfig.json`, `apps/web/tsconfig.json` (extend base)

#### Agent prompt

```
You are a senior TypeScript tooling engineer working on nest-realtime-example.

PROJECT: nest-realtime-example (reference app for @bymax-one/nest-realtime). pnpm workspace,
apps/api (NestJS 11, NodeNext) + apps/web (Next.js 16). Branch feat/phase-00-repo-foundation.

CURRENT PHASE: 00, Task 0.2 of 6 (MIDDLE).

PRECONDITIONS
- Task 0.1 done: workspace + app stubs compile.

REQUIRED READING (only these)
- docs/DEVELOPMENT_PLAN.md §4 (global conventions).
- docs/TECHNICAL_SPECIFICATION.md §5 (tech stack), §8.2 (subpath boundaries).

TASK
Add the strict TS base config, ESLint flat config (banned imports + subpath boundary rules),
and Prettier, all green.

DELIVERABLES
1. tsconfig.base.json with strict, noImplicitAny, noUncheckedIndexedAccess,
   exactOptionalPropertyTypes, ES2022 target; api tsconfig uses module/moduleResolution NodeNext;
   web tsconfig follows Next.js 16 defaults extending the base.
2. eslint.config.mjs (flat) covering both apps: typescript-eslint strict rules, import ordering,
   `no-restricted-imports` banning axios/bcrypt/jsonwebtoken/moment/lodash/uuid/passport/dotenv,
   and boundary rules: in apps/web forbid '@bymax-one/nest-realtime' (server) allowing '/react'
   and '/shared'; in apps/api forbid '@bymax-one/nest-realtime/react'.
3. Prettier config + ignore; root scripts `lint` (`--max-warnings 0`) and `format:check`.

Constraints:
- Zero warnings policy. No suppression comments anywhere.
- Timeless comments; English only; no em dashes.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- `pnpm lint` exit 0 with zero warnings.
- `pnpm typecheck` exit 0.
- A scratch file importing 'axios' fails lint (delete the scratch after proving; do not commit it).

Completion Protocol: same 5 steps as Task 0.1 (status, index, header progress, plan §1 row, log, Conventional commit `chore(tooling): strict ts + eslint + prettier (0.2)`).
```

### Task 0.3: husky, commitlint, lint-staged and .gitmessage

- **Status**: ✅ Done
- **Priority**: P1
- **Size**: S
- **Depends on**: 0.1

#### Description

Local governance: Conventional Commits enforced at commit time, staged files linted/formatted, commit template with the repo's scopes.

#### Acceptance criteria

- [x] `.husky/pre-commit` runs lint-staged; `.husky/commit-msg` runs commitlint.
- [x] `commitlint.config.cjs` extends `@commitlint/config-conventional`.
- [x] lint-staged: eslint --fix + prettier --write on staged TS/JS/MD/JSON.
- [x] `.gitmessage` documents types + scopes (repo, api, web, infra, docs, ci).
- [x] A test commit with a malformed message is rejected locally (proven, then discarded).

#### Files to create / modify

- `.husky/pre-commit`, `.husky/commit-msg`, `commitlint.config.cjs`, `.gitmessage`, root `package.json` (lint-staged block, `prepare` script)

#### Agent prompt

```
You are a senior developer-experience engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. Branch feat/phase-00-repo-foundation.

CURRENT PHASE: 00, Task 0.3 of 6 (MIDDLE).

PRECONDITIONS
- Tasks 0.1-0.2 done (workspace, eslint, prettier).

REQUIRED READING (only these)
- docs/DEVELOPMENT_PLAN.md §4 items 1 and 8.

TASK
Wire husky + commitlint + lint-staged + .gitmessage so Conventional Commits and formatting
are enforced locally.

DELIVERABLES
1. husky init with pre-commit (lint-staged) and commit-msg (commitlint --edit) hooks.
2. commitlint.config.cjs extending @commitlint/config-conventional.
3. lint-staged config in root package.json (eslint --fix + prettier --write).
4. .gitmessage template listing types (feat/fix/chore/docs/refactor/test/ci) and scopes
   (repo, api, web, infra, docs, ci); set `git config commit.template .gitmessage` locally.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- English only; no em dashes; timeless comments.

Verification:
- `echo "bad message" | pnpm commitlint` exits non-zero.
- A staged badly-formatted file is auto-fixed on commit.
- Commit `chore(repo): local commit governance (0.3)` passes the hooks.

Completion Protocol: standard 5 steps (status, index, header, plan §1, log, commit).
```

### Task 0.4: CI from day one plus visibility-gated security workflows

- **Status**: 🟡 Partial
- **Priority**: P0
- **Size**: M
- **Depends on**: 0.2

#### Description

The heart of the phase: `ci.yml` gates every PR from now on. CodeQL and Scorecard are committed complete but conditioned on the repository being public, so they activate automatically at flip time without edits.

#### Acceptance criteria

- [x] `.github/workflows/ci.yml`: on pull_request + push to main; jobs sequential: install (pnpm cache), typecheck, lint, unit (`--passWithNoTests` for now, both apps sequentially), build. Node 24, pnpm pinned.
- [x] `.github/workflows/codeql.yml` and `.github/workflows/scorecard.yml` complete, each job guarded by `if: ${{ !github.event.repository.private }}`.
- [x] `.github/dependabot.yml` for npm (weekly, grouped) + github-actions.
- [x] Actions pinned by SHA; least-privilege `permissions:` blocks.
- [ ] The phase PR (opened in 0.6) shows ci green and codeql/scorecard skipped.

#### Files to create / modify

- `.github/workflows/ci.yml`, `.github/workflows/codeql.yml`, `.github/workflows/scorecard.yml`, `.github/dependabot.yml`

#### Agent prompt

```
You are a senior CI engineer working on nest-realtime-example.

PROJECT: nest-realtime-example, pnpm workspace (apps/api Jest, apps/web Vitest later).
Repo PRIVATE today, PUBLIC later: security workflows must be committed now but skipped
while private. Branch feat/phase-00-repo-foundation.

CURRENT PHASE: 00, Task 0.4 of 6 (MIDDLE).

PRECONDITIONS
- Tasks 0.1-0.2 done; root scripts typecheck/lint/build/test exist.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §19 (CI and repository visibility).
- docs/DEVELOPMENT_PLAN.md §3 (test discipline: sequential suites).

TASK
Create ci.yml (always on) and the visibility-gated codeql.yml + scorecard.yml + dependabot.

DELIVERABLES
1. ci.yml: triggers pull_request + push(main); single job or sequential jobs running:
   pnpm install (with store cache), pnpm typecheck, pnpm lint, unit tests per app run
   SEQUENTIALLY (`pnpm --filter @nest-realtime-example/api test -- --passWithNoTests` then web),
   pnpm build. Node 24. Actions pinned by commit SHA. `permissions: contents: read`.
2. codeql.yml (javascript-typescript) and scorecard.yml, both with
   `if: ${{ !github.event.repository.private }}` on every job so a private repo skips cleanly.
3. dependabot.yml: npm weekly grouped minor/patch, github-actions weekly.

Constraints:
- Test steps are SEQUENTIAL, never parallel across apps (memory safety).
- The `--passWithNoTests` allowance is temporary and is removed by the first real spec (phase 01).
- No secrets. Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- English only; no em dashes; timeless comments in workflow comments.

Verification:
- `actionlint` (if available) or YAML parse passes on the three workflows.
- Commit `ci(repo): pipeline from day one + gated security workflows (0.4)`.

Completion Protocol: standard 5 steps.
```

### Task 0.5: README skeleton and docs cross-links

- **Status**: 📋 ToDo
- **Priority**: P1
- **Size**: S
- **Depends on**: 0.1

#### Description

A professional README shell: what the repo is, the lib it demonstrates, the docs map, quick-start placeholder, badges placeholders (activated when public). It is completed in phase 10.

#### Acceptance criteria

- [ ] `README.md`: title, one-paragraph mission (canonical reference app exercising every library feature), docs table linking spec/plan/tasks/design system, quick-start section marked "lands in phase progression", license note (repo is an example app, MIT).
- [ ] `LICENSE` (MIT) present.
- [ ] All relative links resolve.

#### Files to create / modify

- `README.md`, `LICENSE`

#### Agent prompt

```
You are a senior technical writer working on nest-realtime-example.

PROJECT: nest-realtime-example, the canonical reference app for @bymax-one/nest-realtime.
Branch feat/phase-00-repo-foundation.

CURRENT PHASE: 00, Task 0.5 of 6 (MIDDLE).

PRECONDITIONS
- Tasks 0.1 done. docs/ contains TECHNICAL_SPECIFICATION.md, DEVELOPMENT_PLAN.md, tasks/, design_system.html.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §1 (purpose) and §2 (goals).

TASK
Write the README skeleton and add the MIT LICENSE.

DELIVERABLES
1. README.md: project mission (mirror spec §1 in two paragraphs, own words), a "Documentation"
   table (spec, plan, tasks index, design system), a "Status" line pointing at the plan
   dashboard, quick-start placeholder, MIT license footer. Public-grade tone; the repo will be
   public, write for external readers. No internal project references.
2. LICENSE: MIT, holder "Bymax One".

Constraints:
- English only; no em dashes; professional, concise.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Markdown link check on README passes (all relative links exist).
- Commit `docs(repo): readme skeleton + license (0.5)`.

Completion Protocol: standard 5 steps.
```

### Task 0.6: Phase close: audit, dashboards, PR with Copilot review

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: 0.1-0.5

#### Description

Close the phase: verify every acceptance criterion, sync dashboards, open the PR, request the GitHub Copilot review, address all findings, merge on green.

#### Acceptance criteria

- [ ] Every task 0.1-0.5 is ✅ with criteria ticked.
- [ ] Phase header + plan §1 dashboard + tasks README index all show 6/6.
- [ ] PR opened, Copilot review requested, all findings addressed.
- [ ] CI green; codeql/scorecard skipped (private); merged with `--squash --delete-branch`.

#### Files to create / modify

- This file, `../DEVELOPMENT_PLAN.md`, `README.md` of tasks folder

#### Agent prompt

```
You are the phase-close engineer for nest-realtime-example.

PROJECT: nest-realtime-example. Branch feat/phase-00-repo-foundation.

CURRENT PHASE: 00, Task 0.6 of 6 (LAST: phase close).

PRECONDITIONS
- Tasks 0.1-0.5 report done.

REQUIRED READING (only these)
- docs/tasks/phase-00-repo-foundation.md (this file, all acceptance criteria).
- docs/tasks/README.md "Branch and PR workflow".

TASK
Audit the phase, sync the three dashboards, and drive the PR to merge.

DELIVERABLES
1. Re-verify each task's acceptance criteria by running its Verification commands; fix or
   reopen any red item before proceeding.
2. Update: this file's header (6/6, ✅), docs/DEVELOPMENT_PLAN.md §1 Phase 00 row, docs/tasks/README.md index.
3. `gh pr create` with a professional English title (`feat: repository foundation and CI`) and a
   body summarizing deliverables and verification results.
4. Request the GitHub Copilot code review on the PR; address EVERY finding (all severities),
   pushing fixes to the branch; re-request review after fixes.
5. Merge only when CI is green and the review has no unresolved findings:
   `gh pr merge --squash --delete-branch`. Then `git switch main && git pull`.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Never merge with failing CI; never bypass hooks.

Verification:
- `gh pr checks` all green before merge; branch deleted locally and remotely after merge.

Completion Protocol: standard steps + append the phase-completion line to the Completion log.
```

## Completion log

<!-- append: - N.M ✅ YYYY-MM-DD one-line summary -->

- 0.1 ✅ 2026-07-09 workspace scaffold
- 0.2 ✅ 2026-07-09 strict tsconfig base + eslint flat config + prettier, repo-wide format pass
- 0.3 ✅ 2026-07-09 husky pre-commit/commit-msg hooks + commitlint + lint-staged + .gitmessage
- 0.4 🟡 2026-07-09 ci.yml + gated codeql/scorecard + dependabot committed; final PR-green check lands in 0.6
