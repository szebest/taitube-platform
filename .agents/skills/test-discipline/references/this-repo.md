# This repo

`docs/standards/testing.md` owns the layers (unit, integration, end to end), the one
contract per port run from each implementation's spec, injected time, the shared fixtures
and the commands. What it means for SKILL.md:

- **Machine-checked already** (`tests/architecture/spec-discipline.test.ts`): runtime
  imports from `vitest`, sleeps and timer waits, wall-clock assertions, `typeof import`
  and `importOriginal<...>`, duplicate test titles, `console` calls, `.skip`/`.only`. So
  hard rule 4 and mock mechanic 2 (a bare `importOriginal()`) are enforced; mechanic 1
  (`vi.mock(import(...))` over a string path) and the rest of SKILL.md are not.
- **One spec per source file** (`tests/architecture/test-correspondence.test.ts`): a new
  source file gets its own `__tests__/<name>.test.ts`; one spec never covers two sources.
- **The real thing first** means the in-memory doubles in
  `packages/server/adapters/in-memory` (each with `.clear()`), PGlite for the Postgres
  repositories, and in the web app MSW handlers typed from `@vp/api-contracts`
  (`apps/client/web/AGENTS.md`, Rules 7 and 9).
- **Setup helpers that exist**: `buildTestApp` for the API, the worker harness in
  `apps/server/worker/src/__tests__/`, and `renderRoute`, `renderPage` and `serverRender`
  in `apps/client/web/src/__tests__/`. Hard rule 2 means using these, not a new one.
- **Worker and shared package specs also run under Bun** (`pnpm test:bun`): no
  `vi.setSystemTime`, inject the clock instead.
