# Phase 05: scaling-cluster

> **Status**: 🔄 In Progress · **Progress**: 5 / 6 tasks · **Last updated**: 2026-07-09
> **Source roadmap**: [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) §5 (Phase 05)
> **Source spec**: [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md) §15, §12.8

## Context

Single-instance SSE works. This phase makes it horizontal: `RedisRealtimePubSub` implementing the library's `IRealtimePubSub`, the nginx-fronted `cluster` compose profile (app-a + app-b), delivery/publish counters that prove exactly-once fan-out with no republish storm, cross-instance revocation, graceful degradation when Redis disappears, and the Redis presence storage. Matrix rows landed: 38-41 (and row 17 gains its cross-instance half).

## Rules-of-phase

1. The pub/sub implementation duplicates the Redis connection for the subscriber (a subscribed ioredis client cannot issue commands) and self-filters by origin instance id.
2. Loop prevention is proven with counters, not prose: one emit produces exactly one publish and exactly one delivery per connected client, cluster-wide.
3. nginx SSE rules are non-negotiable: no buffering, no gzip on the stream, generous read timeout; the app sends `Cache-Control: no-cache, no-transform`.
4. The cluster e2e is the heaviest suite in the repo: it runs alone, after all unit suites, one compose stack at a time.
5. Standard global conventions (plan §4).

## Reference docs

- Spec §15 (topology), §12.8 (scenario); library README: IRealtimePubSub contract, RealtimePubSubMessage/EmitArgs, degradation semantics (REALTIME_PUBSUB_UNAVAILABLE), IPresenceStorage.

## Task index

| ID  | Task                                                           | Status | Priority | Size | Depends on |
| --- | -------------------------------------------------------------- | ------ | -------- | ---- | ---------- |
| 5.1 | Branch + RedisRealtimePubSub implementation                    | ✅     | P0       | M    | Phase 04   |
| 5.2 | nginx SSE-safe config + cluster compose profile                | ✅     | P0       | M    | 5.1        |
| 5.3 | Cluster lab: delivery/publish counters + loop-prevention proof | ✅     | P0       | L    | 5.2        |
| 5.4 | Cross-instance revocation + degradation lab                    | ✅     | P0       | M    | 5.3        |
| 5.5 | RedisPresenceStorage                                           | ✅     | P1       | S    | 5.1        |
| 5.6 | Phase close: audit, dashboards, PR + Copilot review            | 📋     | P0       | S    | 5.1-5.5    |

## Tasks

### Task 5.1: RedisRealtimePubSub

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: Phase 04

#### Description

The consumer-side bus: publish on the shared channel with an instance origin id; subscribe on a duplicated connection; self-filter own messages; selected by `PUBSUB_DRIVER=redis`.

#### Acceptance criteria

- [x] Branch `feat/phase-05-scaling-cluster` created with `git switch -c`.
- [x] `RedisRealtimePubSub` implements the library's `IRealtimePubSub`: `publish(message)` stamps `origin` (instance `randomUUID`), `subscribe(handler)` returns an async unsubscribe; subscriber via `duplicate()`.
- [x] Own-origin messages are dropped before handlers; malformed payloads are logged and skipped (never throw into the bus).
- [x] Options factory selects it when `PUBSUB_DRIVER=redis` (memory default otherwise), via `RealtimeInfraModule` shared singletons.
- [x] Unit specs: publish stamps origin, self-filter, handler fan-in, unsubscribe, malformed skip, availability flag. 100% coverage.

#### Files to create / modify

- `apps/api/src/realtime/redis-realtime-pubsub.ts` + specs; `options.factory.ts`

#### Agent prompt

```
You are a senior Node.js engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. Implement the library's IRealtimePubSub over ioredis pub/sub
for cross-instance SSE fan-out.

CURRENT PHASE: 05 (scaling-cluster), Task 5.1 of 6 (FIRST).

PRECONDITIONS
- Phase 04 merged. ioredis in deps; APP_CONFIG has PUBSUB_DRIVER + REDIS_URL.

REQUIRED READING (only these)
- Library README: IRealtimePubSub, RealtimePubSubMessage (op/args/origin) and the documented
  reference implementation notes (duplicate() for the subscriber; origin self-filter).
- docs/TECHNICAL_SPECIFICATION.md §15.

TASK
Create the branch and implement RedisRealtimePubSub + driver selection + full units.

DELIVERABLES
1. `git switch -c feat/phase-05-scaling-cluster`.
2. redis-realtime-pubsub.ts: constructor(redis, { channel }); instanceId = randomUUID();
   pub = provided client; sub = client.duplicate(); subscribe channel once; on message: parse,
   drop when msg.origin === instanceId, fan to handlers inside try/catch (log + continue);
   publish: JSON with origin stamped; close(): unsubscribe + quit the duplicate.
3. options.factory: pubsub = redis driver when config says so; expose the instanceId via a
   provider for the counters lab.
4. Unit specs with a typed ioredis mock: all behaviors incl. malformed JSON skip.

Constraints:
- Standard repo constraints (strict TS no any/suppressions, sizes, headers, JSDoc, timeless
  comments, English, no em dashes, sequential bounded tests, no .gitkeep).
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Unit suite green; commit `feat(api): redis realtime pubsub (5.1)`.

Completion Protocol: task status ✅ + checkboxes; Task index; header Progress; Phase 05 row in
docs/DEVELOPMENT_PLAN.md §1; Completion log; Conventional commit, no attribution.
```

### Task 5.2: nginx SSE-safe proxy and the cluster compose profile

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: 5.1

#### Description

The honest infrastructure: `docker/nginx/nginx.conf` with the SSE location rules and round-robin HTTP; compose `cluster` profile running app-a (3001) and app-b (3002) from the phase 01 Dockerfile behind nginx (8080), both on `PUBSUB_DRIVER=redis`.

#### Acceptance criteria

- [x] nginx conf: upstream over app-a/app-b; SSE location (`/api/events`): `proxy_buffering off`, `proxy_cache off`, `gzip off`, `proxy_read_timeout` >> heartbeat, HTTP/1.1 with empty `Connection`; other locations round-robin (verified 6/4 split over 10 requests).
- [x] Compose `cluster` profile: app-a/app-b built from `docker/api.Dockerfile`, distinct `INSTANCE_NAME`/`PORT`, shared Redis, healthchecks; nginx depends on healthy apps.
- [x] The library sets `Cache-Control: ...no-cache...no-store...no-transform` and `X-Accel-Buffering: no` on the SSE route (verified through the proxy; nginx consumes `X-Accel-Buffering`); the app adds nothing.
- [x] Smoke: `docker compose --profile cluster up -d --build` then a logged-in `curl -N` through 8080 streams `connection:established` immediately; cross-instance emit on app-a reaches a client on app-b.

#### Files to create / modify

- `docker/nginx/nginx.conf`, `docker-compose.yml` (cluster profile)

#### Agent prompt

```
You are a senior infrastructure engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. Two api instances behind nginx must serve SSE correctly:
buffering or compression on the stream kills delivery.

CURRENT PHASE: 05, Task 5.2 of 6 (MIDDLE).

PRECONDITIONS
- Task 5.1 done; docker/api.Dockerfile exists (phase 01).

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §15 and §16.
- Library README: proxy/infra notes for SSE (no buffering, no gzip on text/event-stream,
  no-transform header).

TASK
Write the nginx config and the cluster compose profile; smoke the stream through the proxy.

DELIVERABLES
1. docker/nginx/nginx.conf per the spec rules (SSE location + round-robin default; WS
   upgrade block arrives in phase 06, leave a marked location stub that returns 404 for now).
2. docker-compose.yml cluster profile: app-a/app-b (build args, env INSTANCE_NAME, PORT,
   PUBSUB_DRIVER=redis, REDIS_URL=redis://redis:6379), nginx:alpine on 8080 mounting the conf,
   depends_on healthy.
3. Verify response headers through the proxy include no-cache/no-transform and events flow
   without delay (burst reaches the curl client immediately).

Constraints:
- Standard repo constraints; timeless comments in configs; English; no em dashes; no secrets.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- `docker compose --profile cluster up -d` healthy; manual curl smoke documented in the PR body;
  `docker compose down` afterwards.
- Commit `infra(cluster): nginx sse-safe proxy + two instances (5.2)`.

Completion Protocol: standard steps.
```

### Task 5.3: Cluster lab with counters and loop-prevention proof

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: L
- **Depends on**: 5.2

#### Description

The phase's flagship: per-instance counters (`published`, `receivedRemote`, `deliveredLocal`) exposed at `GET /labs/cluster/stats`, and the multi-instance e2e proving one emit delivers exactly once per client cluster-wide with exactly one publish (no A to B to A storm).

#### Acceptance criteria

- [x] Counter decorator wraps the pub/sub driver (publish increments `published`; the forwarded handler increments `receivedRemote`), `deliveredLocal` is their sum; `GET /labs/cluster/stats` returns `{ instance, published, receivedRemote, deliveredLocal }`.
- [x] Multi-instance e2e (compose cluster): client X on app-a (3001), client Y on app-b (3002), same tenant; `POST /emit/tenant/acme` against app-a: X and Y each receive exactly one copy; app-a stats show published=1, receivedRemote=0; app-b shows receivedRemote=1, published=0; a 5-second settle window shows no counter drift (no storm).
- [x] The same e2e repeated through nginx (8080) behaves identically (one publish and one remote receive cluster-wide).
- [x] Matrix rows 38, 39 satisfied.

#### Files to create / modify

- `apps/api/src/connections/cluster-stats.{service,controller}.ts`
- `apps/api/test/e2e-cluster/fanout.e2e-spec.ts`, `apps/api/jest.e2e-cluster.config.ts`

#### Agent prompt

```
You are a senior distributed-systems test engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. Prove exactly-once cross-instance fan-out with counters, and
that a remote delivery is never re-published.

CURRENT PHASE: 05, Task 5.3 of 6 (MIDDLE, flagship).

PRECONDITIONS
- Tasks 5.1-5.2 done; cluster profile boots.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §12.8; library README: local-delivery vs publish semantics.

TASK
Implement the counters + stats endpoint and the cluster e2e suite (its own jest config; runs
alone).

DELIVERABLES
1. cluster-stats service: decorate the injected pubsub (published++ on publish, receivedRemote++
   on handled remote message); deliveredLocal from the connect/emit bookkeeping already kept by
   the app registry; controller GET /labs/cluster/stats.
2. jest.e2e-cluster.config.ts: separate project, runInBand semantics (maxWorkers 1), globalSetup
   asserting the cluster profile is up (fail fast with a clear message otherwise).
3. fanout.e2e-spec.ts: direct-port scenario and via-nginx scenario as described in the
   acceptance criteria, including the 5s no-drift settle assertion.
4. Root script `test:e2e:cluster` documented as: bring the profile up, run this suite ALONE,
   tear down.

Constraints:
- This suite never runs concurrently with anything; document that in the config header comment.
- Standard repo constraints; scenario comments.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- `docker compose --profile cluster up -d && pnpm --filter @nest-realtime-example/api
  test:e2e:cluster && docker compose down` green locally.
- Commit `feat(api): cluster fan-out counters + loop-prevention proof (5.3)`.

Completion Protocol: standard steps.
```

### Task 5.4: Cross-instance revocation and degradation lab

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: 5.3 (and 5.5, whose presence index authorizes the cross-instance kill)

#### Description

Two remaining scaling guarantees: revoking a connection owned by the _other_ instance closes it (the `op:'disconnect'` path), and losing Redis degrades to single-instance with a warning instead of crashing.

#### Acceptance criteria

- [x] Cluster e2e: client on app-b; `POST /connections/:id/disconnect` against app-a closes it (observed client-side) within a bounded window; ownership is verified against the shared presence index so the kill stays anti-IDOR cluster-wide (a non-owner gets 404).
- [x] Degradation e2e: with the cluster up, `docker compose stop redis`; both instances flip `pubsub` to `degraded` and keep serving local connections (a local emit still delivers); cross-instance delivery pauses; restarting redis returns both to `ok` and resumes cross-instance fan-out (ioredis auto-resubscribes). The cluster uses a long reauth interval so the shared-Redis revocation check does not disconnect during the outage, isolating pub/sub availability.
- [x] `GET /health` reflects pub/sub availability (`pubsub: 'ok' | 'degraded'`) for the frontend, sourced from the driver's observable state.
- [x] Matrix rows 40, 41, 73 satisfied; row 17 cross-instance half complete.

#### Files to create / modify

- `apps/api/test/e2e-cluster/revocation.e2e-spec.ts`, `degradation.e2e-spec.ts`
- `apps/api/src/health/health.controller.ts` (degraded flag)

#### Agent prompt

```
You are a senior reliability engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. Cross-instance revocation must actually close remote streams;
Redis loss must degrade gracefully, never crash.

CURRENT PHASE: 05, Task 5.4 of 6 (MIDDLE).

PRECONDITIONS
- Task 5.3 done (cluster e2e infrastructure exists).

REQUIRED READING (only these)
- Library README: disconnect() cross-instance semantics (op:'disconnect'),
  REALTIME_PUBSUB_UNAVAILABLE degradation; docs/TECHNICAL_SPECIFICATION.md §12.6, §12.8.

TASK
Add the two cluster e2e suites and the health degraded flag.

DELIVERABLES
1. revocation.e2e-spec.ts: connect on app-b, list connections there, call disconnect on app-a
   with that id, assert the app-b client closes with the revocation reason within 5s.
2. degradation.e2e-spec.ts: stop the redis container (dockerode or execa docker CLI from the
   test), assert both /health endpoints report degraded pub/sub while local emits still deliver;
   start redis again and assert recovery per the linked version's documented behavior.
3. health controller: pubsub: 'ok' | 'degraded' sourced from the driver's connection state
   (expose a minimal observable state on RedisRealtimePubSub).

Constraints:
- Container manipulation stays inside the cluster suite (runs alone). Standard repo constraints.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Cluster suite green locally with the documented up/run/down flow.
- Commit `feat(api): cross-instance revocation + degradation lab (5.4)`.

Completion Protocol: standard steps.
```

### Task 5.5: RedisPresenceStorage

- **Status**: ✅ Done
- **Priority**: P1
- **Size**: S
- **Depends on**: 5.1

#### Description

The last storage interface: presence backed by Redis sets, powering `usePresence` in phase 08 and correct across instances.

#### Acceptance criteria

- [x] `RedisPresenceStorage` implements the library's `IPresenceStorage` (`setOnline`, `setOffline`, `isOnline`, `listOnlineByTenant`, `countOnline`) with per-user connection sets (a user with 2 tabs stays online until both close) and tenant indexes. The installed library wires the presence token but never calls it, so a `PresenceTracker` lifecycle consumer populates it.
- [x] Wired into options (presence when redis enabled); `GET /presence/:tenantId` REST mirror for the UI (session-guarded, own tenant only).
- [x] Units cover multi-connection semantics and tenant listing; cluster e2e extends: a user connected on app-b appears online when queried on app-a and leaves the roster on disconnect.

#### Files to create / modify

- `apps/api/src/realtime/redis-presence-storage.ts` + specs; `apps/api/src/presence/`

#### Agent prompt

```
You are a senior Node.js engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. Implement IPresenceStorage over Redis so presence is truthful
across instances and multiple tabs.

CURRENT PHASE: 05, Task 5.5 of 6 (MIDDLE).

PRECONDITIONS
- Task 5.1 done.

REQUIRED READING (only these)
- Library README: IPresenceStorage contract and when the library calls each method.

TASK
Implement RedisPresenceStorage + the REST mirror + tests.

DELIVERABLES
1. redis-presence-storage.ts: SADD/SREM on presence:user:{userId} (connectionIds) +
   presence:tenant:{tenantId} (userIds, removed only when the user's connection set empties);
   isOnline via SCARD; listOnlineByTenant via SMEMBERS; countOnline via a maintained set.
2. Wire into options.factory (presence when redis enabled).
3. presence module: GET /presence/:tenantId (session-guarded, own tenant only, reusing the
   anti-IDOR guard pattern).
4. Units for multi-tab semantics; extend the cluster fan-out spec with one cross-instance
   presence assertion.

Constraints:
- Standard repo constraints; scenario comments; sequential bounded tests.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Unit suite green; commit `feat(api): redis presence storage (5.5)`.

Completion Protocol: standard steps.
```

### Task 5.6: Phase close: audit, dashboards, PR with Copilot review

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: 5.1-5.5

#### Description

Standard phase close; the PR body lists matrix rows 38-41, 73 and the completion of row 17.

#### Acceptance criteria

- [ ] Tasks 5.1-5.5 ✅; verifications re-run (cluster suite last, alone).
- [ ] Dashboards synced; PR merged on green with Copilot findings addressed; branch deleted.

#### Files to create / modify

- This file, `../DEVELOPMENT_PLAN.md`, `../tasks/README.md`

#### Agent prompt

```
You are the phase-close engineer for nest-realtime-example.

PROJECT: nest-realtime-example. Branch feat/phase-05-scaling-cluster.

CURRENT PHASE: 05, Task 5.6 of 6 (LAST: phase close).

PRECONDITIONS
- Tasks 5.1-5.5 report done.

REQUIRED READING (only these)
- docs/tasks/phase-05-scaling-cluster.md; docs/tasks/README.md workflow section.

TASK
Audit, sync dashboards, PR to merge.

DELIVERABLES
1. Re-run Verifications: unit suites first, then the cluster suite ALONE (compose up, run,
   down). 2. Sync header (6/6 ✅), plan §1 row, tasks README. 3. `gh pr create` (title
`feat: horizontal scaling with observable guarantees`), body listing matrix rows 38-41, 73 and
17-complete; request GitHub Copilot review; address every finding; merge on green with
`gh pr merge --squash --delete-branch`.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Never merge with failing CI.

Verification: `gh pr checks` green pre-merge; branch deleted after.

Completion Protocol: standard steps + phase completion line.
```

## Completion log

<!-- append: - N.M ✅ YYYY-MM-DD one-line summary -->

- 5.1 ✅ 2026-07-09 RedisRealtimePubSub (origin stamp + self-filter, duplicate subscriber, availability flag) selected by PUBSUB_DRIVER=redis via RealtimeInfraModule; full units at 100%.
- 5.2 ✅ 2026-07-09 nginx SSE-safe proxy + cluster compose profile (app-a/app-b/nginx); extended the pnpm patch to add the explicit @Inject(forwardRef(() => SseTransport)) the RealtimePubSubSubscriber needs, without which cross-instance delivery 500s in-image; smoke proved fan-out app-a to app-b.
- 5.3 ✅ 2026-07-09 Cluster stats counters + CountingRealtimePubSub decorator + GET /labs/cluster/stats; cluster e2e (jest.e2e-cluster, runs alone) proves exactly-once fan-out and no re-publish storm direct and via nginx (app-a published=1/received=0, app-b published=0/received=1, no 5s drift). Matrix rows 38, 39.
- 5.5 ✅ 2026-07-09 RedisPresenceStorage (per-user connection sets, tenant index, cross-instance ownership check) populated by a PresenceTracker lifecycle consumer (library 0.1.0 does not call presence itself); GET /presence/:tenantId own-tenant roster; cluster e2e proves a user connected on app-b appears in the roster read from app-a.
- 5.4 ✅ 2026-07-09 Cross-instance kill switch (presence-authorized, publishes op:disconnect) + /health pubsub degraded flag; cluster e2e proves revoke-on-app-a closes an app-b stream (and 404s a non-owner) and that stopping Redis degrades both instances while local delivery continues, with recovery on restart. Matrix rows 40, 41, 73; row 17 cross-instance half.
