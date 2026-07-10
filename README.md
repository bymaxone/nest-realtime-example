<p align="center">
  <img src="https://img.shields.io/badge/%40bymax--one-nest--realtime--example-000000?style=for-the-badge&logo=nestjs&logoColor=E0234E" alt="nest-realtime-example" />
</p>

<h1 align="center">nest-realtime-example</h1>

<p align="center">
  <strong>Reference application for <a href="https://github.com/bymaxone/nest-realtime"><code>@bymax-one/nest-realtime</code></a></strong><br />
  <sub>NestJS 11 &middot; Next.js 16 &middot; React 19 &middot; SSE + WebSocket &middot; Redis pub/sub, replay, presence &middot; Multi-tenant</sub>
</p>

<p align="center">
  <a href="https://github.com/bymaxone/nest-realtime-example/actions/workflows/ci.yml"><img src="https://github.com/bymaxone/nest-realtime-example/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/coverage-100%25-brightgreen?style=flat-square" alt="coverage 100%" />
  <img src="https://img.shields.io/badge/mutation-api%20%E2%89%A595-brightgreen?style=flat-square" alt="mutation api >= 95" />
  <img src="https://img.shields.io/badge/matrix-75%2F75-brightgreen?style=flat-square" alt="feature matrix 75/75" />
  <img src="https://img.shields.io/badge/lib-%40bymax--one%2Fnest--realtime%200.1.0-6E56CF?style=flat-square" alt="library" />
  <a href="https://github.com/bymaxone/nest-realtime-example/blob/main/LICENSE"><img src="https://img.shields.io/github/license/bymaxone/nest-realtime-example?style=flat-square&colorA=000000&colorB=000000" alt="license" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript strict" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-24%2B-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js 24+" /></a>
  <a href="https://nestjs.com/"><img src="https://img.shields.io/badge/NestJS-11-E0234E?style=flat-square&logo=nestjs&logoColor=white" alt="NestJS 11" /></a>
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js&logoColor=white" alt="Next.js 16" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 19" /></a>
  <a href="https://socket.io/"><img src="https://img.shields.io/badge/Socket.IO-4-010101?style=flat-square&logo=socketdotio&logoColor=white" alt="Socket.IO 4" /></a>
  <a href="https://redis.io/"><img src="https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis&logoColor=white" alt="Redis 7" /></a>
</p>

<p align="center">
  <a href="https://github.com/bymaxone/nest-realtime">Library</a> &middot;
  <a href="#quick-start">Quick start</a> &middot;
  <a href="#reproducible-journeys">Journeys</a> &middot;
  <a href="#feature-coverage">Coverage</a> &middot;
  <a href="docs/TECHNICAL_SPECIFICATION.md">Docs</a>
</p>

---

## Overview

`@bymax-one/nest-realtime` is the **what**; this repository is the **how**. It is a runnable,
production-shaped application that exercises **every public export** of the library across a NestJS
API and a first-class Next.js dashboard, so anyone evaluating or adopting the library can read real,
tested code instead of reconstructing usage from API documentation.

The application models a **Live Operations Board** for a fictional multi-tenant SaaS: tenants watch
orders and deployments update live, receive alerts, chat inside incident rooms, and see who else is
online. The domain is deliberately thin. The realtime plumbing, and how it behaves under
authentication, replay, scaling and failure, is the actual subject of this repository.

It is three things at once:

- **A runnable demo.** `docker compose up -d redis` + `pnpm dev` brings up the NestJS API and the
  Next.js dashboard; the dashboard fires every realtime feature on demand and shows the result: a
  tenant emit that isolates, a stream that replays after a drop, a third tab that evicts the oldest,
  a connection killed by an operator.
- **A completeness proof.** Every one of the 75 rows of the spec [Feature Coverage
  Matrix](docs/TECHNICAL_SPECIFICATION.md#7-feature-coverage-matrix) maps to a real route, page or
  test in the committed [Coverage Audit](docs/COVERAGE_AUDIT.md), and a CI export-usage audit
  (`scripts/audit-exports.mjs`) asserts every library export is referenced in the example.
- **A copy-paste reference.** `apps/api/src/realtime/` wires the canonical `forRootAsync` once, so
  adopting the library is a matter of lifting the wiring you need.

It follows the Bymax example blueprint and quality bar: **100% test coverage** on both apps, a
**Stryker mutation gate (api break 95)**, English-only code, Conventional Commits, and no em dashes.

---

## Architecture

```
            apps/web (Next.js 16 + React 19): the Live Operations Board
   Live feed | Presence | Chat (WS) | Broadcast | Connections + eviction | Audit
   Labs: connection | ticket | replay | cluster | both (split screen)
        |  ./react hooks only (useRealtime, usePresence, useRealtimeConnection)     ^ SSE / WebSocket
        v  REST: /auth/* /emit/* /rooms/* /connections/* /labs/*                    | live events
   +----------------------------------------------------------------------------------------------+
   | apps/api (NestJS 11 + Express)                                                                |
   | BymaxRealtimeModule.forRootAsync({ useFactory }): realtime/options.factory.ts (every option)  |
   | RealtimeService | RedisRealtimePubSub | RedisOfflineQueue | RedisPresenceStorage | authenticators |
   +---------------------------------------------------+------------------------------------------+
                                                       | pub/sub | tickets | offline | presence
                                                       v
   +----------------------------------------------------------------------------------------------+
   | redis:7   (cluster profile adds app-a + app-b behind an SSE-safe, sticky nginx on :8080)      |
   +----------------------------------------------------------------------------------------------+
```

- **Single-instance dev** (`pnpm dev`): the web app talks to the API directly, the library uses its
  in-memory pub/sub, no proxy. This is the default inner loop.
- **Multi-instance profile** (`docker compose --profile cluster up`): nginx fronts two API instances,
  `RedisRealtimePubSub` fans an emit on one instance out to clients connected to the other, and
  sticky sessions cover the WebSocket polling fallback.
- The frontend never talks to Redis and never sees a `tenantId` it did not authenticate with; all
  isolation is server-side, as the library prescribes.

> **Coverage rule.** Every public export of `@bymax-one/nest-realtime` (`.`, `./shared`, `./react`)
> is referenced from the example or carries a spec-sanctioned justified exception, enforced on CI by
> [`scripts/audit-exports.mjs`](scripts/audit-exports.mjs).

---

## Quick start

```bash
git clone https://github.com/bymaxone/nest-realtime-example.git
cd nest-realtime-example

# 1) install workspace deps (the library resolves from a committed vendor tarball + pnpm patch)
pnpm install

# 2) start Redis (backs tickets, the offline queue, presence and cluster pub/sub)
docker compose up -d redis

# 3) copy the env template (every value is a local demo placeholder)
cp .env.example apps/api/.env

# 4) start both apps
pnpm dev
```

| Surface                | URL                                |
| ---------------------- | ---------------------------------- |
| Dashboard (`apps/web`) | <http://localhost:3000>            |
| API health             | <http://localhost:3001/health>     |
| SSE stream             | <http://localhost:3001/api/events> |

The library is **pre-publish**; both apps consume it from a committed package tarball under
[`vendor/`](vendor) plus a committed pnpm patch, so a fresh clone and CI resolve identical bytes
without a sibling checkout. See [Library consumption](#library-consumption) for the details and the
[NPM switch procedure](docs/NPM_SWITCH.md) for moving to the published version once it ships.

### Cluster (multi-instance) loop

```bash
docker compose --profile cluster up -d --build   # redis + app-a:3001 + app-b:3002 + nginx:8080
# point a browser (or the cluster lab) at http://localhost:8080
docker compose --profile cluster down            # always tear down between profile switches
```

The cluster profile is what makes the fan-out, cross-instance revocation and presence labs
meaningful: nginx round-robins plain HTTP so the two instances genuinely interleave.

### Demo users

Login is a demo shortcut: `POST /api/auth/login` takes only a `username` (no password) and mints an
HMAC-signed HttpOnly session cookie. Three fixed identities span two tenants:

| Username     | Tenant   | Role     | Use for                                              |
| ------------ | -------- | -------- | ---------------------------------------------------- |
| `ana@acme`   | `acme`   | `admin`  | Operator views (connections list, eviction timeline) |
| `bob@acme`   | `acme`   | `member` | A second Acme session (tenant isolation, offline)    |
| `gil@globex` | `globex` | `admin`  | A second tenant (isolation, cross-tenant proofs)     |

---

## Reproducible journeys

Every journey below was executed against a fresh single-instance stack (`docker compose up -d redis`, the API on `:3001` with the `.env.example` values) and the **real observed output is quoted**. Copy the blocks verbatim. SSE streams are read with `curl -N` (unbuffered); `Ctrl-C` ends a stream.

### 1. First connection and a live emit (rows 10, 19, 21, 30)

```bash
API=http://localhost:3001/api
# log in; the cookie jar carries the HttpOnly session
curl -s -c cj.txt -H 'Content-Type: application/json' -d '{"username":"ana@acme"}' $API/auth/login
# -> {"userId":"ana@acme","tenantId":"acme","roles":["admin"]}

# open the SSE stream in one shell (leave it running)
curl -sN -b cj.txt $API/events
# emit to that user from another shell
curl -s -b cj.txt -H 'Content-Type: application/json' \
  -d '{"event":"order.created","data":{"orderId":"ORD-42","total":199}}' $API/emit/user/ana@acme
# -> {"accepted":true}
```

The stream receives the library's client-safe handshake, then the emit (note the fixed-width,
lexicographically sortable event id and that only client-safe traits are exposed, never internal
metadata):

```
event: connection:established
id: 1
data: {"connectionId":"6afd75fb-...","traits":{"userId":"ana@acme","tenantId":"acme","roles":["admin"]}}

event: order.created
id: 1783677102488-000001
data: {"orderId":"ORD-42","total":199}
```

### 2. Two-tenant isolation (rows 30, 33)

Log in as `ana@acme` (tenant `acme`) and `gil@globex` (tenant `globex`), open a stream for each, then:

```bash
curl -s -b acme.txt   -d '{"event":"deploy.started","data":{"service":"checkout"}}'   $API/emit/tenant/acme    # {"accepted":true}
curl -s -b acme.txt   -d '{"event":"system.notice","data":{"msg":"maintenance at 02:00"}}' $API/emit/broadcast # {"accepted":true}
```

The tenant emit reaches only Acme; the broadcast reaches both:

```
# ana (acme) stream            # gil (globex) stream
event: deploy.started          event: system.notice
event: system.notice           (deploy.started never arrives)
```

### 3. One-shot ticket auth (rows 11, 72)

`EventSource` cannot send custom headers, so a cross-origin SSE client authenticates with a one-shot
ticket on the query string. The ticket is redeemed with a Redis `GETDEL`, so it works exactly once:

```bash
TICKET=$(curl -s -b cj.txt -X POST $API/auth/ticket | jq -r .ticket)
curl -sN "$API/events?ticket=$TICKET"          # connects: event: connection:established ...
curl -s -o /dev/null -w '%{http_code}\n' "$API/events?ticket=$TICKET"   # -> 401 (reuse rejected)
```

### 4. Honest heartbeat (row 22)

Leaving a stream open for a heartbeat interval shows the keepalive as a raw SSE comment. It carries no
`id:` and no `event:`, so it never fires a client listener:

```
: keepalive
```

### 5. Reconnect and replay (rows 23, 24, 28)

Open a stream, emit a burst, drop the stream, emit more while disconnected, then reconnect with the
last id you saw. The library replays exactly the events you missed, in order:

```bash
curl -s -b cj.txt -d '{"count":3}' $API/labs/replay/emit-burst      # {"emitted":3}, last live id e.g. ...-000003
# (drop the stream) then, while disconnected:
curl -s -b cj.txt -d '{"count":3}' $API/labs/replay/emit-burst      # {"emitted":3} (buffered)
curl -sN -b cj.txt -H 'Last-Event-ID: <last-live-id>' $API/events   # replays the 3 missed lab.replay events, in order
```

### 6. Offline drain (rows 26, 27)

Emit to a user with **no** live connection; the events land in the Redis offline queue. When that user
connects with the drain cursor (`Last-Event-ID: 0`), the queue drains in order and purges:

```bash
curl -s -b admin.txt -d '{"userId":"bob@acme","count":3}' $API/labs/offline/emit   # {"emitted":3}
curl -s -b admin.txt "$API/labs/offline/peek?userId=bob@acme"                      # 3 queued events
curl -sN -b bob.txt -H 'Last-Event-ID: 0' $API/events                              # drains 3 lab.offline events
curl -s -b admin.txt "$API/labs/offline/peek?userId=bob@acme"                      # {"userId":"bob@acme","events":[]}
```

> The offline queue is off by default in the library; `.env.example` sets `OFFLINE_QUEUE_ENABLED=true`
> so this journey works out of the box (Redis is already up from the quick start).

### 7. FIFO eviction (rows 18, 71)

`REALTIME_MAX_CONNECTIONS_PER_USER=2`, so opening a third stream for one user evicts the oldest with
`REALTIME_TOO_MANY_CONNECTIONS` (never an HTTP 429). Open three streams for `ana@acme`, then:

```bash
curl -s -b ana.txt "$API/labs/eviction/timeline?userId=ana@acme"   # admin view of connect/evict times + reason
curl -s -b ana.txt $API/connections                                # exactly the 2 newest remain live
```

```json
{ "connectionId": "763c...", "evictedAt": "...", "reason": "REALTIME_TOO_MANY_CONNECTIONS" }
```

The oldest stream closes; the two newest keep receiving.

### 8. Instant revocation (rows 17, 40)

An operator (or a user logging out one device) closes a specific connection by id. The stream ends
immediately:

```bash
CID=<connectionId from the connection:established frame>
curl -s -b cj.txt -X POST "$API/connections/$CID/disconnect"       # {"disconnected":true}
```

Under the cluster profile, revoking a connection owned by the **other** instance closes it too
(proven by `apps/api/test/e2e-cluster/revocation.e2e-spec.ts`).

### 9. Chat over WebSocket and the `both` split screen (rows 46, 50)

These are browser and Socket.IO journeys rather than curl. Boot the WebSocket profile
(`REALTIME_TRANSPORT=websocket`) or the composite profile (`REALTIME_TRANSPORT=both`) and open the
dashboard:

- **Chat** (`/chat`): messages sent with `@Subscribe('chat.message')` fan out to the incident room;
  proven end to end by `apps/api/test/e2e/ws-chat.e2e-spec.ts`.
- **Both** (`/labs/both`): a single `POST /emit/tenant/...` lands exactly once on an `EventSource`
  client and exactly once on a `socket.io-client`, side by side; proven by
  `apps/api/test/e2e/both-fanout.e2e-spec.ts`.

### Operator introspection (row 8)

`GET /api/connections/introspection` (admin only) reads the library's exported Symbol DI tokens and
reports the wiring the module resolved at boot, without leaking any principal's data:

```bash
curl -s -b ana.txt $API/connections/introspection
```

```json
{
  "instanceId": "91403741-...",
  "transport": "sse",
  "transportKind": "sse",
  "sse": {
    "endpoint": "/api/events",
    "heartbeatMs": 10000,
    "replayBufferSize": 10,
    "maxConnectionsPerUser": 2,
    "emitConnectionEvent": true
  },
  "providers": {
    "authenticator": "CompositeAuthenticator",
    "hooks": "CompositeLifecycleHooks",
    "pubsub": "InMemoryPubSub",
    "presence": null
  }
}
```

---

## Dashboard pages

Every page consumes the library through `@bymax-one/nest-realtime/react` hooks only; the frontend
never imports the server subpath.

| Route              | Page                                            | Library features                        |
| ------------------ | ----------------------------------------------- | --------------------------------------- |
| `/`                | Live Operations Board (orders/deployments feed) | `useRealtime` (SSE), typed events       |
| `/presence`        | Presence roster per tenant                      | `usePresence`                           |
| `/chat`            | Incident room chat (WebSocket)                  | `useRealtime` (WS), `@Subscribe`        |
| `/broadcast`       | Tenant broadcast console                        | auto rooms, anti-IDOR guard             |
| `/connections`     | Connections + eviction visualizer + kill switch | registry, FIFO eviction, revocation     |
| `/audit`           | Lifecycle audit feed                            | `hooks.*`, `@OnConnect`/`@OnDisconnect` |
| `/labs/connection` | Manual connect/disconnect, backoff, attempts    | `reconnect` tuning, manual connect      |
| `/labs/ticket`     | Ticket auth flow                                | one-shot ticket connect                 |
| `/labs/replay`     | Reconnect and replay demonstrator               | `Last-Event-ID`, buffer size            |
| `/labs/cluster`    | Multi-instance counters and revocation          | Redis pub/sub, cross-instance kill      |
| `/labs/both`       | Split-screen SSE + WS receiving the same emit   | composite `both` transport              |

---

## Feature coverage

The contract of this repository is the spec [Feature Coverage
Matrix](docs/TECHNICAL_SPECIFICATION.md#7-feature-coverage-matrix): 75 rows, one per library feature,
transport mode, auth pattern, replay path and error code. The committed
[Coverage Audit](docs/COVERAGE_AUDIT.md) maps each row to a real route/page **and** a test that proves
it (verified **75 / 75 green**), and documents the seven places where the installed library realizes a
behaviour differently from the spec's illustrative wording (reconciliations, not gaps). The
export-usage half is enforced on CI:

```bash
pnpm audit:exports   # 68 library exports: 58 referenced, 10 justified exceptions, 0 unjustified
```

<!-- The SSE-to-WebSocket migration section that follows is the executable story behind matrix row 51. -->

## Migrating from SSE to WebSocket (or running both)

A common adoption path: launch on SSE because it needs no bearer tokens and works over plain HTTP,
then later add a feature (an incident chat, a low-latency cursor) that benefits from a bidirectional
socket. The library's third transport mode, `'both'`, is built for exactly that migration: it runs the
SSE endpoint and the WebSocket namespace side by side in one process, and every existing emit reaches
both without a single service-layer change. This repository proves that claim end to end in
[`apps/api/test/e2e/both-fanout.e2e-spec.ts`](apps/api/test/e2e/both-fanout.e2e-spec.ts): one
`POST /emit/tenant/...` call lands exactly once on an `eventsource` client and exactly once on a
`socket.io-client`, connected simultaneously as the same user, the split screen a real migration goes
through while some tabs are still on the old transport and some are already on the new one.

### The env diff

Flip one variable, defined in
[`apps/api/src/config/env.schema.ts`](apps/api/src/config/env.schema.ts):

```diff
- REALTIME_TRANSPORT=sse
+ REALTIME_TRANSPORT=both
```

### What flips automatically

Nothing else needs editing. The transport is read once, at boot, and every layer that needs to know
about it already branches on "is this SSE-only" rather than "is this WebSocket", so `'both'` takes the
WebSocket branch everywhere without a dedicated case:

- [`apps/api/src/main.ts`](apps/api/src/main.ts) registers the library's Socket.IO adapter whenever
  the transport is not SSE-only.
- [`apps/api/src/realtime/options.factory.ts`](apps/api/src/realtime/options.factory.ts) builds the
  `websocket` options block on the same condition.
- [`apps/api/src/chat/chat.module.ts`](apps/api/src/chat/chat.module.ts) registers the incident chat
  gateway the same way.
- [`apps/api/src/realtime/wiring.module.ts`](apps/api/src/realtime/wiring.module.ts) passes the
  resolved transport straight through to `BymaxRealtimeModule.forRootAsync`; the library builds the
  SSE controller and the WebSocket gateway together and hands both to one `CompositeTransport`, which
  fans a single emit to both transports.

### What stays untouched

Every service that emits or authenticates a connection is transport-blind and stays that way:
`emit.service.ts`, `rooms.service.ts` and the anti-IDOR guards call the library's transport-agnostic
`RealtimeService` API, never a concrete transport; `composite.authenticator.ts` already dispatches per
connection (cookie for the SSE tab, a short-lived bearer for the WebSocket tab), so both paths were
already exercised by the WebSocket-only profile.

### The one client-side change

The only thing that changes is which URL a page passes to `useRealtime`. The hook auto-detects the
transport from the URL scheme, so pointing it at a `wss://` URL is the entire migration for that page:

```tsx
import { useRealtime } from '@bymax-one/nest-realtime/react';

// Before: this page renders over SSE.
const sse = useRealtime<ChatEvent>({ url: '/api/events' });

// After: the same page, now over WebSocket, once REALTIME_TRANSPORT=both is live.
const ws = useRealtime<ChatEvent>({ url: 'wss://api.example.com/live', auth: { token } });
```

### The sticky-session caveat and rolling back

Once `'both'` runs behind more than one instance, the WebSocket namespace inherits the sticky-session
requirement of the WebSocket-only profile: `ip_hash` affinity for the Socket.IO transport endpoint,
documented with its honest failure mode in [`docker/nginx/nginx.conf`](docker/nginx/nginx.conf). The
SSE endpoint keeps round-robining. Because `'both'` never removes the SSE path, it is its own rollback
plan: revert a misbehaving page's `useRealtime` URL to the SSE endpoint and nothing server-side has to
change. Only drop back to `REALTIME_TRANSPORT=sse` once no client points at a `wss://` URL any more.

---

## Testing

Both apps are held to **100% unit coverage** (line, branch, function, statement), pinned in
`apps/api/jest.config.ts` and `apps/web/vitest.config.ts` so the threshold cannot silently regress.
Every HTTP route is proven by a route-inventory suite
([`apps/api/test/e2e/route-inventory.e2e-spec.ts`](apps/api/test/e2e/route-inventory.e2e-spec.ts))
that boots the app, reads the registered route table, and fails on any route missing from the typed
manifest, any manifest entry whose route was removed, any guarded route that does not reject an
anonymous caller with 401, and any validated route that does not reject a malformed body with 400.

### Suites and the order they run in

The suites are memory-sensitive: the linked library is reloaded into every Jest/Vitest worker, so two
suites sharing a machine multiply memory. They run **one at a time**, in this order, and the
multi-instance cluster suite always runs **alone**:

| Step                | Command                                                 | Covers                                                                   |
| ------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------ |
| Unit (api)          | `pnpm --filter @nest-realtime-example/api test`         | Jest unit suite, coverage pinned at 100%.                                |
| Unit (web)          | `pnpm --filter @nest-realtime-example/web test`         | Vitest unit suite, coverage pinned at 100%.                              |
| E2E (HTTP, SSE, WS) | `pnpm --filter @nest-realtime-example/api run test:e2e` | Route inventory plus the SSE and WebSocket flow suites, in-process.      |
| Playwright journeys | `pnpm --filter @nest-realtime-example/web run test:e2e` | One browser journey per dashboard page against a live api + web.         |
| Cluster (SSE)       | `pnpm run test:e2e:cluster`                             | The `cluster` compose profile, cross-instance fan-out and revocation.    |
| Cluster (WebSocket) | `pnpm run test:e2e:cluster:ws`                          | The same, with both instances serving Socket.IO over the Redis adapter.  |
| Export audit        | `pnpm audit:exports`                                    | Every library export is referenced or justified.                         |
| Mutation (api)      | `pnpm mutation`                                         | Stryker over `apps/api`, pre-release gate (`break: 95`), not run per PR. |

`pnpm test:e2e:all` runs the end-to-end half of that flow in order, bringing Redis up first and always
tearing the compose stack down afterwards. Every suite needs Redis (`docker compose up -d redis`); the
cluster suites additionally need ports 3001, 3002 and 8080 free. Mutation testing is heavy and runs
the api suite many times, so it is a pre-release command, run **alone**, not on every PR.

### CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs the same order as a sequential job chain,
so no two suites ever share a runner. **The job names are contractual** (they are the required checks
for branch protection when the repo goes public) and must not be renamed:

- **`ci`** - install, typecheck, lint, format check, both unit suites, build, the export-usage audit,
  and the bundle-honesty check.
- **`e2e`** (needs `ci`) - the HTTP/SSE/WebSocket suites against a `redis:7` service container.
- **`playwright`** (needs `e2e`) - the browser journeys, with a `redis:7` service container.
- **`e2e-cluster`** - the heaviest suite; gated to a manual `workflow_dispatch` run (never on push)
  until hosted runners prove it stable.

`codeql.yml` and `scorecard.yml` are committed and gated on repository visibility, so they activate
automatically when the repository becomes public.

---

## Library consumption

`@bymax-one/nest-realtime` is not yet published to npm, so both apps consume it from a committed
package tarball under [`vendor/`](vendor), referenced as
`file:../../vendor/bymax-one-nest-realtime-0.1.0.tgz`. This is a `pnpm pack` artifact (the exact bytes
npm would serve), so it is a link to the built package and not a copy of the library source. A
committed tarball resolves identically in a working tree, a fresh clone, and CI (which checks out only
this repository).

A committed **pnpm patch** ([`patches/@bymax-one__nest-realtime@0.1.0.patch`](patches)) fixes four
defects in `@bymax-one/nest-realtime@0.1.0` that a consumer would otherwise hit: the published build
was produced without `@swc/core`, so decorator metadata for type-based DI was omitted in the SSE
controller and the pub/sub subscriber, and the `websocket.namespace` option was declared but never
wired. The patch is a documented consumer workaround; it is removed once a fixed version is vendored
or published (the library needs a source-level rebuild with `@swc/core` and a namespace implementation).

To refresh the tarball after changing the sibling library:

```bash
pnpm -C ../nest-realtime build
pnpm -C ../nest-realtime pack --pack-destination "$PWD/vendor"
pnpm install
```

When the library publishes, moving to the pinned version is a one-line change per app plus a lockfile
refresh; the exact diff and verification flow are in [docs/NPM_SWITCH.md](docs/NPM_SWITCH.md).

---

## Capacity and proxy notes

- **SSE is one long-lived HTTP response per connection.** Size the process file-descriptor limit and
  any upstream connection caps for the peak concurrent-stream count, and keep `proxy_read_timeout`
  well above the heartbeat interval so an idle-but-healthy stream is never reaped.
- **Reverse proxies must not buffer SSE.** [`docker/nginx/nginx.conf`](docker/nginx/nginx.conf) sets
  `proxy_buffering off`, `proxy_cache off`, `gzip off` and honors `X-Accel-Buffering: no` on the SSE
  location; without this a proxy holds events until its buffer fills and the stream appears frozen.
- **WebSocket with the polling fallback needs sticky sessions.** `@socket.io/redis-adapter` syncs
  messages across instances, not handshake affinity, so the proxy uses `ip_hash` on the WebSocket
  locations. Plain HTTP round-robins so the fan-out labs interleave the two instances.
- **Redis backs tickets, the offline queue, presence and cross-instance pub/sub.** A single `redis:7`
  is enough for the demo; a production deployment sizes Redis for the queue retention and presence
  cardinality it configures.

---

## Documentation

| Doc                                                        | What it covers                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------- |
| [Technical Specification](docs/TECHNICAL_SPECIFICATION.md) | Architecture, tech stack, repository layout and the Feature Matrix. |
| [Coverage Audit](docs/COVERAGE_AUDIT.md)                   | The committed 75/75 matrix proof and the export-usage audit table.  |
| [Development Plan](docs/DEVELOPMENT_PLAN.md)               | The phased build plan, progress dashboard and global conventions.   |
| [NPM switch procedure](docs/NPM_SWITCH.md)                 | Moving from the vendored tarball to the published npm version.      |
| [Stryker results](docs/stryker/mutation_results.md)        | Mutation scores, survivor dispositions and the enforcement note.    |
| [Task index](docs/tasks/README.md)                         | Per-phase task breakdowns with acceptance criteria.                 |
| [Design system](docs/design_system.html)                   | The shared visual system the frontend is built on.                  |

---

## License

Released under the [MIT License](LICENSE). This is an example application: it is not published to npm
and is not intended for production deployment as-is.

Library source: [`@bymax-one/nest-realtime`](https://github.com/bymaxone/nest-realtime), MIT.
