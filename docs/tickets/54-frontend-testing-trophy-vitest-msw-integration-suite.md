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

- [ ] `jsdom` project configured; `pnpm --filter @vp/web test` runs both projects.
- [ ] MSW handlers typecheck against `@vp/api-contracts`; a `@ts-expect-error` spec holds for a wrong response
      shape.
- [ ] An unhandled request fails the test that made it.
- [ ] `renderRoute` exists with its own spec, and the proof test on a legacy route passes through it.
- [ ] No spec imports `describe`, `it`, `expect` or `vi`.
- [ ] CI runs the web suite inside its current budget.

## Out of scope

- Vitest on Vite, the `node` project: [89](89-web-tanstack-start-foundation.md).
- Feed, watch, search and optimistic-rollback tests: the page tickets ([58](58-modern-browse-layout-microinteractions-motion.md), [59](59-video-watch-page-responsive-layout-enhancements.md), [74](74-frontend-multi-resource-search-discovery-ui.md)) and [53](53-frontend-architecture-modernization-tanstack-query.md).
- Coverage targets.
- Playwright in a real browser: [75](75-fullstack-e2e-playwright-security-perf-validation.md).

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] `docs/standards/testing.md` or `apps/web/AGENTS.md` shows how to write a route spec with `renderRoute`.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
