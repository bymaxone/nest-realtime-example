# Autopilot Config — nest-realtime-example

> Per-project parameters for /bymax-workflow:autopilot. Reviewed and
> approved by the operator before the first run. The planning docs own WHAT
> to build; this file owns HOW the chain runs.

## Identity

- **Project root**: /Users/maximiliano/Documents/MyApps/bymax-one/nest-realtime-example
- **GitHub repo**: bymaxone/nest-realtime-example (visibility: private → will become public)
- **Default branch**: main
- **Product summary**: The canonical reference implementation of the
  `@bymax-one/nest-realtime` library. A pnpm monorepo (`apps/api` NestJS +
  `apps/web` Next.js 16) that exercises every exported symbol, transport
  (SSE / WebSocket / both), auth pattern, replay path, cluster behavior and
  error code of the library — proven by routes, UI pages and tests against the
  §7 Feature Coverage Matrix. Defining constraint: **library-first** — all
  realtime behavior comes exclusively from the library; the example only
  supplies the sanctioned Redis-backed storage implementations
  (`IRealtimePubSub`, `IOfflineQueueStorage`, `IPresenceStorage`).
- **Roadmap file**: docs/DEVELOPMENT_PLAN.md (canonical dashboard, §1)
- **Tasks index**: docs/tasks/README.md (mirror only)
- **Phases**: 11 phases (00–10) / 60 tasks (phase files docs/tasks/phase-NN-*.md)

## External preconditions

| Applies to | Check (exit 0 = OK)        | On failure                                                                                                                      |
| ---------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| launch     | `docker info`              | STOP — operator starts Docker (redis:7 + compose profiles are needed from phase 01 onward for infra, E2E and the cluster suite) |
| phases 1+  | `test -d ../nest-realtime` | mark phase ⛔ blocked on missing sibling library checkout, STOP                                                                 |

**Note:** `@bymax-one/nest-realtime` is **not published to npm** (verified at
init). The library is consumed via a local `file:` link to the sibling
checkout (`../nest-realtime`) per spec §8.1. The pinned-version switch
(file: → published version) is deferred to phase 10 and executed only if the
library has published by then — it never renumbers the plan or blocks the chain.

**Library build state:** the sibling checkout is present (git
`@bymax-one/nest-realtime` v0.1.0, subpaths `.` / `./shared` / `./react`).
Its `exports` all point to `./dist/**`, and the package has no
`prepare`/`postinstall` hook (only `build` and `prepublishOnly`), so a plain
`file:` install does NOT produce `dist/`. The library was **built locally on
2026-07-09** (`pnpm install && pnpm build`), so all nine export targets now
resolve and the Phase 01 subpath probe passes on this machine. Because a
clean clone / CI runner will NOT have that `dist/`, **Phase 01 must still
build the sibling as part of its setup** — run
`pnpm -C ../nest-realtime install && pnpm -C ../nest-realtime build` before
wiring the `file:` link and running the subpath probe. The plan's own DoD
("Phase 01 verifies the sibling checkout builds") covers this.

## Model policy

| Phase                     | Model   | Rationale                                                                                                                             |
| ------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 00 repo-foundation        | sonnet  | mechanical scaffold on a fully specified checklist (workspace, tooling, husky, CI)                                                    |
| 01 infra-and-library-link | inherit | first contact with the consumed library — subpath resolution + `file:` link + typed env; invented APIs are the failure mode           |
| 02 sse-foundation         | inherit | security-sensitive (HMAC-signed HttpOnly session cookies via `node:crypto`, tenant isolation) + first canonical `forRootAsync` wiring |
| 03 auth-policies-rooms    | inherit | security-sensitive: tickets, reauth/revocation, FIFO eviction, anti-IDOR tenant guard, decorator/hook ordering                        |
| 04 replay-and-offline     | inherit | correctness-critical: `IOfflineQueueStorage` impl, `Last-Event-ID` replay ordering, buffer-miss fallback semantics                    |
| 05 scaling-cluster        | inherit | correctness-critical: `IRealtimePubSub` loop prevention (origin self-filter), cross-instance revocation, graceful degradation         |
| 06 websocket-transport    | inherit | security-sensitive: bearer handshake auth, sticky sessions, redis-adapter, payload guard; transport-parity assertion                  |
| 07 both-composite         | sonnet  | composition on established wiring — small phase, one emit two transports                                                              |
| 08 web-frontend           | sonnet  | UI pages on an established API + copied design system, built on `./react` hooks                                                       |
| 09 testing-quality        | inherit | judgment-heavy: 100% coverage both apps, full E2E orchestration (SSE/WS/cluster), Playwright, memory-safe sequencing                  |
| 10 docs-audit-hardening   | inherit | final audit + hardening: §7 matrix verification, export-usage audit, Stryker survivor hardening                                       |

**Heavy phases** (silent-death watch widened to ~120 min): **05, 06, 08,
09, 10** — these pull container images / run the compose cluster stack,
install Playwright browsers, run full E2E suites, or run Stryker mutation.

Fix sub-agents always escalate to `inherit` when a phase stalls on review/CI
findings, regardless of the phase's build-time model.

## Gates

The implementer must pass these local gates before opening the phase PR. The
CI pipeline (`ci.yml`) grows by phase; job names become contractual once
branch protection references them.

| Gate (local command)                                                                                                                   | Active from |
| -------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `pnpm typecheck` (strict, no `any`, no suppression)                                                                                    | phase 00    |
| `pnpm lint` (ESLint flat, zero warnings, forbidden-import rules)                                                                       | phase 00    |
| `pnpm format:check` (Prettier)                                                                                                         | phase 00    |
| `pnpm build`                                                                                                                           | phase 00    |
| `pnpm test` (unit; `--passWithNoTests` until real specs land)                                                                          | phase 00    |
| subpath probe spec (`.`, `./shared`, `./react` resolve in ESM + CJS)                                                                   | phase 01    |
| `docker compose up -d redis` healthy                                                                                                   | phase 01    |
| `pnpm --filter api test` (Jest, 100% coverage pinned, `maxWorkers: '50%'`)                                                             | phase 02    |
| `pnpm --filter web test` (Vitest, 100% coverage pinned, `maxWorkers: '50%'`)                                                           | phase 08    |
| `pnpm --filter web build` (Next build clean) + SSE-only bundle assertion (no `socket.io-client`)                                       | phase 08    |
| Playwright smoke journey per page                                                                                                      | phase 08    |
| full E2E: every HTTP route, SSE (`eventsource`), WS (`socket.io-client`), cluster suite (compose profile, run **alone**, sequentially) | phase 09    |
| `pnpm --filter api test:mutation` (Stryker, `break: 95` minimum)                                                                       | phase 10    |

**Memory safety (every phase):** one suite at a time; `maxWorkers: '50%'`
pinned in every Jest/Vitest config; `NODE_OPTIONS=--max-old-space-size=4096`
as a guard; the cluster E2E never runs concurrently with unit suites; one
compose stack at a time (`docker compose down` between profile switches —
ports 3001/3002/8080/6379 collide).

**Expected-skip CI checks**: `codeql.yml` and `scorecard.yml` are committed
from phase 00 but gated on `if: ${{ !github.event.repository.private }}`.
While the repo is private they report **skipping** and count as pass, never
as a failure. The cluster E2E job is behind `workflow_dispatch` until stable
(a non-run is not a failure).

## Invariant greps

Each command must print nothing (run in every implementer's phase-wide gate).

```bash
# No suppression comments anywhere in app source
grep -rn "@ts-ignore\|@ts-nocheck\|eslint-disable\|@ts-expect-error" apps/ --include='*.ts' --include='*.tsx'

# api must never import the react subpath
grep -rn "nest-realtime/react" apps/api/src

# web must never import the server/root subpath (only ./react and ./shared allowed)
grep -rEn "from '@bymax-one/nest-realtime'" apps/web/src

# No em dashes in committed source (project convention: no em dashes anywhere)
grep -rn "—" apps/ --include='*.ts' --include='*.tsx'

# No placeholder files (global rule)
find . -name '.gitkeep' -o -name '.keep' | grep -v node_modules
```

## Security invariants & review focus

From the spec's security section and the library's documented invariants.
`/security-review` and `/bymax-quality:code-review` must treat these as
auditable statements:

- **Session cookies are credentials.** HMAC-signed HttpOnly cookies use a
  secret sourced from env only; the secret and raw cookie value are never
  logged and never surfaced in any UI/error output.
- **Tickets are one-shot credentials.** Issued with a 60s TTL, consumed via
  Redis `GETDEL` (reuse must fail); never logged, never returned twice.
- **Bearer tokens are credentials** (WS `handshake.auth.token`): never logged.
- **`connection:established` carries only client-safe traits** — never
  internal identifiers, secrets, or other tenants' data.
- **Anti-IDOR tenant isolation is absolute.** `emitToTenant` and room joins
  are tenant-guarded; a user can never receive another tenant's events
  (proven by the two-tenant isolation E2E).
- **Revocation is authoritative.** Reauth checks a Redis revocation set;
  revoking a connection (including one owned by another instance) closes it.
- **SSE auth uses cookie/ticket only** — EventSource cannot send custom
  headers; do not invent header-based SSE auth.
- **No secrets in code**; demo values only; the secret scan stays clean.

**Per-phase review focus** (the model-policy `inherit` security phases):

- Phase 02: HMAC cookie signing/verification, HttpOnly flags, tenant isolation.
- Phase 03: ticket one-shot semantics, revocation timing, anti-IDOR guard,
  FIFO eviction (`REALTIME_TOO_MANY_CONNECTIONS`, never a 429).
- Phase 05: cross-instance revocation, pub/sub loop prevention, degradation.
- Phase 06: bearer handshake auth, sticky-session correctness, payload guard
  (`REALTIME_PAYLOAD_TOO_LARGE`).

## Review bot

- **Reviewer**: `copilot-pull-request-reviewer[bot]` (request with
  `gh pr edit <PR#> --add-reviewer copilot-pull-request-reviewer[bot]`).
- **Review-bot timeout**: 15 minutes — a request pending this long with no
  review submitted is treated as bot-unresponsive: the request is removed,
  a factual PR comment records it, and the gate proceeds CI-only (the
  implementer's zero-findings review floor already ran before the PR).

## Merge policy

- **Method**: squash (delete branch on merge — always, remote + local, proven
  with `git ls-remote` / `git branch --list` printing nothing).
- **Grace window**: 5 minutes since last push (measured concretely).
- **Review-bot timeout**: 15 minutes (see Review bot above).
- **Stall limit**: 3 full fix cycles on the same phase without progress →
  🟡/⛔ with the exact failing gate + notify + STOP. Never brute-force.
- **No suppression / no force-green**: never `--no-verify`, `@ts-ignore`,
  `eslint-disable`, skipped hooks, or weakened thresholds to pass a gate.

## Custom conventions

Beyond /bymax-workflow:standards and the plan's §4 global conventions:

- **Frontend boundary (lint-enforced):** `apps/web` imports only the
  `./react` and `./shared` subpaths; `apps/api` never imports `./react`.
- **Design-system files are verbatim copies** from a sibling example
  (`nest-cache-example` / `nest-logger-example`) — copy, do not redesign;
  the app must be visually consistent with the sibling dashboards (spec §14).
- **Library-first boundary:** never reimplement transports, replay, or
  connection tracking — the only sanctioned consumer-side realtime code is
  the Redis-backed storage implementations of the library's interfaces.
- **Library APIs are never invented:** the library's published README + spec
  are the source; where they differ, the README of the version in the
  lockfile wins.
- **No em dashes** anywhere (code, comments, docs, commits).
- **Timeless comments:** never reference plan phases or task ids in committed
  source or `.github` config (spec-section references are allowed).
- **Branches:** `git switch -c feat/phase-NN-<slug>` (never `git checkout -b`).
- **Commits/PRs:** Conventional Commits; **no** AI-attribution / `Co-Authored-By`
  / "Generated with" lines anywhere (commits, PR titles, bodies, comments).
