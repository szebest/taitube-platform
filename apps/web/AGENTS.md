# AGENTS.md — @vp/web (Frontend Application)

Instructions for any coding agent working on the Taitube web client (`apps/web`).

> **Read §1 before §4.** Most of what has been written about this app describes the framework it is *going
> to* run on, not the one it runs on today. This file states the actual stack first and keeps the target
> state in one clearly-labelled section at the end.

---

## 1. What this app actually is

A **Create React App 5** single-page application, arrived by `git subtree` and adopted into the workspace.

| Concern | Actual | Not |
|---|---|---|
| React | **18.3.1** | 19 |
| Build & dev server | **`react-scripts` 5.0.1** (webpack 5, Babel) through `@craco/craco`, whose one override (`craco.config.js`) adds a rule setting `resolve.fullySpecified: false` for files under `packages/`, so the workspace packages' extensionless ESM resolves | Vite / Nitro |
| Routing | **`react-router-dom` 6**, routes declared in `src/App.tsx` | TanStack Router, file-based routes |
| Server rendering | **none — CSR only**, `public/index.html` + a client bundle | streaming SSR |
| Data fetching | **RTK Query** (`@reduxjs/toolkit/query/react`) with `fakeBaseQuery` | TanStack Query |
| Styling | **Bootstrap 5 + `react-bootstrap`**, global SCSS under `src/styles/`, `*.module.scss` beside their components | Tailwind, Radix |
| Playback | **`react-player`** (`src/modules/shared/components/video-player/`) | `hls.js` |
| Forms | `react-hook-form`, `react-dropzone` | TanStack Form |
| Motion | `framer-motion` 10 | — |
| Tests | **vitest** (`environment: 'node'`, `globals: true`), no DOM and no Testing Library | jest, MSW |

There is **no Redux store and no slice**. `src/App.tsx` mounts `<ApiProvider api={baseApi}>`, which is RTK
Query's standalone provider — the store exists only to hold the query cache. Do not add `configureStore`,
reducers or slices to "complete" it; the next state a component needs belongs either in the URL, in a
provider under `src/modules/shared/providers/`, or in the query cache.

### The one seam that matters

`apps/web` is **tier `client`, layer T5**, one above `@vp/api-client` (T4); its workspace dependencies
are in [package.json](package.json).

It cannot import `@vp/core`, `@vp/adapters`, `@vp/db` or anything else under `packages/server/` — pnpm never
links them into `apps/web/node_modules`, so the import does not resolve. See
[packages/AGENTS.md](../../packages/AGENTS.md) for the tier rules and `pnpm boundaries` for the check.

**Every HTTP call goes through `apiClient`** from `src/base-api.ts`, which wraps `createApiClient` from
`@vp/api-client`. `axios` carries no API traffic; its one use is the PUT of file bytes to presigned storage
URLs in `src/modules/Upload/api/upload-video.ts`. A raw `fetch`, a new `axios` instance, or a hardcoded host
in a component is a boundary violation — the API base URL comes from `src/config/index.ts`
(`REACT_APP_API_BASE_URL`, defaulting to `http://localhost:3000`), which is what keeps Rule 1 local-first true
for the frontend.

### Layout

```
src/
├── App.tsx                     route table + provider stack
├── base-api.ts                 apiClient, baseApi, runApiQuery
├── auth-token.ts               localStorage token read/write
├── config/                     API base URL + localStorage keys
├── components/                 <Can> — app-wide, presentational
├── hooks/                      useCan
├── layout/                     chrome: components/ (header, sidebar, login, logo), containers/ (default-layout)
├── modules/<Feature>/          one folder per page: components/, api/, models/
│   └── shared/                 api/ (RTK Query endpoints), providers/, components/, hooks/, models/
└── styles/                     SCSS: abstract/, base/, components/
```

`src/modules/shared/api/*.ts` is where RTK Query endpoints live — one file per resource
(`feed-api.ts`, `videos-api.ts`, `account-api.ts`, `reactions-api.ts`, `subscriptions-api.ts`,
`categories-api.ts`), each `baseApi.injectEndpoints(...)` and each `queryFn` a
`runApiQuery(() => apiClient.<resource>.<call>(...))`. The upload endpoints are the one feature-local file,
`src/modules/Upload/api/uploads-api.ts`.

---

## 2. Rules that hold today

Rules 1, 2, 3, 5 and 6 are enforced by code or by review **now**. Rule 4 is the rule for new code and is not
built yet.

### Rule 1: Declarative authorization only
No component hand-checks a user id, a role or ownership. Permission decisions go through `useCan`
(`src/hooks/use-can.ts`) or the `<Can>` slot component (`src/components/can.tsx`), both of which evaluate the
memoized CASL ability from `PermissionsProvider`. Both call shapes are supported:

```tsx
<Can type="ability" do="create" on="Video">…</Can>
<Can type="rule" I={canUpdateVideo} this={{ video: { id, ownerId } }}>…</Can>
```

The rule builders themselves live in `@vp/permissions` and are shared verbatim with the API. If a check you
need is not expressible there, add the rule to `@vp/permissions` — do not branch in JSX. See
[docs/standards/authorization.md](../../docs/standards/authorization.md).

### Rule 2: Data fetching stays out of components
A component consumes a hook (`usePublicFeedQuery`, `useCan`, a provider) and renders. It does not call
`apiClient` directly, does not assemble query strings, and does not own pagination state — `page-merge.ts`
(`appendPage`) and the endpoints' `serializeQueryArgs` / `merge` / `forceRefetch` triple own infinite feeds.

### Rule 3: One test file per source file
`vitest.config.ts` collects `src/**/__tests__/**/*.test.{ts,tsx}`. Specs run under `environment: 'node'` with
`globals: true`, **so do not import `describe` / `it` / `expect` / `vi` from `vitest`** — they are globals
here. Type-only imports are still needed.

### Rule 4: Rules come from a package, and the component holds none

Not built yet: `apps/web` depends on neither `@vp/validation` nor `@vp/domain-rules`, and no hook returns a
`ViewState`. Tickets 53 and 70 build it, on top of 89. The authority is
[docs/standards/error-handling.md](../../docs/standards/error-handling.md).

- **`@vp/validation` is where a form check comes from.** It is universal, it takes the input and nothing else,
  and the API runs the identical function as the authority. The browser copy is a latency and UX
  optimisation, never the decision. The hardcoded `{ 'video/mp4': ['.mp4'] }` in `acceptFileTypes` of
  `src/modules/Upload/components/video-form/upload/upload-video-form.tsx` is the thing ticket 53 deletes:
  the API accepts the four types in `ALLOWED_CONTENT_TYPES`, so that literal is both a duplicate and wrong.
- **`@vp/domain-rules` is where an entity-dependent decision comes from** - the same rule the API runs,
  against an entity already in the query cache. Today the web gets the nearest thing from `@vp/permissions`:
  `<Can>` with a helper such as `canUpdateVideo`.
- **Limits are data.** A rule receives the ceiling and the allowed types; it never reads them. Where the
  frontend gets them - a field on an existing response or a small `GET /v1/config` - is ticket 53's call.
- **A hook unwraps the `Result`, a component never does.** The hook owns validation, submission, the
  failure-to-presentation mapping **and** the success path, and returns a `ViewState`:
  `{ status: 'idle' | 'loading' | 'success' | 'error'; data?; failure?; fieldErrors? }`. The component is
  `(viewState) => JSX`.
- **Forbidden in a component:** an API call, a `try/catch`, `if (failure.code === ...)`, a validation literal,
  and a success-path decision (navigate, invalidate, reset). If a component needs a rule, it needs a hook.
- **`present(failure)` is a total `switch` with `assertNever` in the `default`** - the mirror of the backend
  presenter, and the reason a new failure variant breaks this build too. The frontend and the backend share
  the **rule**, never the presenter: a `Problem` and a toast are different answers to the same failure.

### Rule 5: Components never format

Every number, date, duration and count reaches the page through `@vp/intl-react`, which `App.tsx` mounts as
`<IntlProvider>`: `<Format value={...} />` for a value on its own, `useT().tOr('videos.views', { count }, '')`
for a value inside words, and `useFormat()` when a component needs the string (a `title`, a grapheme-safe
`truncate`). No `toLocaleString()`, no `toFixed` for display, no `Intl` constructor and no `${n} views` in a
component: `no-adhoc-formatting.test.ts` fails on the first three. Specs render through `renderPage`, which
mounts the provider in `en` and UTC. The authority is
[docs/standards/formatting-and-i18n.md](../../docs/standards/formatting-and-i18n.md).

### Rule 6: Nothing phones home
No absolute third-party host in `src/` or `public/*.html`, no analytics beacon; `bootstrap-icons` is bundled
from `node_modules`. Everything resolves against `API_BASE_URL` (`local-first.test.ts`). See
[docs/LOCAL_FIRST.md](../../docs/LOCAL_FIRST.md).

---

## 3. Local commands

All verified from the repo root against the current tree.

```bash
# Dev server — serves on http://localhost:3000 (PORT=… to move it)
pnpm --filter @vp/web start

# Unit and component tests
pnpm --filter @vp/web test

# Typecheck
pnpm --filter @vp/web typecheck

# Production bundle — CRA writes to apps/web/build/, which apps/web/turbo.json declares as the cache output
pnpm --filter @vp/web build
```

There is no `dev` script; `start` is it. The root `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm build`
all cover this package, since `biome.json` does not exclude it. `typecheck` runs `tsc --noEmit` on
`tsconfig.json` (the program the editor reads) and then on `tsconfig.spec.json` for the specs.

**One caveat you will hit:** `start`'s type-check overlay can report
`TS2786: 'Can' cannot be used as a JSX component`. The dev server boots and serves correctly; the overlay is
`react-scripts` resolving its own pinned TypeScript, which predates React 18's `JSX.ElementType`. Under the
repo's TypeScript 5.7 the same code typechecks clean, which is why `pnpm --filter @vp/web typecheck` is the
command to trust.

---

## 4. Target state — not yet true

[SDD ADR-21](../../docs/SDD.md#adr-21--modern-frontend-framework-react-19--tanstack-start-ssr--tanstack-router-no-nextjs)
chose **React 19 + TanStack Start + TanStack Router + TanStack Query v5 + Vite + Tailwind CSS + Radix +
hls.js**. None of it is installed yet. The order is fixed:

1. **[Ticket 89](../../docs/tickets/89-web-tanstack-start-foundation.md) goes first**, ahead of every other
   frontend ticket: TanStack Start on Vite, file-based TanStack Router, TanStack Query in the router context,
   SSR, React 19, devtools and Vitest on Vite, with CRA, craco and react-scripts deleted. Legacy pages come
   across as thin routes with only mechanical edits (router imports swapped, SSR-safe storage), nothing
   redesigned.
2. Then 53 (data layer, deletes RTK Query), 54 (jsdom, Testing Library, MSW), 55 (Tailwind + Radix), 56
   (auth), 69 (URL modals) and the page tickets (57-61, 72-74) build on 89's structure. Each page ticket
   owns deleting the legacy module it replaces; 62 removes Bootstrap and what is left.

Until 89 lands, treat every TanStack / Vite / Tailwind / Radix / hls.js instruction anywhere in the repo as a
description of the destination.

### Structure 89 sets up

```
src/
├── routes/               file routes only: params, validateSearch, loader, head, component
├── features/<feature>/   new code: api/ (queryOptions, mutations), components/, hooks/
├── integrations/         query/ (QueryClient factory), auth/ (the auth seam in router context)
├── components/ui/        the design system (55)
├── modules/              legacy pages, deleted one by one by the page tickets
└── router.tsx            createRouter, context { queryClient, auth }, defaults
```

- **A route file stays thin.** It parses params and search with Zod, loads with
  `queryClient.ensureQueryData(xQueryOptions(...))`, and renders a component from `src/features/`. No
  fetching in a component body, no `useEffect` fetch.
- **URL state is a `validateSearch` schema on the route**, never component state that should survive a
  refresh or a shared link.
- **Loading and error UI are route `pendingComponent` / `errorComponent` / `notFoundComponent`**, not
  ad hoc spinners.
- **Nothing new goes into `src/modules/` or RTK Query.**

Adding TanStack or Tailwind ad hoc to a feature change before 89 lands is not "moving towards the target"; it
is a second stack in the same bundle. Take it through the tickets.

There are **no `apps/web`-scoped skills.** `web-tanstack-query`, `web-headless-ui` and `web-player-hls`
documented the target stack in the present tense and were removed in ticket 82 — they return with the
rewrite. The repo-wide library under `.agents/skills/` (registered at `.claude/skills`) still applies.

---

## 5. Also read

- [packages/AGENTS.md](../../packages/AGENTS.md) — tiers, layers and what `apps/web` may depend on
- [ARCHITECTURE.md](../../ARCHITECTURE.md) — Invariant 5, the tier boundary
- [docs/standards/authorization.md](../../docs/standards/authorization.md)
- [docs/standards/testing.md](../../docs/standards/testing.md)
- [docs/LOCAL_FIRST.md](../../docs/LOCAL_FIRST.md)
