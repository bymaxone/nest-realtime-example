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

## Quick start

The setup and run instructions land here as the application takes shape across the build's phase progression: a pnpm workspace with two apps (`apps/api`, a NestJS backend; `apps/web`, a Next.js frontend), a Redis-backed local stack, and the multi-transport boot profiles the library supports. Until then, the [Technical Specification](docs/TECHNICAL_SPECIFICATION.md) is the authoritative description of what will run and how.

## License

Released under the [MIT License](LICENSE). This is an example application: it is not published to npm and is not intended for production deployment as-is.
