# nest-realtime-example: Technical Specification

> **Version:** 1.0.0
> **Last updated:** 2026-07-06
> **Status:** Draft for implementation
> **Type:** Reference implementation (private repository today, public later; never published to npm)
> **Library under test:** [`@bymax-one/nest-realtime`](https://github.com/bymaxone/nest-realtime), the dual-transport realtime module for NestJS 11

---

## Table of Contents

1. [Purpose and Audience](#1-purpose-and-audience)
2. [Goals and Non-Goals](#2-goals-and-non-goals)
3. [Architecture at a Glance](#3-architecture-at-a-glance)
4. [The Library Under Test: `@bymax-one/nest-realtime`](#4-the-library-under-test-bymax-onenest-realtime)
5. [Tech Stack](#5-tech-stack)
6. [Repository Layout](#6-repository-layout)
7. [Feature Coverage Matrix](#7-feature-coverage-matrix)
8. [Library Consumption](#8-library-consumption)
9. [Configuration and Environment](#9-configuration-and-environment)
10. [Backend Design: `apps/api`](#10-backend-design-apps-api)
11. [Demo Domain and REST API](#11-demo-domain-and-rest-api)
12. [Demonstration Scenarios](#12-demonstration-scenarios)
13. [Frontend Design: `apps/web`](#13-frontend-design-apps-web)
14. [Design System](#14-design-system)
15. [Multi-Instance Topology](#15-multi-instance-topology)
16. [Local Stack and Docker](#16-local-stack-and-docker)
17. [Error Handling](#17-error-handling)
18. [Quality Gates](#18-quality-gates)
19. [CI and Repository Visibility](#19-ci-and-repository-visibility)
20. [Out of Scope](#20-out-of-scope)

---

## 1 · Purpose and Audience

`nest-realtime-example` is the canonical reference implementation of `@bymax-one/nest-realtime`. It exists to prove, exercise and demonstrate **every public feature and path** of the library in a realistic application, so that:

- **Library consumers** can read working code for each feature (transports, auth patterns, replay, scaling, hooks, React hooks) instead of reconstructing usage from API docs.
- **Library maintainers** get an integration canary: if a library release breaks a real consumer, it breaks here first, loudly, in CI.
- **New Bymax backends** can copy proven wiring (the `forRootAsync` block, the authenticator bridges, the proxy configuration) verbatim.

The bar for "covered" is executable: a feature counts as demonstrated only when it has a route or UI interaction that exercises it AND a test that proves the observable behavior. The [Feature Coverage Matrix](#7-feature-coverage-matrix) is the contract; the final audit phase verifies every row.

The demo domain is a **Live Operations Board** for a fictional multi-tenant SaaS: tenants watch orders and deployments update live, receive alerts, chat inside incident rooms, and see who is online. The domain is deliberately thin; the realtime plumbing is the product.

## 2 · Goals and Non-Goals

### Goals

1. **Exhaustive library coverage.** Every exported symbol, module option, transport mode, auth pattern, lifecycle hook, reserved event and error code of `@bymax-one/nest-realtime` is exercised at least once (matrix in §7).
2. **All three transport modes live side by side.** The same application boots as `sse` (default), `websocket`, or `both`, switched by environment variable, proving the one-line transport swap the library promises.
3. **Honest infrastructure.** The repo ships the real proxy configuration SSE and scaled WebSocket need (no buffering, no compression on `text/event-stream`, sticky sessions for WS polling), because that is where realtime deployments actually fail.
4. **True multi-instance proof.** Two backend instances behind a proxy, one Redis, demonstrating cross-instance fan-out, loop prevention and cross-instance revocation with observable counters.
5. **A polished frontend** built exclusively on the library's `./react` subpath, following the shared Bymax example design system (§14).
6. **Sibling-grade quality.** 100% unit coverage on both apps, E2E of every HTTP route and realtime flow, mutation testing as a pre-release gate, mirroring `nest-cache-example` and `nest-logger-example`.

### Non-Goals

- **NG1. No production auth system.** The demo authenticator issues signed session cookies with `node:crypto` for demo users; it illustrates the `IConnectionAuthenticator` contract, not a login product. Bridging to `@bymax-one/nest-auth` is shown as documented code, not wired as a dependency.
- **NG2. No persistence beyond Redis.** Orders and deployments are seeded in memory; there is no database. The library is persistence-agnostic and so is this example.
- **NG3. No chat product.** The incident room chat exists to exercise `@Subscribe`, rooms and bi-directional WS; it has no history, moderation or read receipts.
- **NG4. No load testing.** Capacity planning notes from the library spec are referenced, not benchmarked here.
- **NG5. Not a template repository.** This repo is copied by humans for reference; it is not derived via "Use this template".

## 3 · Architecture at a Glance

```
                        ┌────────────────────────────────────────────────┐
                        │              docker compose network            │
                        │                                                │
 ┌──────────────┐       │   ┌─────────┐      ┌──────────────────────┐    │
 │  apps/web    │ 3000  │   │  nginx  │ 8080 │  apps/api  (app-a)   │    │
 │  Next.js 16  │ ─────────►│  proxy  │─────►│  NestJS 11 :3001     │    │
 │  ./react     │       │   │ sse-safe│  ┌──►│  nest-realtime       │    │
 │  hooks only  │       │   │ sticky  │  │   └──────────┬───────────┘    │
 └──────────────┘       │   └────┬────┘  │              │                │
                        │        │       │   ┌──────────▼───────────┐    │
                        │        └───────┴──►│  apps/api  (app-b)   │    │
                        │                    │  NestJS 11 :3002     │    │
                        │                    └──────────┬───────────┘    │
                        │                               │                │
                        │                    ┌──────────▼───────────┐    │
                        │                    │      redis:7         │    │
                        │                    │ pub/sub · tickets ·  │    │
                        │                    │ offline · presence   │    │
                        │                    └──────────────────────┘    │
                        └────────────────────────────────────────────────┘
```

- **Single-instance dev** (`pnpm dev`): web talks to app-a directly, `InMemoryPubSub`, no proxy. This is the default inner loop.
- **Multi-instance profile** (`docker compose --profile cluster up`): nginx fronts app-a and app-b, `RedisRealtimePubSub` fans out, sticky sessions cover the WS polling fallback. Used by the scaling labs and the multi-instance E2E suite.
- The frontend never talks to Redis and never sees a `tenantId` it did not authenticate with; all isolation is server-side, as the library prescribes.

## 4 · The Library Under Test: `@bymax-one/nest-realtime`

Version target: `0.1.x`. Peer set: `@nestjs/common ^11`, `@nestjs/core ^11`, `rxjs ^7.8`, `reflect-metadata ^0.2` required; `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io ^4`, `@socket.io/redis-adapter ^8`, `ioredis ^5`, `react ^19`, `react-dom ^19`, `socket.io-client ^4` optional per feature. `dependencies: {}`.

### 4.1 Public API inventory (server subpath `.`)

| Export                                                                         | Kind                | Exercised by                                                              |
| ------------------------------------------------------------------------------ | ------------------- | ------------------------------------------------------------------------- |
| `BymaxRealtimeModule.forRoot` / `.forRootAsync`                                | Dynamic module      | §9.2 wiring (async is canonical; sync shown in a doc snippet + unit test) |
| `RealtimeService`                                                              | Service             | Every emit lab and domain simulator (§11)                                 |
| `RealtimeService.emitToUser / emitToTenant / emitToRoom / broadcast`           | Methods             | Emit console + domain events (§12.1)                                      |
| `RealtimeService.joinRoom / leaveRoom / disconnect`                            | Methods             | Rooms lab, revocation lab (§12.5, §12.6)                                  |
| `IConnectionAuthenticator` (+ `AuthenticationResult`, `ConnectionAuthContext`) | Interface           | Three authenticators: cookie, ticket, WS bearer (§10.3)                   |
| `IConnectionLifecycleHooks` (+ `ConnectionEventMeta`)                          | Interface           | Audit feed service (§10.4)                                                |
| `IRealtimePubSub` (+ `RealtimePubSubMessage`, `EmitArgs`)                      | Interface           | `RedisRealtimePubSub` implementation (§15)                                |
| `IOfflineQueueStorage` (+ `OfflineQueuedEvent`)                                | Interface           | `RedisOfflineQueue` implementation (§12.4)                                |
| `IPresenceStorage`                                                             | Interface           | `RedisPresenceStorage` implementation (§12.7)                             |
| `ITransport`                                                                   | Interface           | Referenced in docs; consumed indirectly through the module                |
| `@OnConnect` / `@OnDisconnect`                                                 | Decorators          | Feature-local handlers in the audit module                                |
| `@Subscribe`                                                                   | Decorator (WS only) | Incident room chat handlers; no-op proof under SSE                        |
| `ROOM_PREFIXES`, `RESERVED_EVENT_NAMES`                                        | Constants           | Room composition + reserved-name guard test                               |
| `REALTIME_*_TOKEN` (7 Symbol tokens)                                           | DI tokens           | Injection in labs that need registry/pubsub introspection                 |
| `BymaxRealtimeModuleOptions` / `BymaxRealtimeModuleAsyncOptions`               | Types               | Config factory typing                                                     |

### 4.2 Public API inventory (`./shared` and `./react`)

| Export                                                      | Subpath    | Exercised by                                                         |
| ----------------------------------------------------------- | ---------- | -------------------------------------------------------------------- |
| `RealtimeEvent`, `ConnectionMeta`, `TransportMode`          | `./shared` | Shared event typing between api and web (subpath probe + real usage) |
| `RESERVED_EVENT_NAMES`, `ROOM_PREFIXES`, `composeRoomId`    | `./shared` | Room id composition on both sides                                    |
| `useRealtime` (+ `UseRealtimeOptions`, `UseRealtimeReturn`) | `./react`  | Every live page (§13)                                                |
| `useRealtimeConnection`                                     | `./react`  | Connection status badge                                              |
| `usePresence`                                               | `./react`  | Presence roster page                                                 |
| `RealtimeProvider`                                          | `./react`  | App shell shares one connection across hooks                         |

### 4.3 Key defaults the example makes visible

| Option                                   | Default        | Where the example proves it                                                      |
| ---------------------------------------- | -------------- | -------------------------------------------------------------------------------- |
| `transport`                              | required       | Env-switched boot profiles (§9.1)                                                |
| `sse.endpoint`                           | `/events`      | Overridden to `/api/events` to prove configurability                             |
| `sse.heartbeatMs`                        | 30000          | Lowered to 10000 in dev; raw-stream capture shows `: keepalive` comments (§12.2) |
| `sse.replayBufferSize`                   | 100            | Lowered to 10 in the replay lab to force buffer-miss paths                       |
| `sse.maxConnectionsPerUser`              | 5              | Lowered to 2 in the eviction lab: FIFO eviction, never HTTP 429 (§12.3)          |
| `sse.emitConnectionEvent`                | true           | Toggle exposed; off-state verified in E2E                                        |
| `websocket.namespace`                    | `/`            | Set to `/live` to prove the config-driven IoAdapter namespace                    |
| `websocket.maxHttpBufferSize`            | 1 MB           | Lowered in the payload lab to trigger `REALTIME_PAYLOAD_TOO_LARGE`               |
| `reauthenticationPolicy.intervalSeconds` | 300            | Lowered to 15 in the reauth lab (§12.6)                                          |
| `reauthenticationPolicy.onFailure`       | `'disconnect'` | Both `'disconnect'` and `'event'` demonstrated                                   |

## 5 · Tech Stack

| Layer                   | Choice                                                                                                          | Notes                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Package manager         | pnpm 10+, workspaces                                                                                            | `apps/api`, `apps/web`                                              |
| Backend                 | NestJS 11, TypeScript 5.x strict                                                                                | Express platform (SSE controller uses the response passthrough)     |
| Realtime                | `@bymax-one/nest-realtime` `0.1.x`                                                                              | The subject of this repo                                            |
| Optional realtime peers | `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`, `@socket.io/redis-adapter`, `socket.io-client` | Installed because this example exercises the WS transport           |
| Redis client            | `ioredis ^5`                                                                                                    | Pub/sub bus, tickets, offline queue, presence                       |
| Validation              | Zod DTOs via a `ZodValidationPipe`                                                                              | No Swagger; JSDoc is the documentation                              |
| Frontend                | Next.js 16 (App Router), React 19                                                                               | Consumes only `@bymax-one/nest-realtime/react` + `/shared`          |
| Frontend testing        | Vitest + React Testing Library + Playwright smoke                                                               | EventSource and socket mocks in unit; real transports in Playwright |
| Backend testing         | Jest (unit, 100%), supertest + `eventsource` + `socket.io-client` (E2E), Testcontainers Redis                   | `maxWorkers: '50%'` pinned in every config                          |
| Mutation                | Stryker, pre-release gate                                                                                       | api `break: 95` minimum, driven toward 100                          |
| Infra                   | docker compose: `redis:7-alpine`, `nginx:alpine`, app images                                                    | `cluster` profile adds app-b + proxy                                |

Node engine: `>=24`. English-only code, comments and docs. No em dashes anywhere in the codebase or docs.

## 6 · Repository Layout

```
nest-realtime-example/
├── apps/
│   ├── api/                          # NestJS 11 backend (one image, N instances)
│   │   ├── src/
│   │   │   ├── main.ts               # bootstrap + IoAdapter registration
│   │   │   ├── app.module.ts         # BymaxRealtimeModule.forRootAsync + feature modules
│   │   │   ├── config/               # env parsing (transport profile, ports, redis url)
│   │   │   ├── auth/                 # demo login + cookie/ticket/bearer authenticators
│   │   │   ├── realtime/             # module options factory, pubsub/offline/presence impls
│   │   │   ├── emit/                 # emit console endpoints (user/tenant/room/broadcast)
│   │   │   ├── rooms/                # join/leave/list endpoints, anti-IDOR guard pattern
│   │   │   ├── connections/          # registry introspection, revocation, eviction labs
│   │   │   ├── replay/               # replay + offline queue labs
│   │   │   ├── chat/                 # WS-only @Subscribe incident chat
│   │   │   ├── audit/                # lifecycle hooks + @OnConnect/@OnDisconnect feed
│   │   │   └── domain/               # order/deployment simulators that emit real events
│   │   └── test/                     # e2e specs (http, sse, ws, multi-instance)
│   └── web/                          # Next.js 16 frontend
│       └── src/
│           ├── app/                  # pages listed in §13.2
│           ├── components/           # design-system components + realtime widgets
│           └── lib/                  # api client, event types (from ./shared)
├── docker/
│   ├── nginx/nginx.conf              # SSE-safe + sticky-session proxy (§15, §16)
│   └── api.Dockerfile
├── docker-compose.yml                # redis (always) + cluster profile (app-a, app-b, nginx)
├── docs/
│   ├── TECHNICAL_SPECIFICATION.md    # this document
│   ├── DEVELOPMENT_PLAN.md           # phases + canonical dashboard
│   ├── design_system.html            # shared Bymax example design system
│   └── tasks/                        # one task file per phase
├── .github/workflows/                # ci.yml (always) + codeql/scorecard (public-conditional)
├── package.json                      # private: true, workspace root
└── pnpm-workspace.yaml
```

## 7 · Feature Coverage Matrix

The contract of this repository. Every row must reference a real route/page and a test by the time the audit phase closes. Column "Phase" is the phase that lands the row.

### 7.1 Module, registration and DI

| #   | Library feature                                     | Example scenario                             | Route / UI                     | Phase |
| --- | --------------------------------------------------- | -------------------------------------------- | ------------------------------ | ----- |
| 1   | `forRootAsync` with `imports`/`inject`/`useFactory` | Canonical wiring from env + Redis            | `app.module.ts`                | 02    |
| 2   | `forRoot` (sync)                                    | Minimal wiring, unit-tested boot             | unit spec + README snippet     | 02    |
| 3   | `extraProviders` in async options                   | Authenticator provided as class              | `realtime/options.factory.ts`  | 03    |
| 4   | `transport: 'sse'`                                  | Default boot profile                         | `REALTIME_TRANSPORT=sse`       | 02    |
| 5   | `transport: 'websocket'`                            | WS boot profile                              | `REALTIME_TRANSPORT=websocket` | 06    |
| 6   | `transport: 'both'`                                 | Composite boot profile                       | `REALTIME_TRANSPORT=both`      | 07    |
| 7   | `service` metadata                                  | Name/version surfaced in audit feed entries  | Audit page                     | 02    |
| 8   | Symbol DI tokens (`REALTIME_*_TOKEN`)               | Labs inject options/pubsub for introspection | `connections/` module          | 03    |
| 9   | `tenantResolver`                                    | Custom mapping from auth result to tenant    | options factory                | 03    |

### 7.2 Authentication and connection policy

| #   | Library feature                                         | Example scenario                                                      | Route / UI                       | Phase   |
| --- | ------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------- | ------- |
| 10  | Pattern A: HttpOnly cookie                              | Demo login sets cookie; EventSource connects with `withCredentials`   | `POST /auth/login` + Live Feed   | 02      |
| 11  | Pattern B: one-shot ticket (60s TTL, `getdel`)          | Ticket lab issues + consumes; reuse fails                             | `POST /auth/ticket` + Ticket lab | 03      |
| 12  | Pattern C: WS bearer (`handshake.auth.token`)           | WS profile authenticates via token                                    | Chat page (WS)                   | 06      |
| 13  | `authenticate` returns null                             | 401 on SSE; `disconnect(true)` on WS                                  | E2E specs                        | 03      |
| 14  | `revalidate` + `reauthenticationPolicy.intervalSeconds` | 15s reauth demo with revocable sessions                               | Reauth lab                       | 03      |
| 15  | `onFailure: 'disconnect'` vs `'event'`                  | Both policies observable in the lab                                   | Reauth lab toggle                | 03      |
| 16  | `cacheTtlMs` positive-auth cache                        | Revalidation counter shows caching effect                             | Reauth lab counters              | 03      |
| 17  | Instant revocation `disconnect(connectionId, reason)`   | Kill switch per connection (same and cross instance)                  | Connections page                 | 03 / 05 |
| 18  | `sse.maxConnectionsPerUser` FIFO eviction               | 3rd tab evicts oldest with `REALTIME_TOO_MANY_CONNECTIONS`, never 429 | Eviction visualizer              | 03      |
| 19  | `connection:established` client-safe traits             | UI shows traits; test asserts no `metadata` leak                      | Live Feed                        | 02      |
| 20  | `sse.emitConnectionEvent: false`                        | Toggled profile; E2E asserts absence                                  | E2E                              | 03      |

### 7.3 SSE transport, replay and offline

| #   | Library feature                                         | Example scenario                                                        | Route / UI                     | Phase |
| --- | ------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------ | ----- |
| 21  | Configured `sse.endpoint`                               | `/api/events` instead of default                                        | wiring                         | 02    |
| 22  | Heartbeat as raw `: keepalive` comment                  | Raw stream capture shows comments carry no id and never reach listeners | Heartbeat lab + E2E raw socket | 02    |
| 23  | `Last-Event-ID` replay                                  | Drop-connection lab; missed events replayed in order                    | Replay lab                     | 04    |
| 24  | `sse.replayBufferSize` cap                              | Size 10 in lab; 11th event evicts oldest                                | Replay lab counters            | 04    |
| 25  | `REALTIME_REPLAY_BUFFER_MISS` fallback                  | Gap beyond buffer falls back to offline queue                           | Replay lab                     | 04    |
| 26  | `IOfflineQueueStorage.append` (0 connections)           | Emit while user offline; queued in Redis                                | Offline lab                    | 04    |
| 27  | `retrieveSince` + `acknowledge` + TTL/`maxPerUser` trim | Reconnect drains queue; ack purges; trim proven                         | Offline lab + unit             | 04    |
| 28  | Lexicographic event-id ordering                         | Test asserts fixed-width ids sort correctly across replay               | unit/E2E                       | 04    |
| 29  | `sse.cors`                                              | Web origin allowed with credentials                                     | wiring + E2E                   | 02    |

### 7.4 Rooms, tenants and events

| #   | Library feature                        | Example scenario                                               | Route / UI             | Phase |
| --- | -------------------------------------- | -------------------------------------------------------------- | ---------------------- | ----- |
| 30  | Auto rooms `user:{id}` / `tenant:{id}` | Login as two tenants; tenant emits isolate                     | Broadcast console      | 02    |
| 31  | `ROOM_PREFIXES` + `composeRoomId`      | Resource rooms `resource:incident:{id}`                        | Rooms lab              | 03    |
| 32  | `joinRoom` / `leaveRoom` (idempotent)  | Join/leave incident room; double-join safe                     | Rooms lab              | 03    |
| 33  | Anti-IDOR guard pattern                | Emit endpoint validates tenant ownership before `emitToTenant` | `emit/` service + test | 03    |
| 34  | Reserved event names respected         | Guard test: app never emits names in `RESERVED_EVENT_NAMES`    | unit                   | 03    |
| 35  | `connection:reauthentication-failed`   | Received before disconnect in `'event'` mode                   | Reauth lab             | 03    |
| 36  | `error` reserved event                 | Transport error surfaces to client handler                     | E2E                    | 06    |

### 7.5 Scaling and multi-instance

| #   | Library feature                                | Example scenario                                                        | Route / UI           | Phase |
| --- | ---------------------------------------------- | ----------------------------------------------------------------------- | -------------------- | ----- |
| 37  | `InMemoryPubSub` default                       | Single-instance dev works with zero config                              | dev profile          | 02    |
| 38  | `IRealtimePubSub` Redis implementation         | Emit on app-a reaches SSE client on app-b                               | Cluster lab          | 05    |
| 39  | Loop prevention (`*Local` path, origin filter) | Delivery counters prove exactly-once per client, no A to B to A storm   | Cluster lab counters | 05    |
| 40  | Cross-instance `op:'disconnect'` revocation    | Revoke on app-a closes stream owned by app-b                            | Cluster lab          | 05    |
| 41  | `REALTIME_PUBSUB_UNAVAILABLE` degradation      | Redis stopped: warn + single-instance mode, no crash                    | Degradation lab      | 05    |
| 42  | WS `redisAdapter` (`pubClient.duplicate()`)    | Chat fan-out across instances                                           | Cluster chat E2E     | 06    |
| 43  | Adapter-aware `disconnectSockets(true)`        | WS revocation across nodes                                              | Cluster chat E2E     | 06    |
| 44  | Sticky sessions for WS polling                 | nginx `ip_hash` documented + verified; failure mode documented honestly | proxy config + docs  | 06    |

### 7.6 WebSocket transport and composite

| #   | Library feature                             | Example scenario                                            | Route / UI    | Phase |
| --- | ------------------------------------------- | ----------------------------------------------------------- | ------------- | ----- |
| 45  | Config-driven namespace via IoAdapter       | `/live` namespace from env, not decorator                   | WS wiring     | 06    |
| 46  | `@Subscribe` client-to-server events        | Incident chat message handler                               | Chat page     | 06    |
| 47  | `@Subscribe` no-op under SSE                | Boot under `sse`: handler never registers; test proves      | unit          | 06    |
| 48  | `websocket.maxHttpBufferSize`               | Oversized payload dropped with `REALTIME_PAYLOAD_TOO_LARGE` | Payload lab   | 06    |
| 49  | WS `cors` (Socket.IO's own option)          | Configured separately from HTTP CORS                        | wiring        | 06    |
| 50  | `'both'` composite: emit reaches SSE and WS | Split-screen page: same emit lands on both clients          | Both-mode lab | 07    |
| 51  | Migration journey (SSE app adds WS chat)    | Documented walkthrough with the both profile                | README + docs | 07    |

### 7.7 Lifecycle hooks and decorators

| #   | Library feature                                  | Example scenario                                                          | Route / UI          | Phase |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------- | ------------------- | ----- |
| 52  | `hooks.onConnect` / `onDisconnect` (+ duration)  | Audit feed lists sessions with duration                                   | Audit page          | 02    |
| 53  | `hooks.onError`                                  | Transport error appended to audit feed                                    | Audit page          | 06    |
| 54  | `hooks.onReauthenticationFailed`                 | Audit entry on failed reauth                                              | Reauth lab          | 03    |
| 55  | `@OnConnect` / `@OnDisconnect` method decorators | Feature-local counters coexist with config hooks; config hooks fire first | Audit module + unit | 03    |

### 7.8 Frontend (`./react`)

| #   | Library feature                                                | Example scenario                                         | Route / UI         | Phase |
| --- | -------------------------------------------------------------- | -------------------------------------------------------- | ------------------ | ----- |
| 56  | `useRealtime` SSE auto-detect (http/path URL)                  | Live Feed page                                           | `/`                | 08    |
| 57  | `useRealtime` WS auto-detect (`wss://`) + `transport` override | Chat page + switcher                                     | `/chat`            | 08    |
| 58  | Typed `events` map                                             | `LiveEvents` interface shared via `./shared` types       | all pages          | 08    |
| 59  | `auth.fetchTicket`                                             | Ticket lab page connects via ticket flow                 | `/labs/ticket`     | 08    |
| 60  | `reconnect` tuning + `reconnectAttempts`                       | Connection lab with visible backoff                      | `/labs/connection` | 08    |
| 61  | `autoConnect: false` + manual `connect()`/`disconnect()`       | Connection lab buttons                                   | `/labs/connection` | 08    |
| 62  | `status` + `lastEvent`                                         | Status badge + event inspector                           | shell              | 08    |
| 63  | `useRealtimeConnection`                                        | Global connection badge in app shell                     | shell              | 08    |
| 64  | `usePresence`                                                  | Presence roster per tenant                               | `/presence`        | 08    |
| 65  | `RealtimeProvider` shared connection                           | Shell provider; multiple hooks, one EventSource          | shell + test       | 08    |
| 66  | socket.io-client dynamic import only                           | Bundle assertion: SSE-only build has no socket.io-client | build check        | 08    |

### 7.9 Error catalog

| #   | Error code                                      | Demonstrated by                         | Phase |
| --- | ----------------------------------------------- | --------------------------------------- | ----- |
| 67  | `REALTIME_INVALID_OPTIONS`                      | Boot test with malformed options throws | 02    |
| 68  | `REALTIME_NO_AUTHENTICATOR`                     | Boot test without authenticator throws  | 02    |
| 69  | `REALTIME_AUTH_FAILED`                          | 401 SSE / WS disconnect specs           | 03    |
| 70  | `REALTIME_REAUTHENTICATION_FAILED`              | Reauth lab disconnect reason            | 03    |
| 71  | `REALTIME_TOO_MANY_CONNECTIONS`                 | Eviction visualizer reason              | 03    |
| 72  | `REALTIME_INVALID_TICKET` (maps to auth failed) | Ticket reuse spec, documented mapping   | 03    |
| 73  | `REALTIME_PUBSUB_UNAVAILABLE`                   | Degradation lab warn log                | 05    |
| 74  | `REALTIME_PAYLOAD_TOO_LARGE`                    | Payload lab drop + log                  | 06    |
| 75  | `REALTIME_REPLAY_BUFFER_MISS`                   | Replay lab gap path                     | 04    |

## 8 · Library Consumption

### 8.1 Linking modes (in order of use during development)

```bash
# (a) Local file link while the library is unpublished (default for early phases):
#     apps/api/package.json + apps/web/package.json
#     "@bymax-one/nest-realtime": "file:../../../nest-realtime"

# (b) Published version (switched to as soon as the library is on npm):
#     "@bymax-one/nest-realtime": "^0.1.0"

# (c) Iterative library development: pnpm link + tsup watch on the library side.
```

The switch from (a) to (b) is a single-line diff per app plus a lockfile refresh, executed as a tracked task when the library publishes. CI runs whichever mode the lockfile pins; the export-usage audit (§18) re-runs after the switch.

### 8.2 Subpath imports

- `apps/api` imports from `@bymax-one/nest-realtime` (server) and `@bymax-one/nest-realtime/shared`.
- `apps/web` imports from `@bymax-one/nest-realtime/react` and `/shared` only; importing the server subpath in web code is a lint error.
- A dedicated probe spec asserts all three subpaths resolve in both ESM and CJS consumers.

## 9 · Configuration and Environment

### 9.1 Environment variables (`apps/api`)

| Variable                            | Default                  | Purpose                                           |
| ----------------------------------- | ------------------------ | ------------------------------------------------- |
| `PORT`                              | `3001`                   | Instance HTTP port (`3002` for app-b)             |
| `INSTANCE_NAME`                     | `app-a`                  | Shown in cluster lab counters and audit feed      |
| `REALTIME_TRANSPORT`                | `sse`                    | `sse` / `websocket` / `both` boot profile         |
| `REALTIME_SSE_ENDPOINT`             | `/api/events`            | Proves endpoint configurability                   |
| `REALTIME_HEARTBEAT_MS`             | `10000`                  | Dev-friendly heartbeat                            |
| `REALTIME_REPLAY_BUFFER_SIZE`       | `10`                     | Small to make replay labs observable              |
| `REALTIME_MAX_CONNECTIONS_PER_USER` | `5`                      | One tab works; a second tab trips FIFO eviction   |
| `REALTIME_EMIT_CONNECTION_EVENT`    | `true`                   | Toggle for matrix row 20                          |
| `REALTIME_WS_NAMESPACE`             | `/live`                  | Config-driven namespace                           |
| `REALTIME_WS_MAX_BUFFER_BYTES`      | `16384`                  | Small to trigger payload lab                      |
| `REAUTH_INTERVAL_SECONDS`           | `15`                     | Observable reauth cycle                           |
| `REAUTH_ON_FAILURE`                 | `disconnect`             | Or `event`                                        |
| `REDIS_URL`                         | `redis://localhost:6379` | Bus, tickets, offline, presence                   |
| `PUBSUB_DRIVER`                     | `memory`                 | `memory` (dev) or `redis` (cluster profile)       |
| `SESSION_SECRET`                    | dev value                | HMAC key for demo session cookies (`node:crypto`) |
| `WEB_ORIGIN`                        | `http://localhost:3000`  | CORS origin for SSE and WS                        |

`apps/web` needs only `NEXT_PUBLIC_API_URL` (default `http://localhost:3001`) and `NEXT_PUBLIC_WS_URL` (default `ws://localhost:3001/live`).

### 9.2 Canonical wiring (`apps/api/src/realtime/`)

The options factory is the centerpiece consumers will copy: it reads the env profile, builds the authenticator chain (cookie first, ticket fallback for SSE; bearer for WS), selects `InMemoryPubSub` or `RedisRealtimePubSub`, wires `RedisOfflineQueue` and `RedisPresenceStorage` when Redis is configured, installs the audit hooks, and returns a fully typed `BymaxRealtimeModuleOptions`. Every option in §4.3 appears here, sourced from env, with a comment stating which matrix row it serves is NOT allowed (timeless comments; the matrix mapping lives in this spec instead).

## 10 · Backend Design: `apps/api`

### 10.1 Module map

| Module                 | Responsibility                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `ConfigModule` (local) | Parse env into a typed, frozen config object                                                  |
| `RealtimeWiringModule` | Options factory + `BymaxRealtimeModule.forRootAsync` + Redis providers                        |
| `AuthModule`           | Demo users, login/logout, cookie signing (`node:crypto` HMAC), ticket issuing, bearer minting |
| `EmitModule`           | Emit console endpoints with anti-IDOR tenant guard                                            |
| `RoomsModule`          | Join/leave/list, resource room composition                                                    |
| `ConnectionsModule`    | Registry introspection, revocation, eviction lab, degradation toggle                          |
| `ReplayModule`         | Replay/offline labs, drop-connection helper                                                   |
| `ChatModule`           | WS `@Subscribe` handlers for incident rooms                                                   |
| `AuditModule`          | Lifecycle hooks sink + `@OnConnect`/`@OnDisconnect` counters + feed endpoint                  |
| `DomainModule`         | Order/deployment simulators emitting realistic events on an interval or on demand             |

### 10.2 House style

Controllers are thin (validate with Zod, delegate, return). Services own logic. Every provider uses explicit `@Inject` with the library's Symbol tokens where library internals are consumed. Every file carries `@fileoverview` + `@layer`; every export carries imperative JSDoc. Functions max 50 lines, files max 800. No `any`, no suppression comments, timeless comments only.

### 10.3 Authenticators

- `CookieSessionAuthenticator`: verifies the HMAC-signed demo session cookie, returns `{ userId, tenantId, roles }`.
- `TicketAuthenticator`: `GETDEL` on `realtime:ticket:{id}`, one-shot, 60s TTL.
- `BearerAuthenticator` (WS): reads `handshake.auth.token`.
- A composing authenticator dispatches by context (`transport`, presence of `ticket` query param), so one `IConnectionAuthenticator` handles all three patterns and the wiring stays a single option.
- `revalidate` consults a Redis revocation set, enabling the reauth and kill-switch labs.

### 10.4 Audit feed

Both hook styles are wired deliberately: config `hooks` for cross-cutting audit (connect, disconnect + duration, error, reauth failure) and method decorators for feature-local counters, proving order (config hooks first) with a unit test.

## 11 · Demo Domain and REST API

### 11.1 Endpoint catalogue (selected)

| Method + path                                      | Purpose                                                      | Matrix rows |
| -------------------------------------------------- | ------------------------------------------------------------ | ----------- |
| `POST /auth/login` / `POST /auth/logout`           | Demo session cookie (per-tenant users)                       | 10          |
| `POST /auth/ticket`                                | One-shot SSE ticket                                          | 11          |
| `POST /auth/ws-token`                              | Short-lived WS bearer                                        | 12          |
| `POST /auth/revoke/:userId`                        | Flip revocation flag (reauth + kill labs)                    | 14, 17      |
| `GET  /api/events`                                 | The SSE endpoint (library-owned)                             | 21          |
| `POST /emit/user/:userId`                          | Emit console                                                 | 1, 30       |
| `POST /emit/tenant/:tenantId`                      | Tenant emit with ownership guard                             | 33          |
| `POST /emit/room/:roomId` / `POST /emit/broadcast` | Room + broadcast emits                                       | 31, 30      |
| `POST /rooms/:roomId/join` / `/leave`              | Room membership for the caller's connection                  | 32          |
| `GET  /connections`                                | Registry introspection (per instance)                        | 8           |
| `POST /connections/:id/disconnect`                 | Instant revocation                                           | 17, 40      |
| `GET  /audit/feed`                                 | Lifecycle audit entries                                      | 52-55       |
| `POST /labs/replay/drop`                           | Force-close the caller's stream to trigger browser reconnect | 23          |
| `POST /labs/offline/emit`                          | Emit to an offline user (queues)                             | 26          |
| `POST /labs/payload/oversized`                     | Trigger payload-too-large (WS)                               | 48          |
| `POST /labs/degradation/redis`                     | Stop/start pub/sub availability simulation                   | 41          |
| `POST /domain/orders/simulate`                     | Burst of realistic order events                              | domain      |
| `GET  /health`                                     | Liveness for compose/CI                                      | infra       |

### 11.2 Documented journeys

Each journey is a numbered curl/browser walkthrough in the README, mapped to matrix rows: first connection, two-tenant isolation, ticket flow, reconnect-and-replay, offline drain, eviction, revocation (single and cross-instance), chat over WS, both-mode split screen.

## 12 · Demonstration Scenarios

### 12.1 Emit console and tenant isolation

Two browser sessions (tenant Acme, tenant Globex). Emits to `tenant:acme` never reach Globex. Broadcast reaches both. UI shows per-connection event log.

### 12.2 Heartbeat honesty

A raw-capture lab (server-side tap or E2E raw socket) shows `: keepalive` comment lines flowing between events, carrying no `id:` and never firing listeners; disabling compression/buffering is documented alongside.

### 12.3 FIFO eviction

`maxConnectionsPerUser: 2`; opening a third tab closes the oldest with `REALTIME_TOO_MANY_CONNECTIONS` while the new tab is admitted. The visualizer orders tabs by `connectedAt`.

### 12.4 Replay and offline

Buffer size 10. The lab emits 1..N, drops the stream, and reconnects: events since `Last-Event-ID` replay in order. Emitting 15 while disconnected forces the buffer-miss path into `RedisOfflineQueue`. Acknowledge purges; TTL and `maxPerUser` trims are unit-proven.

### 12.5 Rooms and incident chat

Users join `resource:incident:{id}` rooms. Under SSE, room emits are server-push only; under WS, `@Subscribe('chat.message')` receives client messages and re-emits to the room.

### 12.6 Reauth and revocation

15s reauth cycle against a Redis revocation set. `'event'` mode delivers `connection:reauthentication-failed` before the close; `'disconnect'` mode closes silently. The kill switch disconnects a specific connection, including one owned by the other instance (cluster profile).

### 12.7 Presence

`RedisPresenceStorage` + `usePresence` render a per-tenant roster that updates on connect/disconnect across instances.

### 12.8 Cluster fan-out and loop prevention

The cluster lab shows per-instance delivery counters: one emit on app-a delivers exactly once to each client on app-a and app-b; publish counters prove no re-publish storm.

## 13 · Frontend Design: `apps/web`

### 13.1 Data layer

A thin typed API client (fetch) for the REST endpoints; all realtime data flows exclusively through the library hooks. Event payload types are declared once and shared with the backend via `@bymax-one/nest-realtime/shared` conventions.

### 13.2 Pages

| Route              | Page                                            | Exercises  |
| ------------------ | ----------------------------------------------- | ---------- |
| `/`                | Live Operations Board (orders/deployments feed) | 56, 58, 62 |
| `/presence`        | Presence roster                                 | 64         |
| `/chat`            | Incident room chat (WS)                         | 57, 46     |
| `/broadcast`       | Tenant broadcast console                        | 30, 33     |
| `/connections`     | Connections + eviction visualizer + kill switch | 17, 18     |
| `/audit`           | Lifecycle audit feed                            | 52-55      |
| `/labs/connection` | Manual connect/disconnect, backoff, attempts    | 60, 61, 63 |
| `/labs/ticket`     | Ticket auth flow                                | 59         |
| `/labs/replay`     | Reconnect and replay demonstrator               | 23-25      |
| `/labs/cluster`    | Multi-instance counters and revocation          | 38-40      |
| `/labs/both`       | Split-screen SSE + WS receiving the same emit   | 50         |

### 13.3 Signature components

Connection status badge (state machine of `useRealtimeConnection`), event inspector (last 50 events with id/type/payload), instance chip (which backend served the connection), eviction timeline, replay diff viewer.

## 14 · Design System

The shared Bymax example design system applies unchanged; it is versioned at [`docs/design_system.html`](./design_system.html) (same artifact as the sibling examples, originally established by `nest-auth-example`).

- **Identity:** the realtime example adopts the standard shell, tokens, dark-first palette and typography from the design system file; the accent color follows the file's per-example guidance.
- **The four files to copy verbatim** from a sibling `apps/web` (tokens css, tailwind preset, shell layout, status primitives) are enumerated in the design system file and land in the web skeleton phase.
- **Acceptance criterion:** the web app must be visually indistinguishable in structure from `nest-cache-example`'s dashboard (shell, nav, cards, status chips), with realtime-specific widgets built from the same primitives.

## 15 · Multi-Instance Topology

The `cluster` compose profile runs: `redis:7`, `app-a` (3001), `app-b` (3002), nginx (8080).

nginx rules (the honest part):

- SSE location: `proxy_buffering off`, `proxy_cache off`, `gzip off`, `proxy_read_timeout` well above heartbeat, `X-Accel-Buffering: no` honored; `Cache-Control: no-cache, no-transform` sent by the app.
- WS location: upgrade headers plus `ip_hash` sticky sessions, because `@socket.io/redis-adapter` syncs messages, not handshake affinity; the polling fallback breaks without stickiness. The alternative (`transports: ['websocket']`) is documented in the chat page.
- Round-robin for plain HTTP so the two instances genuinely interleave, making the fan-out labs meaningful.

## 16 · Local Stack and Docker

- `docker-compose.yml`: `redis:7-alpine` always; `cluster` profile adds the two api containers (one image, different `PORT`/`INSTANCE_NAME`) and nginx.
- `docker/api.Dockerfile`: multi-stage, non-root, Node 24 alpine.
- Inner loop: `docker compose up -d redis && pnpm dev` (api 3001 + web 3000, memory pub/sub).
- Cluster loop: `docker compose --profile cluster up -d` then web pointed at `http://localhost:8080`.
- File-descriptor and memory notes from the library spec are quoted in the README capacity section.

## 17 · Error Handling

- API errors follow a stable JSON envelope (small local filter; adopting `@bymax-one/nest-core` is noted as a future swap once published).
- Realtime error codes are surfaced to the UI verbatim (`REALTIME_*`), each with a lab that triggers it (matrix §7.9).
- The client `error` reserved event is rendered in the event inspector with its code and message.

## 18 · Quality Gates

| Gate          | Bar                                                                                                                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript    | strict, no `any`, no suppression comments                                                                                                                                               |
| Lint          | ESLint flat config, zero warnings; forbidden-import rules (web cannot import the server subpath; api cannot import react)                                                               |
| Unit coverage | 100% line/branch/function/statement on `apps/api` (Jest) and `apps/web` (Vitest), thresholds pinned in config                                                                           |
| E2E           | Every HTTP route; SSE flows via `eventsource` client; WS flows via `socket.io-client`; multi-instance suite against the compose cluster profile, run sequentially as the heaviest suite |
| Frontend      | Next build clean; Playwright smoke journey per page; bundle assertion that the SSE-only build contains no `socket.io-client`                                                            |
| Mutation      | Stryker on `apps/api`, pre-release gate, `break: 95` minimum (target 100, sibling precedent)                                                                                            |
| Export audit  | Final phase asserts every §7 matrix row references an implemented route/page/test; every library export appears in the example code at least once                                       |
| Memory safety | Jest/Vitest `maxWorkers: '50%'` pinned; one suite at a time; the cluster E2E never runs concurrently with unit suites                                                                   |

## 19 · CI and Repository Visibility

The repository is **private today and will become public**. CI is written once, with public-only features gated, never deleted:

- `ci.yml` (always on): install, typecheck, lint, unit (both apps, sequential steps), build, E2E job with a `redis:7` service container (cluster E2E behind a manual/`workflow_dispatch` trigger until runners prove stable).
- `codeql.yml` and `scorecard.yml`: committed from day one and gated on repository visibility, so they activate automatically when the repo flips public. CodeQL calls the org's reusable analysis, which resolves visibility through the API, so the answer is the same on every trigger; Scorecard uses `if: ${{ !github.event.repository.private }}`. No secrets in code; demo values only.
- Every phase merges through a PR with GitHub Copilot review requested and all findings addressed; CI green is a merge precondition from the very first PR.

## 20 · Out of Scope

- Publishing this app to npm (it is `private: true` forever).
- Production deployment manifests (k8s, cloud). Compose is the only supported runtime.
- Real user management, persistence, or payment domains.
- Load/soak testing and benchmark suites.
- E2E encryption of event payloads (TLS is assumed at the edge; documented per library spec).
- SockJS or other fallback transports beyond what Socket.IO provides natively.
