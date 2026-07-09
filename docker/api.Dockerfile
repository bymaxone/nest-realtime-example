# syntax=docker/dockerfile:1
#
# Multi-stage image for the api workspace package.
#
# Stages:
#   base    - Node 24 Alpine with corepack-managed pnpm on PATH.
#   build   - installs the full workspace, builds the api, then prunes it into a
#             self-contained production deployment via `pnpm deploy`.
#   runtime - copies only the pruned deployment and runs it as a non-root user.
#
# The library under test is consumed from the committed vendor tarball, so the
# build needs no access to the sibling checkout or a registry entry for it.

FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME/bin:$PATH"
RUN corepack enable
WORKDIR /usr/src/app

FROM base AS build
COPY . /usr/src/app
# A cache mount keeps the pnpm store warm across builds without baking it into a
# layer. The lockfile is frozen so the image can never drift from the committed
# dependency graph.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter @nest-realtime-example/api build
# --legacy is required because the api has no injected workspace-package
# dependencies; pnpm 10 otherwise refuses to deploy a non-injected workspace.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter @nest-realtime-example/api --prod --legacy deploy /prod/api

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3001
# node:24-alpine ships an unprivileged `node` user (uid 1000); the deployment is
# owned by it so the process never runs as root.
COPY --from=build --chown=node:node /prod/api /app
WORKDIR /app
USER node
EXPOSE 3001
# Liveness is the library-owned /health route. A generous start-period tolerates
# a still-booting process before failed probes count against the retry budget.
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
