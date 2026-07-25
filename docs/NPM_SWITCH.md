# NPM switch procedure

How this repository moves from consuming `@bymax-one/nest-realtime` as a committed vendor tarball to consuming the published npm package, and the CI contract that guards both states.

## Current state (pre-publish)

The library is **not yet published to npm**. Verify at any time:

```bash
npm view @bymax-one/nest-realtime version
# today: npm error 404 Not Found (the package does not exist on the registry yet)
```

Because it is unpublished, both apps consume it from a committed `pnpm pack` tarball:

- `apps/api/package.json` and `apps/web/package.json` depend on
  `"@bymax-one/nest-realtime": "file:../../vendor/bymax-one-nest-realtime-0.1.0.tgz"`.
- [`vendor/bymax-one-nest-realtime-0.1.0.tgz`](../vendor) is the exact bytes npm would serve.

This resolves identically in a working tree, a fresh clone, and CI (which checks out only this repository, never a sibling), so **the switch is documented here rather than executed.**

## Formerly-patched library defects (now fixed at the source)

An earlier vendored build needed a committed pnpm patch. Four consumer-visible defects made it necessary, and all four are fixed in the library source that produced the current tarball, so no patch is applied any more:

1. **Missing decorator metadata on the SSE controller.** The dist was built without decorator metadata, so the SSE controller could not resolve its type-injected handler. The source now injects it by token explicitly.
2. **Missing decorator metadata on the pub/sub subscriber.** Same cause on the Redis pub/sub subscriber path; also injected by token now.
3. **`websocket.namespace` declared but never wired.** The option was part of the public type but the IoAdapter never bound the gateway to it. The adapter now overrides `create` and binds the namespace.
4. **React hooks missing the options this dashboard needs.** The hooks had no way to subscribe to application-level SSE event names and no reconnect budget, and they keyed their connect callback on the `auth` and `events` object identity, which made any consumer passing an inline object reconnect on every render. The hooks now accept `events`, `maxAttempts`, `reconnectInitialMs` and `reconnectMaxMs`, report `reconnectAttempts`, and depend only on stable primitives.

## Refreshing the vendor tarball (while still pre-publish)

After changing the sibling library checkout:

```bash
pnpm -C ../nest-realtime build
pnpm -C ../nest-realtime pack --pack-destination "$PWD/vendor"
pnpm install
```

## Executing the switch (once the library publishes a fixed version)

Do this only after `npm view @bymax-one/nest-realtime version` resolves to a version that already contains the four fixes above.

1. **Update both manifests** (one line each):

   ```diff
   # apps/api/package.json and apps/web/package.json
   - "@bymax-one/nest-realtime": "file:../../vendor/bymax-one-nest-realtime-0.1.0.tgz",
   + "@bymax-one/nest-realtime": "^0.1.0",
   ```

2. **Drop the vendored tarball** under `vendor/`, which the published version replaces.

3. **Refresh the lockfile and reinstall:**

   ```bash
   pnpm install
   ```

4. **Re-run the full ordered flow** (the same order CI runs; each suite alone):

   ```bash
   pnpm typecheck && pnpm lint && pnpm format:check && pnpm build
   pnpm audit:exports
   pnpm --filter @nest-realtime-example/api test
   pnpm --filter @nest-realtime-example/web test
   pnpm --filter @nest-realtime-example/api run test:e2e
   pnpm --filter @nest-realtime-example/web run test:e2e
   pnpm run test:e2e:cluster && pnpm run test:e2e:cluster:ws
   pnpm mutation
   ```

   `pnpm audit:exports` re-runs against the published `.d.ts` files, proving the export surface did not drift; the e2e and mutation suites prove the published artifact behaves identically to the vendored one.

5. **Commit** as `build(deps): consume @bymax-one/nest-realtime from npm` with the lockfile change.

If `npm view` still 404s or the published version lacks the fixes, leave everything as-is: the vendored tarball is the supported pre-publish state.

## CI contract and branch protection

The CI job ids and their display names are **contractual** (see the note at the top of
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml)); renaming them breaks branch protection.

| Job id        | Display name (`name:`)                  | Trigger                      | Required check for PR merge |
| ------------- | --------------------------------------- | ---------------------------- | --------------------------- |
| `ci`          | `install, typecheck, lint, test, build` | pull_request, push, dispatch | yes                         |
| `e2e`         | `e2e (http, sse, ws)`                   | pull_request, push, dispatch | yes                         |
| `playwright`  | `playwright journeys`                   | pull_request, push, dispatch | yes                         |
| `e2e-cluster` | `e2e cluster (manual)`                  | workflow_dispatch only       | no (manual pre-release run) |

When the repository becomes public, set branch protection on `main` to require the three PR-gating
checks above (`install, typecheck, lint, test, build`, `e2e (http, sse, ws)`, `playwright journeys`),
require a pull request with the GitHub Copilot review, and require branches to be up to date before
merge. The `codeql.yml` and `scorecard.yml` workflows activate automatically on the visibility flip
and can be added to the required set once their first public run is green. The `e2e-cluster` job stays
a manual pre-release run until hosted runners prove the compose stack stable.
