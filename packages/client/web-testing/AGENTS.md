# AGENTS.md — @vp/web-testing (spec helpers for the browser apps and packages)

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

Owner: ticket [54](../../../docs/tickets/54-frontend-testing-trophy-vitest-msw-integration-suite.md). `client` tier,
layer T5.

**Spec-only.** A spec, a vitest config or a spec helper imports it; source never does, and a manifest names it
under `devDependencies` only. That is why `check-boundaries.ts` lists it in `BUILD_TOOLING`: a lower package
such as `@vp/ui` (T2) may dev-depend on it, and a runtime dependency on it still fails `pnpm boundaries`.

## What it holds

- `apiServer` and the `api-server.setup` vitest setup: a request no handler answers stays in the process, is
  answered with a 500 and fails the test that made it (or the file, when it lands after the last test).
- `createEndpointMocks(baseUrl)`: `mockEndpoint(contract, resolver)` typed by `@vp/api-contracts`, at the API
  base URL the app's client calls. Each app builds its own from its `src/config`; this package reads no app
  config. `problemReply(code)` is the RFC 9457 body at the status the API reports.
- `renderRoute(getRouter, url, { handlers })` under jsdom and `serverRender(getRouter, path, { handlers,
  headers })` under node: the app's own router factory, its real route tree, queries that never retry.
- `runMutation`, `renderMutation`, `heldReply` for mutation hooks; `axeViolations()` for the WCAG A/AA rules.
- Contract-typed fixtures (`video`, `videoSummary`, `channel`, `account`, ...), checked against the contracts.
- The `jsdom.setup` vitest setup: the browser APIs jsdom lacks, and Start's isomorphic functions taking their
  client branch.

## What does not belong here

- Anything an app's specs alone use (`render-page`, `loader-api`, `stubBrowser`): it stays in that app's
  `src/__tests__/`.
- A dependency on `@vp/queries` or any app: this package sits below them so every one of them may use it.

```bash
pnpm --filter @vp/web-testing typecheck
pnpm --filter @vp/web-testing test
```
