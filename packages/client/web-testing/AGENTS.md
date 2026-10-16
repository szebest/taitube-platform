# AGENTS.md — @vp/web-testing (spec helpers for the browser apps and packages)

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

Owner: ticket [54](../../../docs/tickets/54-frontend-testing-trophy-vitest-msw-integration-suite.md). `client` tier,
layer T5.

**Spec-only.** A spec, a vitest config or a spec helper imports it; source never does, and a manifest names it
under `devDependencies` only. Every entry point resolves to `src/`, so a package's own vitest run and an app's
aliased one load the same `apiServer` its setup file listens on. That is why `check-boundaries.ts` lists it in `BUILD_TOOLING`: a lower package
such as `@vp/ui` (T2) may dev-depend on it, and a runtime dependency on it still fails `pnpm boundaries`.

## What it holds

Three entry points, so a spec loads only what its environment can hold: `@vp/web-testing` for any spec,
`@vp/web-testing/dom` (`renderRoute`, `runMutation`, `axeViolations`) for jsdom specs, and
`@vp/web-testing/server` (`serverRender`) for the specs that render a request. User-event registers hooks on
import that read `window.navigator`, which a node spec's stubbed `window` does not have; Start's server
handler, loaded by every node spec in a shared worker, left page renders in later files empty under load.

- `apiServer` and the `api-server.setup` vitest setup: a request no handler answers stays in the process, is
  answered with a 500 and fails the test that made it (or the file, when it lands after the last test).
- `api` and `mockEndpoint`, over `LOCAL_API_BASE_URL` (`http://localhost:3000`, where every client app calls
  the API when its build-time config is unset): a plain `@vp/api-client` client with no token, since MSW
  answers whatever is asked, and the handler factory typed by `@vp/api-contracts`. `createEndpointMocks(baseUrl)`
  builds `mockEndpoint` for another address. `problemReply(code)` is the RFC 9457 body at the status the API
  reports. `apiServer` starts with `sameOriginApiProxy`, the app's `/api` proxy minus its own concerns: a
  browser client's call to `<origin>/api/...` goes on to the local API, so the same `mockEndpoint` answers it.
- `renderRoute(getRouter, url, { handlers })` under jsdom and `serverRender(getRouter, path, { handlers,
  headers })` under node: the app's own router factory, its real route tree, queries that never retry.
- `renderPage(page, Providers, { queryClient, url, route, layout, handlers })` under node: one page the way the
  server renders it, inside the app's `Providers` (its `src/__tests__/providers.tsx`, what its root route
  mounts) over a cache the spec can seed, at `url` of a router whose one route is `route`.
- `runMutation`, `renderMutation`, `heldReply` for mutation hooks; `axeViolations()` for the WCAG A/AA rules.
- Contract-typed fixtures (`video`, `videoSummary`, `channel`, `account`, ...), checked against the contracts.
- `stubBrowser(stored)`: the `window` members an app reads while rendering on the server, over a storage the
  spec seeds and reads back, so a node spec needs no DOM environment.
- The `jsdom.setup` vitest setup: the browser APIs jsdom lacks, and Start's isomorphic functions taking their
  client branch.

## What does not belong here

- Anything an app's specs alone use (its `AppProviders`, `loader-api`, `signIn`): it stays in that app's
  `src/__tests__/`.
- A dependency on `@vp/queries` or any app: this package sits below them so every one of them may use it
  (`@vp/queries` and `@vp/ui` dev-depend on it, and turbo refuses a cyclic package graph), which is why
  `signIn` and `stubSession`, which need the token key and the account query, stay with each app.

```bash
pnpm --filter @vp/web-testing typecheck
pnpm --filter @vp/web-testing test
```
