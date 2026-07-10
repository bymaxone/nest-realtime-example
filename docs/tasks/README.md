# Task Files: Index and Conventions

> Per-phase task breakdowns for [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md), which holds the **canonical dashboard** (this index only mirrors it). The product spec is [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md); its §7 Feature Coverage Matrix is the contract every phase serves.

**Status legend:** 📋 ToDo · 🔄 In Progress · 👀 Review · ✅ Done · ⛔ Blocked · 🟡 Partial

## Phase files

| Phase | File                                 | Tasks     | Status | Scope                                                                                                                    |
| ----- | ------------------------------------ | --------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| 00    | `phase-00-repo-foundation.md`        | 6/6       | ✅     | pnpm workspace, strict tooling, husky/commitlint, CI from day one (public-only workflows visibility-gated)               |
| 01    | `phase-01-infra-and-library-link.md` | 5/5       | ✅     | redis:7 compose, Dockerfile, `file:` library link, subpath probe, typed env                                              |
| 02    | `phase-02-sse-foundation.md`         | 6/6       | ✅     | SSE profile end to end: cookie auth, canonical `forRootAsync`, emit console, tenant isolation, audit feed, heartbeat lab |
| 03    | `phase-03-auth-policies-rooms.md`    | 6/6       | ✅     | ticket + bearer patterns, reauth policy, revocation, FIFO eviction, rooms, anti-IDOR, decorators                         |
| 04    | `phase-04-replay-and-offline.md`     | 5/5       | ✅     | Last-Event-ID replay lab, RedisOfflineQueue, buffer-miss fallback, id ordering                                           |
| 05    | `phase-05-scaling-cluster.md`        | 6/6       | ✅     | RedisRealtimePubSub, nginx SSE-safe cluster, loop-prevention counters, cross-instance revocation, degradation, presence  |
| 06    | `phase-06-websocket-transport.md`    | 4/6       | 🔄     | WS profile, IoAdapter namespace, bearer auth, @Subscribe chat, redis-adapter, sticky sessions, payload lab               |
| 07    | `phase-07-both-composite.md`         | 0/4       | 📋     | `both` mode split-screen proof + migration journey                                                                       |
| 08    | `phase-08-web-frontend.md`           | 0/6       | 📋     | Next.js 16 + design system + every page on `./react` hooks + bundle assertion                                            |
| 09    | `phase-09-testing-quality.md`        | 0/5       | 📋     | 100% unit both apps, E2E every flow (HTTP/SSE/WS/cluster), Playwright                                                    |
| 10    | `phase-10-docs-audit-hardening.md`   | 0/5       | 📋     | README journeys, export-usage + matrix audit, Stryker, CI finalization                                                   |
|       | **Total**                            | **38/60** | 🔄     |                                                                                                                          |

## Task-file anatomy

1. **Header:** `# Phase NN: <title>` + blockquote (Status, Progress `0 / N tasks`, Last updated, links to plan and spec sections).
2. **Context:** what the phase delivers; expected repo state at start.
3. **Rules-of-phase:** numbered invariants (from the plan block + global conventions).
4. **Reference docs:** the exact spec/plan sections to read, nothing more.
5. **Task index:** `| ID | Task | Status | Priority | Size | Depends on |` with IDs `N.M`.
6. **Task blocks:** `### Task N.M: <imperative title>` with Status/Priority/Size/Depends bullets, Description, Acceptance criteria (checkboxes), Files to create / modify, and an **Agent prompt** in a four-backtick fence: fully self-contained English (role, PROJECT, CURRENT PHASE, PRECONDITIONS, REQUIRED READING (only these), TASK, DELIVERABLES, Constraints, Verification, Completion Protocol).
7. **Completion log:** append-only, `- N.M ✅ YYYY-MM-DD <one-line summary>`.

## Branch and PR workflow (mandatory, one PR per phase)

1. The FIRST task of each phase creates the branch: `git switch -c feat/phase-NN-<slug>` (never `git checkout -b`).
2. Every task commits on that branch with Conventional Commits: `<type>(<scope>): <subject> (N.M)`.
3. The LAST task of each phase (phase close) audits the acceptance criteria, updates the dashboards, opens the PR via `gh pr create`, requests the **GitHub Copilot code review**, addresses every finding, and merges only with CI green (`gh pr merge --squash --delete-branch`).
4. Never add `Co-Authored-By`, "Generated with", or any AI-attribution line to commits, PR titles, PR bodies, or comments.

## Execution guidance for agents

- **Token economy:** read only your task block plus its REQUIRED READING (use Read offset/limit); never load whole phase files, the whole plan, or the whole spec.
- **Test discipline:** suites run sequentially, `maxWorkers: '50%'` pinned, one compose stack at a time; the cluster E2E always runs alone. Never fan out parallel test agents.
- **Library APIs are never invented:** the library's published README and the spec are the source; where they differ, the README of the version in the lockfile wins.
- **Self-update protocol (end of every task):** task Status ✅ + checkboxes; Task index row; phase header Progress; the matching row in `../DEVELOPMENT_PLAN.md` §1 (canonical); Completion log line; Conventional commit without attribution trailers.
- **Blocked:** set `Status: ⛔` + a `> **Blocker:** ...` note under the task header; never commit destructive workarounds.
