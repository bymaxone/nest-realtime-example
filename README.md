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
