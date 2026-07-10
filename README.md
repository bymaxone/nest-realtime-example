# nest-realtime-example

The canonical reference implementation of [`@bymax-one/nest-realtime`](https://github.com/bymaxone/nest-realtime), a dual-transport realtime library for NestJS. This repository is a working application, not a toy: it exercises every public feature, transport mode, authentication pattern, replay path and error code the library exposes, so that anyone evaluating or adopting the library can read real, tested code instead of reconstructing usage from API documentation alone.

The application models a Live Operations Board for a fictional multi-tenant SaaS: tenants watch orders and deployments update live, receive alerts, chat inside incident rooms, and see who else is online. The domain is deliberately thin. The realtime plumbing, and how it behaves under authentication, replay, scaling and failure, is the actual subject of this repository.

## Documentation

| Document                                                   | Purpose                                                                                                              |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [Technical Specification](docs/TECHNICAL_SPECIFICATION.md) | Architecture, tech stack, repository layout and the Feature Coverage Matrix that this repository implements against. |
| [Development Plan](docs/DEVELOPMENT_PLAN.md)               | The phased build plan, its progress dashboard, and the global conventions every phase follows.                       |
| [Task index](docs/tasks/README.md)                         | Per-phase task breakdowns, one file per phase, each with acceptance criteria and verification steps.                 |
| [Design system](docs/design_system.html)                   | The shared visual system the frontend is built on.                                                                   |

## Status

Build progress is tracked in the [Development Plan's progress dashboard](docs/DEVELOPMENT_PLAN.md#1-progress-dashboard), which is the single source of truth for what has landed and what is in flight.

## Transport parity

The library's promise is that the transport is a boot-time choice, not an application concern: the same backend serves clients over Server-Sent Events (`REALTIME_TRANSPORT=sse`) or WebSocket (`REALTIME_TRANSPORT=websocket`) with no change to any application service. WebSocket clients connect to the config-driven namespace (`REALTIME_WS_NAMESPACE`, default `/live`) authenticated by a short-lived bearer in the Socket.IO `handshake.auth.token`, while SSE clients use the cookie or ticket patterns an `EventSource` can carry.

Parity is proven, not asserted: one shared parity suite (tenant isolation, per-user, room and broadcast delivery, and the client-safe connection traits) runs unchanged against both profiles, and a static meta test confirms no application service branches on the transport. Sticky sessions (`ip_hash`) are required for the WebSocket polling fallback in a scaled deployment; the reverse-proxy config documents that requirement and its failure mode honestly.

## Migrating from SSE to WebSocket (or running both)

A common adoption path: launch on SSE because it needs no bearer tokens and works over plain HTTP, then later add a feature (an incident chat, a low-latency cursor) that benefits from a bidirectional socket. The library's third transport mode, `'both'`, is built for exactly that migration: it runs the SSE endpoint and the WebSocket namespace side by side in one process, and every existing emit reaches both without a single service-layer change. This repository proves that claim end to end in [`apps/api/test/e2e/both-fanout.e2e-spec.ts`](apps/api/test/e2e/both-fanout.e2e-spec.ts): one `POST /emit/tenant/...` call lands exactly once on an `eventsource` client and exactly once on a `socket.io-client`, connected simultaneously as the same user, the split screen a real migration goes through while some tabs are still on the old transport and some are already on the new one.

### The env diff

Flip one variable, defined in [`apps/api/src/config/env.schema.ts`](apps/api/src/config/env.schema.ts):

```typescript
REALTIME_TRANSPORT: z.enum(['sse', 'websocket', 'both']).default('sse'),
```

```diff
- REALTIME_TRANSPORT=sse
+ REALTIME_TRANSPORT=both
```

### What flips automatically

Nothing else needs editing. The transport is read once, at boot, and every layer that needs to know about it already branches on "is this SSE-only" rather than "is this WebSocket", so `'both'` takes the WebSocket branch everywhere without a dedicated case:

- [`apps/api/src/main.ts`](apps/api/src/main.ts) registers the library's Socket.IO adapter whenever the transport is not SSE-only:

  ```typescript
  if (config.realtime.transport !== 'sse') {
    app.useWebSocketAdapter(new RealtimeIoAdapter(app));
  }
  ```

- [`apps/api/src/realtime/options.factory.ts`](apps/api/src/realtime/options.factory.ts) builds the `websocket` options block on the same condition, so the namespace, CORS, payload cap and ping settings are present for `'both'` exactly as they are for `'websocket'`:

  ```typescript
  if (config.realtime.transport === 'sse') return undefined;
  ```

- [`apps/api/src/chat/chat.module.ts`](apps/api/src/chat/chat.module.ts) registers the incident chat gateway the same way:

  ```typescript
  return transport === 'sse' ? [] : [ChatGateway, ChatRateLimiter];
  ```

- [`apps/api/src/realtime/wiring.module.ts`](apps/api/src/realtime/wiring.module.ts) passes the resolved transport straight through to `BymaxRealtimeModule.forRootAsync`; the library builds the SSE controller and the WebSocket gateway together and hands both to one `CompositeTransport`, which is what fans a single emit to both transports.

### What stays untouched

Every service that emits or authenticates a connection is transport-blind, and stays that way:

- Emits never change. [`apps/api/src/emit/emit.service.ts`](apps/api/src/emit/emit.service.ts) calls the library's `RealtimeService` the same way regardless of the boot profile:

  ```typescript
  emitToUser(userId: string, event: string, data: unknown): Promise<void> {
    return this.realtime.emitToUser(userId, event, data);
  }
  ```

- Server-side auth never changes. [`apps/api/src/auth/composite.authenticator.ts`](apps/api/src/auth/composite.authenticator.ts) already dispatches per connection, not per boot profile: a cookie session keeps authenticating the SSE tab, and the existing `POST /api/auth/ws-token` endpoint keeps minting the short-lived bearer the WebSocket tab needs. Neither path is new; both were already exercised by the WebSocket-only profile.
- Room membership, tenant isolation and the anti-IDOR guards in `emit.service.ts` and `rooms.service.ts` are unaffected, because they operate on the library's transport-agnostic `RealtimeService` API, never on a concrete transport.

### The one client-side change

The only thing that changes is which URL a page passes to the `useRealtime` hook from `@bymax-one/nest-realtime/react`. The hook auto-detects the transport from the URL scheme, so pointing it at a `wss://` URL is the entire migration for that one page:

```tsx
import { useRealtime } from '@bymax-one/nest-realtime/react';

// Before: this page renders over SSE.
const sse = useRealtime<ChatEvent>({ url: '/api/events' });

// After: the same page, now over WebSocket, once REALTIME_TRANSPORT=both is live.
const ws = useRealtime<ChatEvent>({ url: 'wss://api.example.com/live', auth: { token } });
```

This snippet is the library's own `./react` API (see the installed `@bymax-one/nest-realtime` package README, "Frontend" section); this repository's frontend adopts it once its dashboard pages land. Every page that keeps calling `useRealtime({ url: '/api/events' })` keeps receiving the exact same events over SSE, delivered by the exact same `emitToTenant` / `emitToUser` / `emitToRoom` calls that now also reach the WebSocket page.

### The sticky-session caveat

Once `'both'` runs behind more than one instance, the WebSocket namespace inherits the same sticky-session requirement the WebSocket-only profile has: `ip_hash` affinity for the Socket.IO transport endpoint and for connection-keyed room calls, documented with its honest failure mode in [`docker/nginx/nginx.conf`](docker/nginx/nginx.conf). The SSE endpoint keeps round-robining as before; only the WebSocket-serving locations need the sticky upstream.

### Rolling back

Because `'both'` never removes the SSE path, it is its own rollback plan while the migration is in flight: if the new WebSocket page misbehaves, revert its `useRealtime` URL to the SSE endpoint and nothing server-side has to change. Once every client is confirmed working over WebSocket (or the plan is to keep supporting both kinds of clients), leave the transport at `'both'`. Only drop back to `REALTIME_TRANSPORT=sse` after no client points at the WebSocket URL any more: doing so earlier stops the server from serving the `/live` namespace, so any tab still connected over `wss://` gets a Socket.IO `connect_error` and never reconnects until its own `useRealtime` URL is reverted to the SSE endpoint too.

## Quick start

The setup and run instructions land here as the application takes shape across the build's phase progression: a pnpm workspace with two apps (`apps/api`, a NestJS backend; `apps/web`, a Next.js frontend), a Redis-backed local stack, and the multi-transport boot profiles the library supports. Until then, the [Technical Specification](docs/TECHNICAL_SPECIFICATION.md) is the authoritative description of what will run and how.

### Library consumption (prerequisite)

`@bymax-one/nest-realtime` is not yet published to npm, so both apps consume it from a committed package tarball under [`vendor/`](vendor), referenced as `file:../../vendor/bymax-one-nest-realtime-0.1.0.tgz`. This is a `pnpm pack` artifact of the sibling checkout, which is the exact bytes npm would serve, so it is a link to the built package and not a copy of the library source.

A committed tarball is used instead of a bare relative `file:` link to the sibling checkout because it resolves identically in three places: a working tree, a fresh clone, and CI (which checks out only this repository and never the sibling). Consuming the library from a directory path outside the repository fails in the last two.

To refresh the tarball after changing the sibling library:

```bash
pnpm -C ../nest-realtime build
pnpm -C ../nest-realtime pack --pack-destination "$PWD/vendor"
pnpm install
```

When the library publishes, this becomes a one-line change per app: replace the `file:` specifier with `^0.1.0` and refresh the lockfile.

## License

Released under the [MIT License](LICENSE). This is an example application: it is not published to npm and is not intended for production deployment as-is.
