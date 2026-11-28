# AGENTS.md - @kit/web-testing (generic spec helpers for the browser packages and apps)

> Tier rules for this directory: [../AGENTS.md](../../../client/AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../../AGENTS.md)

`client` tier, layer T3. Spec-only: a spec, a vitest config or a spec helper imports it; source never does, and a
manifest names it under `devDependencies` only (an app's own spec-helper package may list it as a dependency). It
knows no API client, contract, error registry or product: whatever needs one stays with the app.

Install: `pnpm add -D @kit/web-testing`. Tokens: none. Registries: none. Usage: see [README.md](README.md).

## What it holds

Three entry points, so a spec loads only what its environment can hold:

- `.` for any spec: `settle` waits for the queries, mutations and navigations a test started, and `trackRouter`
  registers a router it must wait for. An app's own render helper calls `trackRouter`.
- `./dom` for jsdom specs: `axeViolations()` (the WCAG A and AA rules, colour contrast left to the token specs),
  `createRenderCounter()` (commits per `Counted` subtree) and `showCues`.
- `./server` for node specs that render a request: `serverRender(getRouter, path, { headers })`, the router's real
  route tree rendered to a string inside the request context Start gives the server's code.

Three vitest setup files, which an app's config lists itself:

- `jsdom.setup`: the browser APIs jsdom lacks, Start's isomorphic functions taking their client branch, its server
  functions running over the cookie jar (`overCookieRequest`), every `BroadcastChannel` named per file, and the
  storage, cookies and TanStack Query managers emptied after every test.
- `settle.setup`: every test settles and unmounts before the next starts, and a React update after a test ended
  fails naming it. List it last so its `afterEach` runs first, with `RTL_SKIP_AUTO_CLEANUP=true` in the project.
- `server-functions.setup`: server functions running inside the request `serverRender` answers
  (`inRenderedRequest`).

## What does not belong here

- A dependency on an API client, a contract package or any app package; a mock server, a fixture or a helper typed
  by a contract belongs to the app's own spec-helper package.
- An app's providers, its session cookie's name or its endpoints.

```bash
pnpm --filter @kit/web-testing typecheck
pnpm --filter @kit/web-testing test
```
