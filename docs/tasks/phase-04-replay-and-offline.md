# Phase 04: replay-and-offline

> **Status**: 📋 ToDo · **Progress**: 0 / 5 tasks · **Last updated**: 2026-07-06
> **Source roadmap**: [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) §5 (Phase 04)
> **Source spec**: [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md) §12.4

## Context

SSE's superpower is recovery: the browser reconnects with `Last-Event-ID` and the server replays what was missed. This phase makes every branch of that story observable: in-buffer replay, buffer eviction (size 10), the buffer-miss fallback into a Redis offline queue, drain-on-reconnect for users who were fully offline, and the id-ordering invariant everything depends on. Matrix rows landed: 23-28, 75.

## Rules-of-phase

1. `RedisOfflineQueue` implements the library's `IOfflineQueueStorage` exactly (append, `retrieveSince`, `acknowledge`); retention (TTL + `maxPerUser`) is enforced in the implementation, unit-proven.
2. Event ids are treated as opaque, lexicographically ordered strings; the ordering spec guards the invariant, never reimplements id generation.
3. Labs return machine-readable timelines (the frontend renders them in phase 08).
4. Standard global conventions (plan §4).

## Reference docs

- Spec §12.4; library README: Last-Event-ID flow, replayBufferSize, IOfflineQueueStorage contract, REALTIME_REPLAY_BUFFER_MISS behavior.

## Task index

| ID | Task | Status | Priority | Size | Depends on |
|---|---|---|---|---|---|
| 4.1 | Branch + replay lab (drop, Last-Event-ID, buffer cap) | 📋 | P0 | M | Phase 03 |
| 4.2 | RedisOfflineQueue (IOfflineQueueStorage) + retention units | 📋 | P0 | M | 4.1 |
| 4.3 | Buffer-miss fallback + id-ordering spec | 📋 | P0 | M | 4.2 |
| 4.4 | Offline drain lab + e2e | 📋 | P0 | M | 4.2 |
| 4.5 | Phase close: audit, dashboards, PR + Copilot review | 📋 | P0 | S | 4.1-4.4 |

## Tasks

### Task 4.1: Replay lab with drop endpoint and buffer-cap proof

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: Phase 03

#### Description

`POST /labs/replay/drop` force-closes the caller's stream (via the kill switch) so the client reconnects with `Last-Event-ID`; the e2e proves ordered replay and, with buffer size 10, that over-capacity events age out.

#### Acceptance criteria

- [ ] Branch `feat/phase-04-replay-and-offline` created with `git switch -c`.
- [ ] `POST /labs/replay/emit-burst { count }` emits numbered events to the caller's user; `POST /labs/replay/drop` closes the caller's connection.
- [ ] E2E (in-buffer): connect, burst 5, drop, reconnect with the captured `Last-Event-ID`; the 5 events replay in order before any live event.
- [ ] E2E (cap): burst 15 while connected, drop after event 15, reconnect with the id of event 3: only events beyond the buffer window arrive (oldest evicted), demonstrating the cap honestly.
- [ ] Timeline endpoint `GET /labs/replay/timeline` distinguishes live, replayed and evicted ranges.

#### Files to create / modify

- `apps/api/src/replay/` (module, controller, service)
- `apps/api/test/e2e/replay.e2e-spec.ts`

#### Agent prompt

````
You are a senior NestJS engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. The Last-Event-ID replay story must be observable: in-order
replay after reconnect and honest buffer eviction at replayBufferSize=10.

CURRENT PHASE: 04 (replay-and-offline), Task 4.1 of 5 (FIRST).

PRECONDITIONS
- Phase 03 merged (kill switch exists; connections introspection exists).

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §12.4; library README: Last-Event-ID + replayBufferSize.

TASK
Create the branch and the replay lab (burst, drop, timeline) with the two e2e suites.

DELIVERABLES
1. `git switch -c feat/phase-04-replay-and-offline`.
2. replay module: emit-burst (numbered payloads {seq}), drop (disconnect the caller's
   connectionId), timeline (per-user record of emitted seq/id pairs kept app-side for
   assertion and UI).
3. e2e in-buffer: use the 'eventsource' client, capture lastEventId per event; after drop,
   reconnect passing the Last-Event-ID header; assert exact ordered replay then live flow.
4. e2e cap: burst 15, reconnect from event 3's id; assert only the tail within the 10-event
   window replays and the gap is visible in the timeline.

Constraints:
- Standard repo constraints (strict TS, sizes, headers, JSDoc, timeless comments, English,
  no em dashes, sequential bounded tests, no .gitkeep). Scenario comments on every it().
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Suites green sequentially; commit `feat(api): replay lab + buffer cap proof (4.1)`.

Completion Protocol: task status ✅ + checkboxes; Task index; header Progress; Phase 04 row in
docs/DEVELOPMENT_PLAN.md §1; Completion log; Conventional commit, no attribution.
````

### Task 4.2: RedisOfflineQueue implementing IOfflineQueueStorage

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 4.1

#### Description

The consumer-side storage the library defines: sorted-set backed queue with TTL and `maxPerUser` trim, wired into the module options.

#### Acceptance criteria

- [ ] `RedisOfflineQueue` implements `append`, `retrieveSince(userId, sinceId, limit)`, `acknowledge(userId, upToId)` per the library contract; keys `realtime:offline:{userId}`.
- [ ] Retention: `EX` TTL from config; `maxPerUser` trims oldest on append.
- [ ] Wired into the options factory (`offlineQueue`) behind a config flag.
- [ ] Unit specs (mocked ioredis): append/retrieve ordering, since-filtering by string comparison, limit, ack purge, TTL set, trim behavior.

#### Files to create / modify

- `apps/api/src/realtime/redis-offline-queue.ts` + specs; `options.factory.ts`

#### Agent prompt

````
You are a senior Node.js engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. Implement the library's IOfflineQueueStorage over Redis
sorted sets, with retention.

CURRENT PHASE: 04, Task 4.2 of 5 (MIDDLE).

PRECONDITIONS
- Task 4.1 done. ioredis available.

REQUIRED READING (only these)
- Library README: IOfflineQueueStorage and OfflineQueuedEvent contracts (id ordering is
  lexicographic string comparison).
- docs/TECHNICAL_SPECIFICATION.md §12.4.

TASK
Implement RedisOfflineQueue + retention and wire it into the module options.

DELIVERABLES
1. redis-offline-queue.ts: ZADD score Date.now(), member JSON of OfflineQueuedEvent;
   retrieveSince: ZRANGE full, parse, filter e.id > sinceId (string compare), slice(limit);
   acknowledge: ZREM members with e.id <= upToId; append also EXPIRE ttlSeconds and, when
   maxPerUser set, ZREMRANGEBYRANK 0 -(max+1).
2. options.factory: offlineQueue provided when config enables redis-backed features.
3. Unit specs with ioredis-mock or a typed hand mock: every method, retention branches,
   empty-queue paths. 100% coverage.

Constraints:
- Standard repo constraints; scenario comments; sequential bounded tests.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Unit suite green; commit `feat(api): redis offline queue (4.2)`.

Completion Protocol: standard steps.
````

### Task 4.3: Buffer-miss fallback and id-ordering guard

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 4.2

#### Description

The gap story: a `Last-Event-ID` older than the in-memory window falls back to the offline queue (`REALTIME_REPLAY_BUFFER_MISS` path); the id-ordering spec pins the lexicographic invariant both mechanisms rely on.

#### Acceptance criteria

- [ ] E2E: burst 15 (buffer 10) with the offline queue enabled; reconnect from event 1's id: events 2-15 arrive (queue covered the gap the buffer lost); timeline marks the source of each range (buffer vs queue).
- [ ] E2E (no queue profile): same gap with `offlineQueue` disabled: only the buffer window replays; the loss is explicit in the timeline (unrecoverable gap).
- [ ] Ordering spec: captured event ids across bursts are fixed-width and strictly lexicographically increasing; a shuffled sample sorted as strings equals the emission order.
- [ ] Matrix rows 25, 27, 28, 75 satisfied.

#### Files to create / modify

- `apps/api/test/e2e/replay-gap.e2e-spec.ts`, `apps/api/test/unit/event-id-ordering.spec.ts`

#### Agent prompt

````
You are a senior test engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. Prove the replay gap fallback (buffer miss -> offline queue)
and the id-ordering invariant.

CURRENT PHASE: 04, Task 4.3 of 5 (MIDDLE).

PRECONDITIONS
- Tasks 4.1-4.2 done (lab + queue wired).

REQUIRED READING (only these)
- Library README: REALTIME_REPLAY_BUFFER_MISS semantics; docs/TECHNICAL_SPECIFICATION.md §12.4.

TASK
Write the gap e2e (both profiles) and the ordering unit; extend the timeline to tag ranges.

DELIVERABLES
1. replay-gap e2e (queue on): burst 15, reconnect from id of event 1; assert 2..15 delivered,
   ordered; timeline tags which range came from the buffer vs the queue (derive by comparing
   against the buffer window).
2. replay-gap e2e (queue off): boot an in-process app with the offline queue disabled; same
   flow; assert only the in-window tail replays and the timeline marks the unrecoverable gap.
3. event-id-ordering unit: collect ids from a live burst capture fixture; assert fixed width,
   strict string ordering, and stability under Array.sort.

Constraints:
- Standard repo constraints; scenario comments; sequential bounded tests.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Suites green; commit `test(api): buffer-miss fallback + id ordering (4.3)`.

Completion Protocol: standard steps.
````

### Task 4.4: Offline drain lab

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 4.2

#### Description

Events emitted while a user has zero connections are queued; the next connect drains them. Ack purges. This is the "was fully offline" half of recovery.

#### Acceptance criteria

- [ ] `POST /labs/offline/emit { userId, count }` emits to a disconnected user; Redis queue grows.
- [ ] E2E: emit 5 while offline; connect; the 5 arrive (per the library's documented drain convention for fresh connections); `POST /labs/offline/ack { upToId }` purges; TTL and trim proven at the unit level (4.2) and referenced here.
- [ ] `GET /labs/offline/peek?userId=` shows the queue for the visualizer.
- [ ] Matrix row 26 satisfied.

#### Files to create / modify

- `apps/api/src/replay/offline.controller.ts` + service additions
- `apps/api/test/e2e/offline-drain.e2e-spec.ts`

#### Agent prompt

````
You are a senior NestJS engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. Offline users must not lose events when the queue is enabled.

CURRENT PHASE: 04, Task 4.4 of 5 (MIDDLE).

PRECONDITIONS
- Task 4.2 done (queue wired).

REQUIRED READING (only these)
- Library README: offline drain behavior on connect (what the fresh-connection convention is
  for the linked version; follow it exactly and document it in JSDoc).
- docs/TECHNICAL_SPECIFICATION.md §12.4.

TASK
Implement the offline lab endpoints and the drain e2e.

DELIVERABLES
1. offline.controller.ts: emit (to a given seeded user with zero connections; validate that
   precondition and 409 otherwise), peek, ack endpoints.
2. offline-drain e2e: ensure user disconnected; emit 5; connect via eventsource following the
   library's documented drain convention (e.g. initial header/param if required); assert the 5
   queued events arrive in order, then live events; ack purges (peek returns empty).

Constraints:
- Standard repo constraints; scenario comments; sequential bounded tests.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Suites green; commit `feat(api): offline drain lab (4.4)`.

Completion Protocol: standard steps.
````

### Task 4.5: Phase close: audit, dashboards, PR with Copilot review

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: 4.1-4.4

#### Description

Standard phase close; PR body lists matrix rows 23-28, 75.

#### Acceptance criteria

- [ ] Tasks 4.1-4.4 ✅, verifications re-run sequentially.
- [ ] Dashboards synced; PR merged on green with Copilot findings addressed; branch deleted.

#### Files to create / modify

- This file, `../DEVELOPMENT_PLAN.md`, `../tasks/README.md`

#### Agent prompt

````
You are the phase-close engineer for nest-realtime-example.

PROJECT: nest-realtime-example. Branch feat/phase-04-replay-and-offline.

CURRENT PHASE: 04, Task 4.5 of 5 (LAST: phase close).

PRECONDITIONS
- Tasks 4.1-4.4 report done.

REQUIRED READING (only these)
- docs/tasks/phase-04-replay-and-offline.md; docs/tasks/README.md workflow section.

TASK
Audit, sync dashboards, PR to merge.

DELIVERABLES
1. Re-run all Verifications (one suite at a time). 2. Sync header (5/5 ✅), plan §1 row,
tasks README. 3. `gh pr create` (title `feat: replay and offline recovery labs`), body listing
matrix rows 23-28 and 75; request GitHub Copilot review; address every finding; merge on green
with `gh pr merge --squash --delete-branch`.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Never merge with failing CI.

Verification: `gh pr checks` green pre-merge; branch deleted after.

Completion Protocol: standard steps + phase completion line.
````

## Completion log

<!-- append: - N.M ✅ YYYY-MM-DD one-line summary -->
