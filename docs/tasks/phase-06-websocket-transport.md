# Phase 06: websocket-transport

> **Status**: 🔄 In Progress · **Progress**: 4 / 6 tasks · **Last updated**: 2026-07-10
> **Source roadmap**: [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) §5 (Phase 06)
> **Source spec**: [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md) §12.5, §15

## Context

The WebSocket half of the dual-transport promise: the same application boots with `REALTIME_TRANSPORT=websocket`, authenticates via bearer token, serves the incident chat through `@Subscribe` handlers, scales through `@socket.io/redis-adapter`, revokes across nodes with the adapter-aware disconnect, and documents sticky sessions honestly. The parity proof is the point: the emit e2e from phase 02 must pass unchanged against the WS profile. Matrix rows landed: 5, 12, 36, 42-49, 53, 74.

## Rules-of-phase

1. Service code does not change between transports; only env and client wiring do. The parity e2e enforces this.
2. The namespace comes from config through the library's IoAdapter mechanism, never hardcoded in a decorator.
3. Sticky sessions (`ip_hash`) are configured for the polling fallback and the failure mode without them is documented, not hidden.
4. The WS e2e suites use `socket.io-client` and run sequentially like every other suite; cluster chat assertions live in the cluster suite.
5. Standard global conventions (plan §4).

## Reference docs

- Spec §12.5, §15; library README: websocket options (namespace, cors, maxHttpBufferSize, ping, redisAdapter), @Subscribe, bearer context, adapter-aware disconnect, sticky-session requirement.

## Task index

| ID  | Task                                                        | Status | Priority | Size | Depends on |
| --- | ----------------------------------------------------------- | ------ | -------- | ---- | ---------- |
| 6.1 | Branch + WS profile boot (IoAdapter namespace, bearer auth) | ✅     | P0       | L    | Phase 05   |
| 6.2 | Incident chat: @Subscribe handlers + no-op-under-SSE proof  | ✅     | P0       | M    | 6.1        |
| 6.3 | Redis adapter + adapter-aware revocation + sticky sessions  | ✅     | P0       | M    | 6.1        |
| 6.4 | Payload limits, WS CORS, error event, onError hook          | ✅     | P1       | M    | 6.1        |
| 6.5 | WS e2e suite + transport parity proof                       | 📋     | P0       | M    | 6.2-6.4    |
| 6.6 | Phase close: audit, dashboards, PR + Copilot review         | 📋     | P0       | S    | 6.1-6.5    |

## Tasks

### Task 6.1: WS profile boot with config-driven namespace and bearer auth

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: L
- **Depends on**: Phase 05

#### Description

Boot the app with `REALTIME_TRANSPORT=websocket`: the library's adapter mechanism applies the `/live` namespace from config, `main.ts` registers whatever adapter hookup the library documents, and the composite authenticator's bearer branch authenticates handshakes minted by `POST /auth/ws-token`.

#### Acceptance criteria

- [x] Branch `feat/phase-06-websocket-transport` created with `git switch -c`.
- [x] Options factory fills the `websocket` block from config (namespace, cors, ping intervals, maxHttpBufferSize, maxConnectionsPerUser); `main.ts` performs the adapter registration the library README documents.
- [x] `socket.io-client` connects to the configured namespace with `auth: { token }`; invalid/missing token disconnects.
- [x] `connection:established` arrives with client-safe traits (same assertion as SSE).
- [x] Matrix rows 5, 12, 45, 49 satisfied.

#### Files to create / modify

- `apps/api/src/realtime/options.factory.ts`, `apps/api/src/main.ts`
- `apps/api/test/e2e/ws-connect.e2e-spec.ts`

#### Agent prompt

```
You are a senior NestJS engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. Boot the WebSocket profile of @bymax-one/nest-realtime with a
config-driven namespace and bearer handshake auth.

CURRENT PHASE: 06 (websocket-transport), Task 6.1 of 6 (FIRST).

PRECONDITIONS
- Phase 05 merged. Optional WS peers installed since phase 01. BearerAuthenticator exists
  (phase 03) inside CompositeAuthenticator. POST /auth/ws-token mints tokens.

REQUIRED READING (only these)
- Library README: websocket options block, the IoAdapter registration it requires in main.ts,
  and how the handshake reaches IConnectionAuthenticator (transport 'websocket', token surface).
- docs/TECHNICAL_SPECIFICATION.md §9.1 (WS env vars).

TASK
Create the branch, fill the websocket options from config, register the adapter, and prove
connect/reject via socket.io-client.

DELIVERABLES
1. `git switch -c feat/phase-06-websocket-transport`.
2. options.factory: websocket { namespace: config.realtime.wsNamespace, cors { origin:
   config.webOrigin, credentials: true }, maxHttpBufferSize, pingIntervalMs, pingTimeoutMs,
   maxConnectionsPerUser } (redisAdapter arrives in 6.3).
3. main.ts: the adapter registration exactly as the linked library README documents (do not
   invent an adapter; consume the library's).
4. ws-connect e2e: mint a token via /auth/ws-token (cookie session), connect
   socket.io-client(WS_URL + namespace, { auth: { token } }); assert connection:established
   traits-only payload; connect without token asserts disconnect; wrong namespace fails.

Constraints:
- Standard repo constraints (strict TS no any/suppressions, sizes, headers, JSDoc, timeless
  comments, English, no em dashes, sequential bounded tests, no .gitkeep).
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Unit + e2e green sequentially (boot the app with REALTIME_TRANSPORT=websocket in the e2e env).
- Commit `feat(api): websocket profile boot + bearer handshake (6.1)`.

Completion Protocol: task status ✅ + checkboxes; Task index; header Progress; Phase 06 row in
docs/DEVELOPMENT_PLAN.md §1; Completion log; Conventional commit, no attribution.
```

### Task 6.2: Incident chat with @Subscribe and the SSE no-op proof

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: 6.1

#### Description

The bi-directional showcase: `chat.message` handled via the library's `@Subscribe` decorator, validated, re-emitted to the incident room; plus the proof that `@Subscribe` is inert under the SSE profile.

#### Acceptance criteria

- [x] `ChatModule` with a `chat.message` handler: zod-validates `{ roomId, body }`, enforces room membership + authenticated identity, re-emits `chat.message` to the room via `RealtimeService`. Reconciliation: the installed library exposes no `@Subscribe` decorator, so the handler uses the standard NestJS `@SubscribeMessage` on a config-namespaced gateway; the library still owns auth, rooms and fan-out.
- [x] E2E: two WS clients in `resource:incident:i1` exchange messages; a third client outside the room receives nothing.
- [x] SSE no-op unit: booting the SSE profile registers zero chat handlers (the gateway provider is gated off) and the app still boots clean.
- [x] Matrix rows 46, 47 satisfied.

#### Files to create / modify

- `apps/api/src/chat/` (module, handlers, dto) + specs
- `apps/api/test/e2e/ws-chat.e2e-spec.ts`

#### Agent prompt

```
You are a senior NestJS engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. Client-to-server events via the library's @Subscribe decorator,
scoped to incident rooms, inert under SSE.

CURRENT PHASE: 06, Task 6.2 of 6 (MIDDLE).

PRECONDITIONS
- Task 6.1 done (WS profile boots). Rooms module exists (phase 03).

REQUIRED READING (only these)
- Library README: @Subscribe semantics (WebSocket only, no-op under SSE), handler signature.
- docs/TECHNICAL_SPECIFICATION.md §12.5.

TASK
Implement the chat module + WS chat e2e + the SSE no-op proof.

DELIVERABLES
1. chat module: @Subscribe('chat.message') handler validating { roomId, body } with zod,
   checking membership via the rooms tracking and tenant via traits, then
   RealtimeService.emitToRoom(roomId, 'chat.message', { from, body, at }).
2. ws-chat e2e: three token-authed socket.io-client connections; A and B joined to
   resource:incident:i1 (REST join from phase 03); A sends; B receives exactly one
   chat.message; C (not joined) receives none; invalid payload is rejected without crashing
   the gateway.
3. SSE no-op unit: with transport 'sse', boot the testing module including ChatModule; assert
   clean boot and (per the library's documented surface) no WS handler registration.

Constraints:
- Standard repo constraints; scenario comments; sequential bounded tests.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Suites green; commit `feat(api): incident chat via @Subscribe (6.2)`.

Completion Protocol: standard steps.
```

### Task 6.3: Redis adapter, adapter-aware revocation and sticky sessions

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: 6.1

#### Description

WS horizontal scaling: `websocket.redisAdapter.pubClient` wired from the shared ioredis client, cross-node revocation via the adapter-aware disconnect, and the nginx `ip_hash` + WS upgrade block replacing the phase 05 stub, with the honest documentation of why stickiness is mandatory.

#### Acceptance criteria

- [x] Options factory provides `redisAdapter: { pubClient }` when Redis is enabled (the `redis` pub/sub driver).
- [x] nginx conf: the Socket.IO transport location (`/socket.io/`) carries upgrade headers + an `ip_hash` upstream; a comment block explains the polling-handshake affinity requirement, the honest "Session ID unknown" failure mode without it, and the `transports: ['websocket']` alternative.
- [x] Cluster suite additions: chat message from a client on app-a reaches a room member on app-b; revoking a WS connection cross-instance closes it (adapter-aware path); plus a WS handshake through nginx.
- [x] Matrix rows 42, 43, 44 satisfied.

#### Files to create / modify

- `apps/api/src/realtime/options.factory.ts`, `docker/nginx/nginx.conf`
- `apps/api/test/e2e-cluster/ws-cluster.e2e-spec.ts`

#### Agent prompt

```
You are a senior infrastructure-minded NestJS engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. Scale the WebSocket transport: redis adapter for message
fan-out, sticky sessions for handshake affinity, adapter-aware revocation.

CURRENT PHASE: 06, Task 6.3 of 6 (MIDDLE).

PRECONDITIONS
- Tasks 6.1-6.2 done; cluster compose profile exists (phase 05).

REQUIRED READING (only these)
- Library README: websocket.redisAdapter (the lib duplicates the client), disconnect semantics
  across nodes, sticky-session requirement with the polling fallback.
- docs/TECHNICAL_SPECIFICATION.md §15.

TASK
Wire the adapter, harden nginx for WS, extend the cluster suite with WS fan-out + revocation.

DELIVERABLES
1. options.factory: websocket.redisAdapter = { pubClient: <shared ioredis> } under the redis
   driver flag.
2. nginx.conf: replace the WS stub with a real location (proxy_http_version 1.1, Upgrade/
   Connection headers, ip_hash upstream for the WS/polling paths); keep round-robin for plain
   HTTP; comment the affinity rationale (timeless: describe the behavior, not the plan).
3. ws-cluster.e2e-spec.ts (cluster suite, runs alone): room member on app-b receives a chat
   message sent through app-a; cross-instance WS revocation closes the remote socket.
4. Update the cluster profile so both app instances boot REALTIME_TRANSPORT=websocket for this
   suite (parameterize via env file or profile override, keeping the SSE cluster suite intact).

Constraints:
- Standard repo constraints; scenario comments; the cluster suite runs alone.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Cluster WS suite green via the documented up/run/down flow.
- Commit `feat(api): ws redis adapter + sticky sessions + cross-node revocation (6.3)`.

Completion Protocol: standard steps.
```

### Task 6.4: Payload limits, WS CORS, error event and onError hook

- **Status**: ✅ Done
- **Priority**: P1
- **Size**: M
- **Depends on**: 6.1

#### Description

The rough edges that bite in production: an oversized client payload is dropped with `REALTIME_PAYLOAD_TOO_LARGE` (buffer lowered to 16 KB), WS CORS is Socket.IO's own option (proven distinct from HTTP CORS), and transport errors reach both the client `error` reserved event and the `hooks.onError` audit entry.

#### Acceptance criteria

- [x] Payload e2e: a `chat.message` body larger than `REALTIME_WS_MAX_BUFFER_BYTES` never reaches the handler (a co-member receives nothing); Socket.IO drops the frame and closes the connection; the example bridges that transport error into `hooks.onError`, so the audit feed gains a `REALTIME_PAYLOAD_TOO_LARGE` entry.
- [x] WS CORS spec: the Socket.IO handshake carries a restrictive `websocket.cors` pinned to the configured origin (never a foreign one), while HTTP CORS is governed separately by the Nest app config (two distinct assertions). Reconciliation: a single string origin is browser-enforced (pinned allow-origin), not server-rejecting, so the tests assert the pinning on both mechanisms.
- [x] `hooks.onError` fired (audit `error` entry) for the WebSocket payload transport error. Reconciliation (row 36): the installed library emits no client-facing `error` reserved event for WebSocket transport errors (it wires `onError` only for SSE) and the example never emits library-reserved event names, so the transport error is surfaced on the audit/`hooks.onError` side, not as a client `error` event.
- [x] Matrix rows 36 (reconciled), 48, 53, 74 satisfied.

#### Files to create / modify

- `apps/api/test/e2e/ws-limits.e2e-spec.ts`; audit assertions

#### Agent prompt

```
You are a senior test engineer working on nest-realtime-example.

PROJECT: nest-realtime-example. Prove the WS guardrails: payload cap, WS-specific CORS, error
surfacing to client and hooks.

CURRENT PHASE: 06, Task 6.4 of 6 (MIDDLE).

PRECONDITIONS
- Tasks 6.1-6.2 done. REALTIME_WS_MAX_BUFFER_BYTES=16384 in test env.

REQUIRED READING (only these)
- Library README: maxHttpBufferSize behavior, websocket.cors, the reserved 'error' event,
  hooks.onError signature.

TASK
Write ws-limits e2e covering the three guardrails.

DELIVERABLES
1. Oversized payload: connect, emit chat.message with a ~32KB body; assert the handler never
   fires (no room delivery), the connection behaves per the documented drop/close semantics,
   and GET /audit/feed?kind=error gained an entry.
2. CORS: socket.io-client with a forged disallowed Origin header fails the handshake; a plain
   HTTP request with the same origin still follows the Nest CORS config (assert both).
3. Forced error: trigger a transport error per the library's documented path (for example a
   malformed frame via a raw engine.io probe) and assert the client 'error' reserved event and
   the audit onError entry. If the linked version documents no client-facing forced-error path,
   assert the hook side and record the limitation in the spec assertion message.

Constraints:
- Standard repo constraints; scenario comments; sequential bounded tests.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Suite green; commit `test(api): ws payload, cors and error surfacing (6.4)`.

Completion Protocol: standard steps.
```

### Task 6.5: Transport parity proof

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 6.2-6.4

#### Description

The dual-transport thesis, executable: the emit/isolation e2e assertions from phase 02 run against BOTH profiles from a shared spec source, with only the client transport differing. Zero service-code differences.

#### Acceptance criteria

- [ ] A shared parity spec module parameterized by transport runs: tenant isolation, user emit, room emit, broadcast, connection-established traits; executed once under `sse` (eventsource) and once under `websocket` (socket.io-client).
- [ ] A grep-style meta assertion: `src/` contains no `if (transport === ...)` branching in application services (the only transport switch lives in env/config wiring).
- [ ] Matrix row 5 completed end to end; parity documented in the README section stub.

#### Files to create / modify

- `apps/api/test/e2e/parity/{parity.suite.ts,sse.parity.e2e-spec.ts,ws.parity.e2e-spec.ts}`

#### Agent prompt

```
You are a senior test architect working on nest-realtime-example.

PROJECT: nest-realtime-example. One suite, two transports, identical assertions: prove the
library's transport-agnostic promise.

CURRENT PHASE: 06, Task 6.5 of 6 (MIDDLE).

PRECONDITIONS
- Tasks 6.2-6.4 done.

REQUIRED READING (only these)
- apps/api/test/e2e/tenant-isolation.e2e-spec.ts (phase 02, the assertions to generalize).

TASK
Extract the parity suite and run it under both profiles; add the no-branching meta assertion.

DELIVERABLES
1. parity.suite.ts: exported runParitySuite(clientFactory) with the shared assertions
   (isolation, user/room/broadcast emits, traits payload), transport-blind.
2. sse.parity.e2e-spec.ts (eventsource factory, sse profile) and ws.parity.e2e-spec.ts
   (socket.io-client factory, websocket profile), each booting its profile in-process.
3. Meta spec: scan src/ (node:fs walk) asserting no application service references
   TransportMode conditionals (allow the options factory and config only).

Constraints:
- Standard repo constraints; scenario comments; suites sequential.
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.

Verification:
- Both parity specs green; commit `test(api): transport parity proof (6.5)`.

Completion Protocol: standard steps.
```

### Task 6.6: Phase close: audit, dashboards, PR with Copilot review

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: 6.1-6.5

#### Description

Standard phase close; PR body lists matrix rows 5, 12, 36, 42-49, 53, 74.

#### Acceptance criteria

- [ ] Tasks 6.1-6.5 ✅; verifications re-run (cluster WS suite alone, last).
- [ ] Dashboards synced; PR merged on green with Copilot findings addressed; branch deleted.

#### Files to create / modify

- This file, `../DEVELOPMENT_PLAN.md`, `../tasks/README.md`

#### Agent prompt

```
You are the phase-close engineer for nest-realtime-example.

PROJECT: nest-realtime-example. Branch feat/phase-06-websocket-transport.

CURRENT PHASE: 06, Task 6.6 of 6 (LAST: phase close).

PRECONDITIONS
- Tasks 6.1-6.5 report done.

REQUIRED READING (only these)
- docs/tasks/phase-06-websocket-transport.md; docs/tasks/README.md workflow section.

TASK
Audit, sync dashboards, PR to merge.

DELIVERABLES
1. Re-run Verifications sequentially (unit, e2e, parity, then cluster WS alone). 2. Sync header
(6/6 ✅), plan §1 row, tasks README. 3. `gh pr create` (title `feat: websocket transport at
parity`), body with matrix rows 5, 12, 36, 42-49, 53, 74; request GitHub Copilot review;
address every finding; merge on green with `gh pr merge --squash --delete-branch`.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Never merge with failing CI.

Verification: `gh pr checks` green pre-merge; branch deleted after.

Completion Protocol: standard steps + phase completion line.
```

## Completion log

<!-- append: - N.M ✅ YYYY-MM-DD one-line summary -->

- 6.1 ✅ 2026-07-10 WS profile boots on the config-driven `/live` namespace via the library's `RealtimeIoAdapter` (patch-extended to honor `websocket.namespace`), bearer handshake auth, ws-connect e2e (established traits, missing-token and wrong-namespace rejections)
- 6.2 ✅ 2026-07-10 Incident chat via a config-namespaced `@SubscribeMessage('chat.message')` gateway (library has no `@Subscribe`), gated off under SSE (no-op proof), authenticated-identity fan-out with room isolation and malformed-frame survivability; fixed a stale `/health` assertion missing the `pubsub` field
- 6.3 ✅ 2026-07-10 WS `redisAdapter.pubClient` wired under the redis driver, nginx `/socket.io/` upgrade + `ip_hash` sticky location with the honest failure-mode note, cluster profile parameterized by `REALTIME_TRANSPORT`; ws-cluster suite (app-a to app-b chat fan-out, cross-node revocation, nginx handshake) green against the built WebSocket stack (patch verified in-image)
- 6.4 ✅ 2026-07-10 ws-limits e2e: oversized payload dropped (handler never runs) and bridged to a `REALTIME_PAYLOAD_TOO_LARGE` audit entry via `hooks.onError`; restrictive WS handshake cors and separate Nest HTTP cors both pinned to the configured origin; row 36 reconciled (library emits no client `error` event for WS)
