# 54: Frontend testing infrastructure & integration suite (Vitest 3, Testing Library & MSW mock API)

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | M |
| Blocked by | 52 — Frontend monorepo integration · 53 — Frontend architecture |
| Blocks | 55, 56, 57, 58, 70, 75 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) |

**Status:** blocked

## What to build

A high-speed frontend without comprehensive, automated unit and integration tests inevitably suffers regressions during rapid feature additions. The legacy frontend had outdated Jest 27 configurations that broke with modern ESM modules and lacked mock API integration testing.

Following Kent C. Dodds' **Testing Trophy** philosophy (focusing heavily on integration tests that mock network boundaries rather than fragile implementation details), this ticket establishes the frontend test suite:

1. **Vitest 3 & React Testing Library Infrastructure**:
   - Modern, blazing-fast test runner (vitest) running directly in ESM mode without Babel/ts-jest overhead.
   - JSDOM test environment with @testing-library/react, @testing-library/user-event, and custom matchers (@testing-library/jest-dom/vitest).
   - Integrated with Turborepo: pnpm test executes tests in parallel across @vp/* and apps/web.
2. **MSW (Mock Service Worker) Integration Layer**:
   - Network-level mocking via MSW v2 (apps/web/src/test/mocks/handlers.ts) intercepting @vp/api-contracts endpoints.
   - Zero mocking of internal React state, hooks, or components: components render real DOM elements and perform real TanStack Query network lifecycles against the MSW mock server.
3. **Core Workflow Integration Tests**:
   - **Video Feed & Filtering:** Mounts <BrowsePage />, tests initial video card rendering, category pill filtering, and error toast presentation when network fails.
   - **Watch Page & Engagement:** Mounts <WatchPage />, tests clicking Like/Dislike (optimistic counter update and rollback on 500 error), submitting a comment (instant thread update), and timestamp seek clicks.
   - **Search & Auto-complete:** Mounts <SearchBar />, types query, asserts debounced suggestions popup displays results matching mock data.
4. **Hook & Utility Unit Tests**:
   - Tests useLocalStorage, useDebounce, and timestamp formatters.
   - 80%+ code coverage on core state hooks and UI utilities.

## Acceptance criteria

- [ ] Vitest 3 configured in apps/web/vitest.config.ts with JSDOM and @testing-library/react.
- [ ] MSW v2 network interception handlers established covering all @vp/api-contracts routes (/v1/feed, /v1/videos/:id, /v1/videos/:id/reactions, /v1/videos/:id/comments).
- [ ] Integration tests in apps/web/src/__tests__/:
  - feed.integration.test.tsx: Verifies public feed rendering, category switching, and infinite scroll pagination.
  - watch.integration.test.tsx: Verifies video details loading, optimistic like button mutation, and comment submission.
  - search.integration.test.tsx: Verifies autocomplete suggestions and search query dispatch.
  - optimistic-rollback.test.tsx: Verifies optimistic state rolls back with an error toast when MSW returns 500 Internal Server Error.
- [ ] Unit tests for date formatting, timecode parser, and query key helpers.
- [ ] Fast execution: Full frontend test suite executes in < 10 seconds locally.
- [ ] Command pnpm --filter @taitube/web test passes cleanly with 0 errors.

## Out of scope

- Real browser Playwright E2E tests (covered in ticket 68).

## Notes for the implementer

- Do not test implementation details (like component internal state); test user interactions via userEvent.click() and assert accessible text/roles (screen.getByRole('button', { name: /like/i })).
- Ensure MSW handlers reset cleanly between tests with server.resetHandlers().

## Testing plan

- Self-testing: Run pnpm --filter @taitube/web test --coverage and assert coverage metrics and test pass counts.

## Definition of Done

- [ ] All integration and unit tests green under pnpm test.
- [ ] CI workflow executes apps/web test suite.
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
