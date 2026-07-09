# Phase 08: web-frontend

> **Status**: 📋 ToDo · **Progress**: 0 / 6 tasks · **Last updated**: 2026-07-06
> **Source roadmap**: [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) §5 (Phase 08)
> **Source spec**: [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md) §13, §14

## Context

The face of the example: a Next.js 16 dashboard built exclusively on `@bymax-one/nest-realtime/react` and `/shared`, following the shared design system (`docs/design_system.html`, the standard established across the sibling examples). Every library hook, every lab built in phases 02-07 gets its page. The bundle assertion (SSE-only build free of socket.io-client) is the technical star. Matrix rows landed: 56-66.

## Rules-of-phase

1. `apps/web` imports only `/react` and `/shared` subpaths (lint rule from phase 00 enforces it).
2. The design system files are copied verbatim from a sibling `apps/web` per the design system document; visual structure must match the sibling dashboards (spec §14 acceptance criterion).
3. All realtime data flows through the library hooks; the REST client is for commands and lab reads only.
4. Unit tests (Vitest + RTL) mock transports; Playwright uses the real backend.
5. Standard global conventions (plan §4).

## Reference docs

- Spec §13 (pages, data layer, components), §14 (design system); `docs/design_system.html`; library README: hook APIs.

## Task index

| ID  | Task                                                         | Status | Priority | Size | Depends on    |
| --- | ------------------------------------------------------------ | ------ | -------- | ---- | ------------- |
| 8.1 | Branch + Next.js skeleton + design system + shell + provider | 📋     | P0       | L    | Phase 02      |
| 8.2 | Live feed, broadcast console, audit pages                    | 📋     | P0       | M    | 8.1           |
| 8.3 | Connections/eviction + replay lab pages                      | 📋     | P0       | M    | 8.2, Phase 04 |
| 8.4 | Ticket lab, connection lab, presence pages                   | 📋     | P0       | M    | 8.2, Phase 05 |
| 8.5 | Chat, cluster, both pages + bundle assertion                 | 📋     | P0       | M    | Phase 07      |
| 8.6 | Phase close: audit, dashboards, PR + Copilot review          | 📋     | P0       | S    | 8.1-8.5       |

## Tasks

### Task 8.1: Next.js skeleton, design system, shell and provider

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: L
- **Depends on**: Phase 02

#### Description

The web foundation: Next.js 16 App Router replacing the stub, the design-system files copied verbatim, the app shell (nav, layout, status primitives), `RealtimeProvider` at the shell with the global connection badge, the typed API client, and the shared event-type module.

#### Acceptance criteria

- [ ] Branch `feat/phase-08-web-frontend` created with `git switch -c`.
- [ ] Design-system files copied per `docs/design_system.html` guidance (tokens, tailwind preset, shell, status primitives); shell visually consistent with the sibling examples.
- [ ] `RealtimeProvider` wraps the app (SSE URL from env); `useRealtimeConnection` badge in the header shows live status.
- [ ] Typed `LiveEvents` map (order/deployment/chat/lab events) in one module, imported by every page; REST client with credentialed fetch.
- [ ] Demo login page (sets the cookie via the api) so the browser flows work.
- [ ] Vitest units for the shell pieces; build green.

#### Files to create / modify

- `apps/web/src/app/` (layout, login, providers), `apps/web/src/components/`, `apps/web/src/lib/{api-client.ts,events.ts}`
- design-system files under `apps/web/src/` per the design system doc

#### Agent prompt

```
You are a senior React/Next.js engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. Next.js 16 dashboard consuming ONLY
@bymax-one/nest-realtime/react and /shared, on the shared Bymax example design system.

CURRENT PHASE: 08 (web-frontend), Task 8.1 of 6 (FIRST).

PRECONDITIONS
- Phase 02+ merged on the api side. docs/design_system.html present in this repo. A sibling
  example (nest-cache-example) has the four design-system files to copy verbatim from its
  apps/web.

REQUIRED READING (only these)
- docs/design_system.html (identity, files to copy, shell rules).
- Library README: RealtimeProvider, useRealtimeConnection, useRealtime option shapes.
- docs/TECHNICAL_SPECIFICATION.md §13.1, §13.3.

TASK
Create the branch and the web foundation: skeleton, design system, shell, provider, typed
events, api client, login page.

DELIVERABLES
1. `git switch -c feat/phase-08-web-frontend`.
2. Next.js 16 App Router setup in apps/web (replace the stub; keep the package name).
3. Copy the design-system files exactly as the design system document instructs; apply the
   shell (nav with the §13.2 routes, dark-first tokens, status chips).
4. providers.tsx: RealtimeProvider with url NEXT_PUBLIC_API_URL + the configured SSE path;
   header ConnectionBadge from useRealtimeConnection (status colors from the design system).
5. lib/events.ts: the LiveEvents typed map (order.created/paid/shipped, deployment.*,
   chat.message, lab events) used by every useRealtime call; lib/api-client.ts with
   credentials: 'include'.
6. /login page posting to /auth/login (demo users listed) + logout button in the shell.
7. Vitest + RTL units for ConnectionBadge and the provider wiring (transport mocked).

Constraints:
- apps/web must not import the server subpath (lint enforces; do not fight the rule).
- Standard repo constraints (strict TS no any/suppressions, sizes, headers, JSDoc on exports,
  timeless comments, English, no em dashes, bounded sequential tests, no .gitkeep).
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- `pnpm --filter @nest-realtime-example/web test` then `build` green (after api suites, never
  concurrently).
- Manual: login -> badge goes connected against a running api.
- Commit `feat(web): skeleton + design system + realtime shell (8.1)`.

Completion Protocol: task status ✅ + checkboxes; Task index; header Progress; Phase 08 row in
docs/DEVELOPMENT_PLAN.md §1; Completion log; Conventional commit, no attribution.
```

### Task 8.2: Live feed, broadcast console and audit pages

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 8.1

#### Description

The observe pages: the Live Operations Board (`/`) rendering order/deployment events through `useRealtime`, the broadcast console (`/broadcast`) driving tenant/user/room/broadcast emits with the anti-IDOR failure surfaced, and the audit feed (`/audit`).

#### Acceptance criteria

- [ ] `/`: live feed with the event inspector (type, id, payload, arrival time), simulate buttons calling the domain endpoints; events stream in without refresh.
- [ ] `/broadcast`: emit forms for the four scopes; cross-tenant attempt renders the 403 envelope; success shows delivery confirmation via the local echo.
- [ ] `/audit`: audit entries with kind filters, duration on disconnect entries, decorator counters widget.
- [ ] Vitest units per page (hooks mocked); every `it()` commented.

#### Files to create / modify

- `apps/web/src/app/{page.tsx,broadcast/page.tsx,audit/page.tsx}` + components

#### Agent prompt

```
You are a senior React engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. The observe pages: live feed, broadcast console, audit.

CURRENT PHASE: 08, Task 8.2 of 6 (MIDDLE).

PRECONDITIONS
- Task 8.1 done (shell, provider, events map, api client).

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §13.2 rows for /, /broadcast, /audit; §13.3 components.
- Library README: useRealtime events map usage.

TASK
Build the three pages with design-system components and their units.

DELIVERABLES
1. / : useRealtime over the LiveEvents map; EventInspector component (last 50, newest first,
   id monospace); simulate buttons (POST /domain/orders/simulate, /domain/deployments/simulate).
2. /broadcast: four emit cards (user/tenant/room/broadcast) with zod-mirrored client validation;
   error envelope rendering for 403 cross-tenant; role-gated broadcast card.
3. /audit: table over GET /audit/feed with kind filter chips + the decorator-stats widget.
4. Vitest units: inspector ordering, 403 rendering, filter behavior (hooks/api mocked).

Constraints:
- All realtime data via the hooks; REST only for commands/reads. Standard repo constraints.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Web unit suite + build green; commit `feat(web): observe pages (8.2)`.

Completion Protocol: standard steps.
```

### Task 8.3: Connections, eviction and replay lab pages

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 8.2, Phase 04

#### Description

The resilience pages: `/connections` (registry, kill switch, eviction visualizer with the FIFO timeline) and `/labs/replay` (burst, drop, reconnect, replay diff viewer distinguishing buffer/queue/gap ranges).

#### Acceptance criteria

- [ ] `/connections`: live table of the instance's connections; disconnect button per row (confirmation dialog); eviction timeline rendered from `/labs/eviction/timeline`; opening extra tabs live-demos FIFO (guidance copy included).
- [ ] `/labs/replay`: controls for emit-burst/drop; the replay diff viewer tags each received range (live, buffer replay, queue replay, gap) using the timeline endpoint; `lastEventId` shown live.
- [ ] Vitest units for the timeline/diff components.

#### Files to create / modify

- `apps/web/src/app/{connections/page.tsx,labs/replay/page.tsx}` + components

#### Agent prompt

```
You are a senior React engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. Resilience pages: connections/eviction + replay lab.

CURRENT PHASE: 08, Task 8.3 of 6 (MIDDLE).

PRECONDITIONS
- Task 8.2 done; api phases 03-04 merged (timeline endpoints exist).

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §13.2 rows for /connections and /labs/replay; §12.3, §12.4.

TASK
Build the two pages + components + units.

DELIVERABLES
1. /connections: GET /connections polling + realtime refresh on audit events; kill-switch
   button -> POST /connections/:id/disconnect; EvictionTimeline component (connectedAt order,
   evicted reason chips).
2. /labs/replay: burst/drop controls; ReplayDiffViewer consuming the lab timeline + the
   client's own received list (from useRealtime lastEvent accumulation), tagging ranges;
   current lastEventId badge.
3. Vitest units for EvictionTimeline ordering and ReplayDiffViewer tagging logic.

Constraints:
- Standard repo constraints; scenario comments on tests.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Web suite + build green; commit `feat(web): connections + replay labs (8.3)`.

Completion Protocol: standard steps.
```

### Task 8.4: Ticket lab, connection lab and presence pages

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 8.2, Phase 05

#### Description

The hook-surface pages: `/labs/ticket` (`auth.fetchTicket` flow), `/labs/connection` (`autoConnect: false`, manual connect/disconnect, reconnect tuning, attempts counter) and `/presence` (`usePresence` roster).

#### Acceptance criteria

- [ ] `/labs/ticket`: connects via `useRealtime` with `auth.fetchTicket` hitting `POST /auth/ticket`; shows the one-shot behavior (reconnect fetches a fresh ticket).
- [ ] `/labs/connection`: `autoConnect: false`; buttons for `connect()`/`disconnect()`; sliders for `initialDelayMs`/`maxDelayMs`/`maxAttempts`; live `status` + `reconnectAttempts`; a "kill my stream" button (drop endpoint) to watch backoff climb.
- [ ] `/presence`: `usePresence` roster per tenant with online badges updating on connect/disconnect.
- [ ] Matrix rows 59, 60, 61, 64 satisfied; units for the controls.

#### Files to create / modify

- `apps/web/src/app/{labs/ticket/page.tsx,labs/connection/page.tsx,presence/page.tsx}` + components

#### Agent prompt

```
You are a senior React engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. Hook-surface pages: ticket auth, manual connection control,
presence.

CURRENT PHASE: 08, Task 8.4 of 6 (MIDDLE).

PRECONDITIONS
- Task 8.2 done; api phases 03 (ticket) and 05 (presence) merged.

REQUIRED READING (only these)
- Library README: useRealtime auth.fetchTicket, reconnect options, autoConnect, connect/
  disconnect, usePresence.
- docs/TECHNICAL_SPECIFICATION.md §13.2 rows.

TASK
Build the three pages + units.

DELIVERABLES
1. /labs/ticket: useRealtime({ url, auth: { fetchTicket } , events }); a reconnect trigger
   proves a fresh ticket is fetched (render the fetch count).
2. /labs/connection: full manual-control panel per the acceptance criteria; status timeline
   strip (design-system chips per state transition).
3. /presence: usePresence roster grouped by tenant, wired to the provider connection.
4. Vitest units: fetchTicket invocation on (re)connect, control panel state machine, roster
   rendering (hooks mocked).

Constraints:
- Standard repo constraints; scenario comments.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Web suite + build green; commit `feat(web): ticket, connection and presence pages (8.4)`.

Completion Protocol: standard steps.
```

### Task 8.5: Chat, cluster and both pages plus the bundle assertion

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: Phase 07

#### Description

The WS-and-beyond pages: `/chat` (WS via `wss://` URL + `transport` override control), `/labs/cluster` (instance chips + fan-out counters), `/labs/both` (split-screen SSE + WS receiving the same emit), and the bundle proof that `socket.io-client` loads only dynamically.

#### Acceptance criteria

- [ ] `/chat`: `useRealtime` with the WS URL (bearer via the ws-token endpoint); incident room selector (join/leave); message send via the socket (the library's documented client send surface) or the REST fallback if the linked version exposes none client-side (documented choice).
- [ ] `/labs/cluster`: stats cards per instance polling `/labs/cluster/stats` on both ports (direct) or via header echo through nginx; fan-out demo button.
- [ ] `/labs/both`: two panels (SSE connection + WS connection) with one emit button; both panels light up with the same nonce.
- [ ] Bundle assertion: a build-time check proves `socket.io-client` is absent from the initial/SSE-only chunks and present only in the dynamically imported chunk (script under `apps/web/scripts/`, wired to CI).
- [ ] Matrix rows 57, 66 satisfied.

#### Files to create / modify

- `apps/web/src/app/{chat/page.tsx,labs/cluster/page.tsx,labs/both/page.tsx}`, `apps/web/scripts/assert-bundle.mjs`

#### Agent prompt

```
You are a senior React performance-minded engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. WS pages + the bundle honesty check: socket.io-client must
never ship in the SSE-only path.

CURRENT PHASE: 08, Task 8.5 of 6 (MIDDLE).

PRECONDITIONS
- Phase 07 merged (both profile). Tasks 8.1-8.4 done.

REQUIRED READING (only these)
- Library README: useRealtime WS mode (wss URL / transport override), dynamic socket.io-client
  loading contract; client-to-server send surface if any.
- docs/TECHNICAL_SPECIFICATION.md §13.2 rows + §18 bundle gate.

TASK
Build the three pages and the bundle assertion script.

DELIVERABLES
1. /chat: ws-token fetch, useRealtime({ url: NEXT_PUBLIC_WS_URL, transport override control,
   events: { 'chat.message' } }); room join/leave via REST; message composer using the
   documented client send path (fallback: REST emit endpoint, choice documented in JSDoc).
2. /labs/cluster: per-instance stat cards + a tenant-emit button; highlight which instance
   served each received event (payload carries INSTANCE_NAME from the api).
3. /labs/both: two independent hook connections (one http URL, one wss URL) side by side; a
   single emit button; nonce match indicator.
4. scripts/assert-bundle.mjs: after `next build`, walk the client chunks; assert no chunk in
   the initial entrypoints contains 'socket.io-client'; assert some lazy chunk does; exit 1
   otherwise. Add `pnpm --filter web assert:bundle` and call it in ci.yml after web build.
5. Vitest units for the nonce-match logic and the transport override control.

Constraints:
- Standard repo constraints; scenario comments.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Web suite + build + assert:bundle green; commit `feat(web): ws pages + bundle honesty (8.5)`.

Completion Protocol: standard steps.
```

### Task 8.6: Phase close: audit, dashboards, PR with Copilot review

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: 8.1-8.5

#### Description

Standard phase close; PR body lists matrix rows 56-66 and includes screenshots of the shell + two labs for the design-system consistency check.

#### Acceptance criteria

- [ ] Tasks 8.1-8.5 ✅; verifications re-run.
- [ ] Dashboards synced; PR merged on green with Copilot findings addressed; branch deleted.

#### Files to create / modify

- This file, `../DEVELOPMENT_PLAN.md`, `../tasks/README.md`

#### Agent prompt

```
You are the phase-close engineer for nest-realtime-example.

PROJECT: nest-realtime-example. Branch feat/phase-08-web-frontend.

CURRENT PHASE: 08, Task 8.6 of 6 (LAST: phase close).

PRECONDITIONS
- Tasks 8.1-8.5 report done.

REQUIRED READING (only these)
- docs/tasks/phase-08-web-frontend.md; docs/tasks/README.md workflow section.

TASK
Audit, sync dashboards, PR to merge.

DELIVERABLES
1. Re-run Verifications (api suites untouched; web unit, build, assert:bundle). 2. Sync header
(6/6 ✅), plan §1 row, tasks README. 3. `gh pr create` (title `feat: dashboard on the react
subpath with design system`), body with matrix rows 56-66; request GitHub Copilot review;
address every finding; merge on green with `gh pr merge --squash --delete-branch`.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Never merge with failing CI.

Verification: `gh pr checks` green pre-merge; branch deleted after.

Completion Protocol: standard steps + phase completion line.
```

## Completion log

<!-- append: - N.M ✅ YYYY-MM-DD one-line summary -->
