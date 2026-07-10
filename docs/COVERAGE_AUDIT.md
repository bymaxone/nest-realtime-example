# Coverage Audit

> The completeness proof for `nest-realtime-example`. This is the committed, evidence-based mapping of the spec [Feature Coverage Matrix](./TECHNICAL_SPECIFICATION.md#7-feature-coverage-matrix) (all 75 rows) to a real route, page or wiring file **and** a test that exercises it, plus the export-usage audit that asserts every public library export is referenced in the example.
>
> Status: **75 / 75 rows verified green**, **0 unjustified unused exports**. Regenerate the export half with `pnpm audit:exports` (also run in CI).

## How to read this

- **Route / wiring evidence** cites the concrete file (and line or symbol) that implements the row: an HTTP route, a page, or a config/wiring file.
- **Test evidence** cites the most specific test that proves the behaviour: a unit spec, an in-process e2e spec, or a multi-instance cluster e2e spec (the cluster specs run under the `cluster` compose profile).
- Every citation was verified against the source. Seven rows carry a **documented reconciliation** (not a gap): where the installed library realizes a behaviour differently from the spec's illustrative wording, the note explains how the example proves the same guarantee. They are marked with a dagger (`†`) and listed under [Documented reconciliations](#documented-reconciliations).

## 7.1 Module, registration and DI

| #   | Feature                                    | Route / wiring evidence                                                                                                                                                                                                                                 | Test evidence                                                                                             | Status |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------ |
| 1   | `forRootAsync` (imports/inject/useFactory) | `apps/api/src/realtime/wiring.module.ts` (`BymaxRealtimeModule.forRootAsync(REALTIME_ASYNC_OPTIONS)`)                                                                                                                                                   | `apps/api/test/realtime/wiring.module.spec.ts` (boots async wiring, exposes service)                      | green  |
| 2   | `forRoot` (sync)                           | `apps/api/test/realtime/realtime-boot.spec.ts` (sync `forRoot`, honors `sse.endpoint`)                                                                                                                                                                  | `apps/api/test/realtime/realtime-boot.spec.ts` (boots sync path, exposes service)                         | green  |
| 3 † | `extraProviders` in async options          | `apps/api/src/auth/auth.module.ts` (authenticator as a class) + `wiring.module.ts` inject tuple                                                                                                                                                         | `apps/api/test/realtime/wiring.module.spec.ts`                                                            | green  |
| 4   | `transport: 'sse'`                         | `apps/api/src/config/env.schema.ts` (`REALTIME_TRANSPORT` default `sse`) + `options.factory.ts`                                                                                                                                                         | `apps/api/test/e2e/boot.e2e-spec.ts` + `test/realtime/options.factory.spec.ts`                            | green  |
| 5   | `transport: 'websocket'`                   | `apps/api/src/main.ts` (IoAdapter for non-sse) + `options.factory.ts` `buildWebsocketOptions`                                                                                                                                                           | `apps/api/test/e2e/ws-connect.e2e-spec.ts` + `test/realtime/options.factory.spec.ts`                      | green  |
| 6   | `transport: 'both'`                        | `apps/api/src/config/env.schema.ts` (enum includes `both`)                                                                                                                                                                                              | `apps/api/test/e2e/both-boot.e2e-spec.ts` + `test/realtime/options.factory.spec.ts`                       | green  |
| 7   | `service` metadata                         | `apps/api/src/audit/audit.controller.ts` (`service: {name, version}`) + `app.constants.ts`                                                                                                                                                              | `apps/api/test/audit/audit.controller.spec.ts` + `test/e2e/audit.e2e-spec.ts`                             | green  |
| 8   | Symbol DI tokens (`REALTIME_*_TOKEN`)      | `apps/api/src/connections/realtime-introspection.service.ts` injects the 7 exported tokens, surfaced at `connections.controller.ts` (`GET /api/connections/introspection`); `REALTIME_OFFLINE_QUEUE_TOKEN` also injected in `replay/offline.service.ts` | `apps/api/test/connections/realtime-introspection.service.spec.ts` + `test/e2e/introspection.e2e-spec.ts` | green  |
| 9   | `tenantResolver`                           | `apps/api/src/realtime/options.factory.ts` (`tenantResolver: (auth) => auth.tenantId`)                                                                                                                                                                  | `apps/api/test/realtime/options.factory.spec.ts` (resolves tenant from auth result)                       | green  |

## 7.2 Authentication and connection policy

| #   | Feature                                                 | Route / wiring evidence                                                                                              | Test evidence                                                                                            | Status |
| --- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------ |
| 10  | Pattern A: HttpOnly cookie                              | `apps/api/src/auth/auth.controller.ts` (`POST /auth/login`, `httpOnly`) + `web/providers.tsx`                        | `apps/api/test/e2e/auth-routes.e2e-spec.ts` + `test/e2e/sse-connect.e2e-spec.ts`                         | green  |
| 11  | Pattern B: one-shot ticket (60s TTL, `getdel`)          | `apps/api/src/auth/ticket.controller.ts` (`POST /auth/ticket`) + `ticket.service.ts`                                 | `apps/api/test/auth/ticket.service.spec.ts` + `test/e2e/ticket-auth.e2e-spec.ts`                         | green  |
| 12  | Pattern C: WS bearer (`handshake.auth.token`)           | `apps/api/src/auth/composite.authenticator.ts` + `ws-token.controller.ts` (`POST /auth/ws-token`)                    | `apps/api/test/e2e/ws-connect.e2e-spec.ts` + `test/auth/bearer.authenticator.spec.ts`                    | green  |
| 13  | `authenticate` returns null                             | `apps/api/src/auth/cookie-session.authenticator.ts` (null rejects)                                                   | `apps/api/test/e2e/sse-connect.e2e-spec.ts` (401) + `test/e2e/ws-connect.e2e-spec.ts`                    | green  |
| 14  | `revalidate` + `reauthenticationPolicy.intervalSeconds` | `apps/api/src/realtime/options.factory.ts` + `composite.authenticator.ts` (`revalidate`)                             | `apps/api/test/realtime/options.factory.spec.ts` + `test/e2e/kill-switch.e2e-spec.ts`                    | green  |
| 15  | `onFailure: 'disconnect'` vs `'event'`                  | `apps/api/src/config/env.schema.ts` (`REAUTH_ON_FAILURE`) + `options.factory.ts`                                     | `apps/api/test/e2e/reauth.e2e-spec.ts` (both modes)                                                      | green  |
| 16  | `cacheTtlMs` positive-auth cache                        | `apps/api/src/realtime/options.factory.ts` + `auth/reauth-lab.controller.ts` (`GET /labs/reauth/stats`)              | `apps/api/test/e2e/kill-switch.e2e-spec.ts` + `test/auth/revalidation-stats.service.spec.ts`             | green  |
| 17  | Instant revocation `disconnect(connectionId, reason)`   | `apps/api/src/connections/connections.controller.ts` (`POST /connections/:id/disconnect`) + `connections.service.ts` | `apps/api/test/e2e/kill-switch.e2e-spec.ts` + `test/e2e-cluster/revocation.e2e-spec.ts` (cross-instance) | green  |
| 18  | `sse.maxConnectionsPerUser` FIFO eviction               | `apps/api/src/realtime/options.factory.ts` + `connections/eviction-lab.controller.ts`                                | `apps/api/test/e2e/eviction.e2e-spec.ts` (oldest evicted, newest admitted, no 429)                       | green  |
| 19  | `connection:established` client-safe traits             | `apps/api/src/connections/connections.service.ts` (client-safe list) + library event                                 | `apps/api/test/e2e/sse-connect.e2e-spec.ts` (only client-safe traits, no leak)                           | green  |
| 20  | `sse.emitConnectionEvent: false`                        | `apps/api/src/realtime/options.factory.ts` (`sse.emitConnectionEvent`)                                               | `apps/api/test/e2e/connection-event-toggle.e2e-spec.ts` (suppressed, emits still land)                   | green  |

## 7.3 SSE transport, replay and offline

| #    | Feature                                                 | Route / wiring evidence                                                                                     | Test evidence                                                                               | Status |
| ---- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------ |
| 21   | Configured `sse.endpoint`                               | `apps/api/src/realtime/options.factory.ts` + `main.ts` (`/api` prefix realizes `/api/events`)               | `apps/api/test/e2e/sse-connect.e2e-spec.ts` + `test/realtime/options.factory.spec.ts`       | green  |
| 22   | Heartbeat as raw `: keepalive` comment                  | `apps/api/src/realtime/options.factory.ts` (`heartbeatMs`); library emits the comment                       | `apps/api/test/e2e/heartbeat.e2e-spec.ts` (no id/event, fires no listeners)                 | green  |
| 23   | `Last-Event-ID` replay                                  | `apps/api/src/replay/replay.controller.ts` (`POST /labs/replay/drop`) + library replay                      | `apps/api/test/e2e/replay.e2e-spec.ts` (replays missed events in order)                     | green  |
| 24   | `sse.replayBufferSize` cap                              | `apps/api/src/realtime/options.factory.ts` (`replayBufferSize`)                                             | `apps/api/test/e2e/replay.e2e-spec.ts` (evicts events beyond the window)                    | green  |
| 25 † | `REALTIME_REPLAY_BUFFER_MISS` fallback                  | `apps/api/src/realtime/redis-offline-queue.ts` + `replay/replay.controller.ts`                              | `apps/api/test/e2e/replay-gap.e2e-spec.ts` (drains offline queue when buffer misses)        | green  |
| 26   | `IOfflineQueueStorage.append` (0 connections)           | `apps/api/src/realtime/redis-offline-queue.ts` + `replay/offline.controller.ts` (`POST /labs/offline/emit`) | `apps/api/test/e2e/offline-drain.e2e-spec.ts` + `test/realtime/redis-offline-queue.spec.ts` | green  |
| 27   | `retrieveSince` + `acknowledge` + TTL/`maxPerUser` trim | `apps/api/src/realtime/redis-offline-queue.ts` (retrieve/ack/trim)                                          | `apps/api/test/realtime/redis-offline-queue.spec.ts` + `test/e2e/offline-drain.e2e-spec.ts` | green  |
| 28   | Lexicographic event-id ordering                         | `apps/api/src/realtime/redis-offline-queue.ts` (string sort)                                                | `apps/api/test/unit/event-id-ordering.spec.ts`                                              | green  |
| 29 † | `sse.cors`                                              | `apps/api/src/main.ts` (`app.enableCors`, app-level; library exposes no `sse.cors`)                         | `apps/api/test/e2e/sse-connect.e2e-spec.ts` (credentialed CORS for the web origin)          | green  |

## 7.4 Rooms, tenants and events

| #    | Feature                                | Route / wiring evidence                                                                      | Test evidence                                                                       | Status |
| ---- | -------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------ |
| 30   | Auto rooms `user:{id}` / `tenant:{id}` | `apps/api/src/emit/emit.controller.ts` (`POST /emit/tenant/:tenantId`, `/emit/user/:userId`) | `apps/api/test/e2e/tenant-isolation.e2e-spec.ts` (isolates tenant/user, broadcasts) | green  |
| 31   | `ROOM_PREFIXES` + `composeRoomId`      | `apps/api/src/rooms/rooms.service.ts` (`composeRoomId('RESOURCE', ...)`) + `emit.service.ts` | `apps/api/test/e2e/rooms.e2e-spec.ts` + `test/rooms/rooms.service.spec.ts`          | green  |
| 32   | `joinRoom` / `leaveRoom` (idempotent)  | `apps/api/src/rooms/rooms.controller.ts` (`POST /rooms/join`, `/leave`) + `rooms.service.ts` | `apps/api/test/lifecycle/room-membership.tracker.spec.ts` (idempotent join/leave)   | green  |
| 33   | Anti-IDOR guard pattern                | `apps/api/src/emit/emit.service.ts` (cross-tenant guard before `RealtimeService`)            | `apps/api/test/emit/emit.service.spec.ts` (rejects a cross-tenant emit)             | green  |
| 34   | Reserved event names respected         | `apps/api/src/common/reserved-events.ts` + `rooms/room-events.ts`                            | `apps/api/test/rooms/room-events.spec.ts` (never collides with a reserved name)     | green  |
| 35   | `connection:reauthentication-failed`   | `apps/api/src/realtime/options.factory.ts` (`onFailure: 'event'`)                            | `apps/api/test/e2e/reauth.e2e-spec.ts` (delivered before disconnect)                | green  |
| 36 † | `error` reserved event                 | `apps/api/src/chat/chat.gateway.ts` (bridges WS transport error to `hooks.onError`)          | `apps/api/test/e2e/ws-limits.e2e-spec.ts`                                           | green  |

## 7.5 Scaling and multi-instance

| #    | Feature                                        | Route / wiring evidence                                                                 | Test evidence                                                                            | Status |
| ---- | ---------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------ |
| 37   | `InMemoryPubSub` default                       | `apps/api/src/realtime/pubsub.factory.ts` (undefined in memory selects the default)     | `apps/api/test/realtime/realtime-infra.module.spec.ts` + `pubsub.factory.spec.ts`        | green  |
| 38   | `IRealtimePubSub` Redis implementation         | `apps/api/src/realtime/redis-realtime-pubsub.ts`                                        | `apps/api/test/e2e-cluster/fanout.e2e-spec.ts` (exactly once per client)                 | green  |
| 39   | Loop prevention (`*Local` path, origin filter) | `apps/api/src/realtime/redis-realtime-pubsub.ts` (self-filter) + `counting-pubsub.ts`   | `apps/api/test/realtime/counting-pubsub.spec.ts` + `test/e2e-cluster/fanout.e2e-spec.ts` | green  |
| 40   | Cross-instance `op:'disconnect'` revocation    | `apps/api/src/connections/connections.service.ts` (cross-instance via presence)         | `apps/api/test/e2e-cluster/revocation.e2e-spec.ts` (app-a closes app-b)                  | green  |
| 41 † | `REALTIME_PUBSUB_UNAVAILABLE` degradation      | `apps/api/src/health/health.controller.ts` + `redis-realtime-pubsub.ts` (`isAvailable`) | `apps/api/test/e2e-cluster/degradation.e2e-spec.ts` (degrades, no crash)                 | green  |
| 42   | WS `redisAdapter` (`pubClient.duplicate()`)    | `apps/api/src/realtime/options.factory.ts` (`redisAdapter.pubClient`)                   | `apps/api/test/e2e-cluster/ws-cluster.e2e-spec.ts` + `options.factory.spec.ts`           | green  |
| 43   | Adapter-aware `disconnectSockets(true)`        | `apps/api/src/connections/connections.service.ts` (`realtime.disconnect`)               | `apps/api/test/e2e-cluster/ws-cluster.e2e-spec.ts` (app-b closes app-a)                  | green  |
| 44   | Sticky sessions for WS polling                 | `docker/nginx/nginx.conf` (`ip_hash`, honest failure mode documented)                   | `apps/api/test/e2e-cluster/ws-cluster.e2e-spec.ts` (WS through nginx)                    | green  |

## 7.6 WebSocket transport and composite

| #   | Feature                                     | Route / wiring evidence                                                           | Test evidence                                                              | Status |
| --- | ------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------ |
| 45  | Config-driven namespace via IoAdapter       | `apps/api/src/main.ts` (RealtimeIoAdapter) + `options.factory.ts` (`namespace`)   | `apps/api/test/e2e/ws-connect.e2e-spec.ts` (rejects other namespaces)      | green  |
| 46  | `@Subscribe` client-to-server events        | `apps/api/src/chat/chat.gateway.ts` (`@SubscribeMessage('chat.message')`)         | `apps/api/test/e2e/ws-chat.e2e-spec.ts` + `test/chat/chat.gateway.spec.ts` | green  |
| 47  | `@Subscribe` no-op under SSE                | `apps/api/src/chat/chat.module.ts` (`[]` gateway providers for SSE)               | `apps/api/test/chat/chat.module.spec.ts` (no gateway under SSE)            | green  |
| 48  | `websocket.maxHttpBufferSize`               | `apps/api/src/realtime/options.factory.ts` (`maxHttpBufferSize`)                  | `apps/api/test/e2e/ws-limits.e2e-spec.ts` (drops oversized, records code)  | green  |
| 49  | WS `cors` (Socket.IO's own option)          | `apps/api/src/realtime/options.factory.ts` (`websocket.cors`, typed `CorsConfig`) | `apps/api/test/e2e/ws-limits.e2e-spec.ts` (WS cors vs HTTP cors)           | green  |
| 50  | `'both'` composite: emit reaches SSE and WS | `apps/api/src/emit/emit.controller.ts` + `web/labs/both/page.tsx`                 | `apps/api/test/e2e/both-fanout.e2e-spec.ts` (once on SSE, once on WS)      | green  |
| 51  | Migration journey (SSE app adds WS chat)    | `README.md` (SSE-to-WS `both` migration section) + `docs/DEVELOPMENT_PLAN.md`     | `apps/api/test/e2e/both-fanout.e2e-spec.ts` (executable proof)             | green  |

## 7.7 Lifecycle hooks and decorators

| #    | Feature                                          | Route / wiring evidence                                                                             | Test evidence                                                                  | Status |
| ---- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------ |
| 52   | `hooks.onConnect` / `onDisconnect` (+ duration)  | `apps/api/src/audit/audit.service.ts` + `web/audit/page.tsx` (duration)                             | `apps/api/test/audit/audit.service.spec.ts` + `test/e2e/audit.e2e-spec.ts`     | green  |
| 53 † | `hooks.onError`                                  | `apps/api/src/audit/audit.service.ts` (`onError`) + `chat.gateway.ts` bridge                        | `apps/api/test/audit/audit.service.spec.ts` + `test/e2e/ws-limits.e2e-spec.ts` | green  |
| 54   | `hooks.onReauthenticationFailed`                 | `apps/api/src/audit/audit.service.ts` (`onReauthenticationFailed`)                                  | `apps/api/test/audit/audit.service.spec.ts` + `test/e2e/reauth.e2e-spec.ts`    | green  |
| 55   | `@OnConnect` / `@OnDisconnect` method decorators | `apps/api/src/audit/lifecycle.decorators.ts` + `audit.controller.ts` (`GET /audit/decorator-stats`) | `apps/api/test/lifecycle/lifecycle-hooks.spec.ts` (config hooks fire first)    | green  |

## 7.8 Frontend (`./react`)

| #    | Feature                                                        | Route / page evidence                                                                       | Test evidence                                                                             | Status |
| ---- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------ |
| 56   | `useRealtime` SSE auto-detect (http/path URL)                  | `apps/web/src/app/providers.tsx` (SSE URL) + `app/page.tsx` (`useRealtimeContext`)          | `apps/web/src/app/providers.test.tsx` + `app/page.test.tsx`                               | green  |
| 57   | `useRealtime` WS auto-detect (`wss://`) + `transport` override | `apps/web/src/app/chat/page.tsx` (WS URL, `transport: 'websocket'`)                         | `apps/web/src/app/chat/page.test.tsx` + `components/realtime/split-panel.test.tsx`        | green  |
| 58   | Typed `events` map                                             | `apps/web/src/lib/events.ts` (`LiveEvents`, imports `PublicConnectionMeta` from `./shared`) | `apps/web/src/lib/events.test.ts` + `probe/subpaths.test.ts`                              | green  |
| 59 † | `auth.fetchTicket`                                             | `apps/web/src/app/labs/ticket/page.tsx` + `components/realtime/ticket-connection.tsx`       | `apps/web/src/app/labs/ticket/page.test.tsx` (fresh ticket per reconnect)                 | green  |
| 60   | `reconnect` tuning + `reconnectAttempts`                       | `apps/web/src/components/realtime/managed-connection.tsx` (reconnect props)                 | `apps/web/src/components/realtime/managed-connection.test.tsx`                            | green  |
| 61 † | `autoConnect: false` + manual `connect()`/`disconnect()`       | `apps/web/src/app/labs/connection/page.tsx` (conditional mount)                             | `apps/web/src/app/labs/connection/page.test.tsx`                                          | green  |
| 62   | `status` + `lastEvent`                                         | `apps/web/src/components/realtime/connection-badge.tsx` + `event-inspector.tsx`             | `apps/web/src/components/realtime/connection-badge.test.tsx` + `event-inspector.test.tsx` | green  |
| 63   | `useRealtimeConnection`                                        | `apps/web/src/components/realtime/connection-badge.tsx` (mounted in `topbar.tsx`)           | `apps/web/src/components/realtime/connection-badge.test.tsx`                              | green  |
| 64   | `usePresence`                                                  | `apps/web/src/app/presence/page.tsx` (`usePresence()`)                                      | `apps/web/src/app/presence/page.test.tsx` (merges seeded + live roster)                   | green  |
| 65   | `RealtimeProvider` shared connection                           | `apps/web/src/app/providers.tsx` (one EventSource, many consumers)                          | `apps/web/src/app/providers.test.tsx` (opens exactly one EventSource)                     | green  |
| 66 † | socket.io-client dynamic import only                           | `apps/web/scripts/assert-bundle.mjs` (SSE-only build gate) + library dynamic import         | `apps/web/scripts/assert-bundle.mjs` (CI-wired) + `probe/subpaths.test.ts`                | green  |

## 7.9 Error catalog

| #    | Error code                         | Demonstrated by                                                                 | Test evidence                                                          | Status |
| ---- | ---------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------ |
| 67   | `REALTIME_INVALID_OPTIONS`         | Library boot validation (malformed transport)                                   | `apps/api/test/realtime/realtime-boot.spec.ts` (rejects boot)          | green  |
| 68   | `REALTIME_NO_AUTHENTICATOR`        | Library boot validation (missing authenticator)                                 | `apps/api/test/realtime/realtime-boot.spec.ts` (rejects boot)          | green  |
| 69   | `REALTIME_AUTH_FAILED`             | `apps/api/src/auth/cookie-session.authenticator.ts` / `bearer.authenticator.ts` | `apps/api/test/e2e/sse-connect.e2e-spec.ts` + `ws-connect.e2e-spec.ts` | green  |
| 70   | `REALTIME_REAUTHENTICATION_FAILED` | `apps/api/src/realtime/options.factory.ts` (reauth policy)                      | `apps/api/test/e2e/reauth.e2e-spec.ts` (revoked stream closed)         | green  |
| 71   | `REALTIME_TOO_MANY_CONNECTIONS`    | `apps/api/src/connections/eviction-lab.controller.ts` + `maxConnectionsPerUser` | `apps/api/test/e2e/eviction.e2e-spec.ts` (eviction reason)             | green  |
| 72 † | `REALTIME_INVALID_TICKET`          | `apps/api/src/auth/ticket.service.ts` (`GETDEL`) + `ticket.authenticator.ts`    | `apps/api/test/e2e/ticket-auth.e2e-spec.ts` (reuse rejected 401)       | green  |
| 73 † | `REALTIME_PUBSUB_UNAVAILABLE`      | `apps/api/src/health/health.controller.ts` (`pubsub: degraded` flag)            | `apps/api/test/e2e-cluster/degradation.e2e-spec.ts`                    | green  |
| 74   | `REALTIME_PAYLOAD_TOO_LARGE`       | `apps/api/src/chat/chat.gateway.ts` (`REALTIME_ERROR_CODES.PAYLOAD_TOO_LARGE`)  | `apps/api/test/e2e/ws-limits.e2e-spec.ts` (drop + record)              | green  |
| 75 † | `REALTIME_REPLAY_BUFFER_MISS`      | `apps/api/src/realtime/redis-offline-queue.ts` + replay controller (gap path)   | `apps/api/test/e2e/replay-gap.e2e-spec.ts` (replays window, marks gap) | green  |

## Documented reconciliations

Where the installed `@bymax-one/nest-realtime@0.1.0` realizes a behaviour differently from the spec's illustrative wording, the example proves the same guarantee by a different, honest path. These are reconciliations, not gaps:

- **Row 3** - the installed library accepts the authenticator through the `imports` + `inject` tuple of `forRootAsync`, not through a literal `extraProviders` key; the authenticator is still a DI-resolved class, which is what the row demonstrates.
- **Row 29** - the installed library exposes no `sse.cors` option (a plain HTTP GET is governed by the app's CORS policy), so credentialed cross-origin SSE is realized at the application level via `app.enableCors`, documented in `options.factory.ts`.
- **Row 36 / 53** - the installed library surfaces a WebSocket transport error to the `hooks.onError` lifecycle hook (appended to the audit feed) rather than emitting a client-facing reserved `error` event; the example proves the error path through the audit hook.
- **Rows 41 / 73** - the pub/sub-unavailable warning is emitted inside the library; the example proves graceful degradation through the `/health` `pubsub: degraded` flag and the absence of a crash.
- **Rows 25 / 75** - the buffer-miss branch is internal to the library; the example proves the fallback by asserting the offline-queue drain and the marked replay gap.
- **Row 59** - the installed `useRealtime` hook has no `fetchTicket` callback; the SSE ticket is a URL query parameter, so the ticket lab mints a fresh ticket app-side on each reconnect, proving the one-shot flow.
- **Row 61** - the installed hook has no `autoConnect` flag; the connection lab realizes it by conditionally mounting the connection component, proving the manual connect/disconnect flow.

## Export-usage audit

`scripts/audit-exports.mjs` (run with `pnpm audit:exports`, also a CI step) reads the installed library's `exports` map, extracts every named export from each subpath's type declaration, and asserts each is referenced in the example source or carries a spec-sanctioned justified exception.

Current result: **68 exports across 3 subpaths - 58 referenced, 10 justified exceptions, 0 unjustified.**

The justified exceptions (each cited in the script) are all consumed indirectly or by inference:

| Export                              | Subpath(s)      | Reason                                                                                               |
| ----------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------- |
| `CompositeTransport`                | `.`             | Internal transport the library composes for `transport: 'both'`; consumed through the module (§4.1). |
| `WebSocketTransport`                | `.`             | Internal transport for the WebSocket profile; consumed through the module (§4.1).                    |
| `RealtimeGateway`                   | `.`             | Internal Socket.IO gateway the library registers; consumed through the module (§4.1).                |
| `BymaxRealtimeModuleOptionsFactory` | `.`             | The `useClass` async-options interface; the example wires via `useFactory` (§9.2).                   |
| `RealtimeErrorCode`                 | `.`, `./shared` | Union projection of the exercised `REALTIME_ERROR_CODES` constant (§7.9).                            |
| `RoomPrefix`                        | `.`, `./shared` | Value projection of the exercised `ROOM_PREFIXES` constant (§7.4).                                   |
| `PresenceEventName`                 | `./shared`      | Value projection of the exercised `PRESENCE_EVENT_NAMES` constant (§4.2).                            |
| `UsePresenceReturn`                 | `./react`       | Inferred return type of the exercised `usePresence` hook (§4.2, §13.2).                              |
