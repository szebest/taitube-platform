# 54: Frontend testing infrastructure & integration suite (Vitest 3, Testing Library & MSW mock API)

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#54](https://github.com/szebest/taitube-platform/issues/54) |
| Size | M |
| Blocked by | 89 - TanStack Start foundation · 91 - Web import aliases |
| Blocks | 55, 56 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) |

**Status:** in-progress

## What to build

89 runs the web specs on Vitest through the app's Vite config, in the `node` environment. This ticket adds
what integration tests in the browser shape need, and one test that proves it. The tests for each page are
written by the ticket that builds the page.

- A `jsdom` Vitest project for component and route specs next to the existing `node` one, with
  `@testing-library/react`, `@testing-library/user-event` and `@testing-library/jest-dom/vitest`.
  `globals: true` stays, so specs import none of the test APIs.
- MSW v2 on the Node side, in `src/test/msw/`: handlers typed from `@vp/api-contracts` (a handler for a path
  or response the contracts do not have fails to compile), reset after each test, unhandled requests fail
  the test.
- A `renderRoute(url, { handlers?, auth? })` helper in `src/test/`: builds the real router from
  `routeTree.gen.ts` with memory history, a fresh `QueryClient` (no retries) and the given auth context, and
  renders it. Specs drive the app through URLs, not by mounting page components with hand-made providers.
- One proof integration test on a legacy route, for example `/watch/<id>`: the loader data renders, and a
  500 from MSW renders the route's error component.

## Acceptance criteria

- [x] `jsdom` project configured; `pnpm --filter @vp/web test` runs both projects.
- [x] MSW handlers typecheck against `@vp/api-contracts`; a `@ts-expect-error` spec holds for a wrong response
      shape.
- [x] An unhandled request fails the test that made it.
- [x] `renderRoute` exists with its own spec, and the proof test on a legacy route passes through it.
- [x] No spec imports `describe`, `it`, `expect` or `vi`.
- [x] CI runs the web suite inside its current budget.

## Out of scope

- Vitest on Vite, the `node` project: [89](89-web-tanstack-start-foundation.md).
- Feed, watch, search and optimistic-rollback tests: the page tickets ([58](58-modern-browse-layout-microinteractions-motion.md), [59](59-video-watch-page-responsive-layout-enhancements.md), [74](74-frontend-multi-resource-search-discovery-ui.md)) and [53](53-frontend-architecture-modernization-tanstack-query.md).
- Coverage targets.
- Playwright in a real browser: [75](75-fullstack-e2e-playwright-security-perf-validation.md).

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [x] `docs/standards/testing.md` or `apps/web/AGENTS.md` shows how to write a route spec with `renderRoute`.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.

## Open questions

- Decided: the helpers live in `src/__tests__/` (`render-route.tsx`, `msw/`), not `src/test/`, beside
  `renderPage` and `serverRender`. Everything under `__tests__/` is left out of the app's `tsconfig.json`, typed
  with the Vitest globals by `tsconfig.spec.json`, and not a production source for the architecture suite; a
  `src/test/` folder would be all three.
- Decided: a jsdom spec is named `<stem>.dom.test.tsx`. The file name says which project runs it, the `node`
  project excludes the pattern, and `test-correspondence` accepts it as the spec of `<stem>.tsx`, so a page
  ticket can write a route spec that only runs in the browser.
- Decided: MSW runs in both projects, so `serverRender` and `renderPage` take `handlers` too. A request no
  handler answers never leaves the process: MSW answers it with a 500, and the test that made it fails in
  `afterEach` with the request named. A thrown `InternalError` would reject the fetch instead, but MSW only
  throws one for its own `'error'` strategy, which also logs to the console.
- Decided: handlers are built from the zod contracts (`mockEndpoint(getVideo, resolver)`), not the generated
  `paths` types. The response is typed as `z.input` of the contract's result, which is what the API sends and
  what `apiClient` parses, and the path comes from the contract, so there is no string to get wrong.
- Decided: `getRouter` takes an options object (`history`, `queryClient`, `auth`, `nonce`), so `renderRoute`
  hands it a no-retry `QueryClient` and a session, and 75 can pass the CSP nonce.
