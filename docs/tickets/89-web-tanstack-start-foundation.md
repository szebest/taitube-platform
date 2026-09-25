# 89: Move apps/web from Create React App to TanStack Start - Vite, file-based TanStack Router, TanStack Query and SSR

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | L |
| Blocked by | 85 - Universal Intl formatting core · 88 - Codebase health to nine |
| Blocks | 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 68, 69, 70, 72, 73, 74, 75, 77, 78, 86, 91 |
| Spec | [SDD ADR-21 Frontend framework](../SDD.md#adr-21--modern-frontend-framework-react-19--tanstack-start-ssr--tanstack-router-no-nextjs) · [SDD §1.3 Design principles](../SDD.md#13-design-principles-used-to-break-ties-throughout) · [PRD §1 Summary](../PRD.md#1-summary) |

**Status:** done

> **Why this is first.** Every other frontend ticket assumes a router, loaders, SSR and Vite, and today
> `apps/web` is a CRA 5 single-page app on `react-router-dom` 6 and RTK Query. This ticket is the foundation
> the rest of the frontend builds on, so it goes ahead of all of them even though it carries a higher number
> (see the numbering note in [README](README.md)). It is a foundation, not a rewrite: legacy pages come across
> as thin working routes with only the mechanical edits the new router and SSR force on them, and the tickets
> that redesign them own deleting the legacy code.

## What to build

### 1. Toolchain

- TanStack Start (`@tanstack/react-start`) on Vite, React 19, TypeScript 5.7+. `react-scripts`, `@craco/craco`,
  `craco.config.js`, `public/index.html`, the `eslintConfig`/`browserslist` blocks and `@types/jest` are deleted,
  not left beside the new setup.
- Workspace packages resolve from source through Vite, so the webpack `resolve.fullySpecified` override goes
  with craco. Relative imports stay extensionless.
- `apps/web/tsconfig.json` extends the client base from `@vp/tsconfig` with `moduleResolution: "bundler"`,
  instead of its hand-written CRA config, and the `src/*` imports that lean on `baseUrl` get a matching Vite
  alias so the app, its specs and `tsc` resolve them the same way.
- Scripts: `dev` (Vite dev server with HMR, so the root `pnpm dev` starts the web app next to the API and
  worker), `build`, `start` (serves the built SSR server), `test`, `typecheck`. `apps/web/turbo.json` declares
  the real build output so turbo caches it.
- TanStack Router Devtools and TanStack Query Devtools mounted in dev only; the production bundle contains
  neither.

### 2. Routing

- File-based `@tanstack/react-router` with the generated `routeTree.gen.ts` committed, so `typecheck` works
  on a clean checkout. `Link`, `useParams`, `useSearch` and `navigate` are typed end to end.
- Every route declares `params` parsing and `validateSearch` with Zod, even when the search schema is still
  empty, so [69](69-frontend-url-state-search-params-modal-routing.md) only adds keys.
- Route-level code splitting through the router's automatic splitting, not hand-written `React.lazy`.
- Router defaults: `defaultPreload: 'intent'`, a pending delay (`defaultPendingMs`/`defaultPendingMinMs`) so a
  fast navigation never flashes a fallback, and a minimal `pendingComponent`, `errorComponent` and
  `notFoundComponent` at the root. [70](70-frontend-resilient-error-handling-retry-policy.md) replaces the
  error ones, [55](55-design-system-tailwind-radix-dark-theme.md) and the page tickets replace the pending ones.

### 3. Data and SSR

- One `QueryClient` per request on the server and one per tab in the browser, created in a factory and handed
  to the router **context**. SSR dehydrates and hydrates it through the TanStack Start/Query integration.
- The reference pattern, built once: the `/watch/$videoId` loader calls
  `queryClient.ensureQueryData(videoQueryOptions(videoId))` and the legacy watch page reads that one query
  with `useSuspenseQuery`. Every other endpoint stays on RTK Query until 53.
- The server renders the existing pages and the browser hydrates them. Route-level `ssr: false` is not the
  escape hatch: `ThemeProvider` and `SidebarProvider` wrap every route, so turning SSR off for them turns it
  off for the whole app. Instead:
  - 89 owns an SSR-safe storage hook in `src/hooks/` (a server default on the first render, the stored value
    read after mount) and the two root providers use it in place of `useLocalStorage` from
    `@uidotdev/usehooks`, which throws on the server. `getUsersPreferredTheme()` stops reading
    `window.matchMedia` during render and reads it after mount the same way.
  - The legacy `VideoPlayer` (`react-player` plus `useLocalStorage`) renders client-only inside the watch
    route, behind a mount check with the poster as the server fallback; the rest of the watch page renders on
    the server.
- `react-player` 2.16 loads hls.js from `cdn.jsdelivr.net` at runtime (`HLS_SDK_URL`), which breaks local-first.
  89 bundles `hls.js` and sets `window.Hls` before the player mounts, so react-player's `getSDK` uses it and
  never fetches the CDN copy.
- Typed environment: `src/config` parses `import.meta.env` with Zod once, `VITE_API_BASE_URL` replaces
  `REACT_APP_API_BASE_URL` (defaulting to `http://localhost:3000`), and nothing else in `src/` reads
  `import.meta.env` or `process.env`.

### 4. Structure for the tickets that follow

```
apps/web/src/
├── routes/               file routes only: params, validateSearch, loader, head, component - thin
├── features/<feature>/   new code: api/ (queryOptions, mutations), components/, hooks/
├── integrations/         query/ (QueryClient factory), auth/ (the auth seam in router context)
├── components/ui/        reserved for the design system (55)
├── modules/              legacy pages: router imports swapped, nothing redesigned; each page ticket deletes its folder
└── router.tsx            createRouter, context { queryClient, auth }, defaults
```

The seams each later ticket drops into without restructuring:

| Ticket | Seam 89 leaves |
|---|---|
| [53](53-frontend-architecture-modernization-tanstack-query.md) data layer | `integrations/query/`, the `videoQueryOptions` + loader pattern; `base-api.ts` is the RTK Query that 53 deletes |
| [55](55-design-system-tailwind-radix-dark-theme.md) design system | global styles imported in one place (`__root.tsx`), `components/ui/` empty |
| [56](56-frontend-universal-auth-session-security.md) auth | `auth` in router context and a pathless `_authed` layout route that wraps the legacy `AuthorizedContainer` today and becomes a `beforeLoad` guard in 56 |
| [69](69-frontend-url-state-search-params-modal-routing.md) URL state | a Zod `validateSearch` on every route |

### 5. Legacy pages carried over

Every URL that works today still resolves, with the legacy UI. Nothing below is polished or redesigned, but
the legacy code does get mechanical edits:

- `Link`, `useParams`, `useNavigate`, `Navigate` and `Outlet` from `react-router-dom` (in `DefaultLayout`, the
  sidebar, login, `VideoPage`, `EditPage`, `UserPage` and the video card) are swapped for their
  `@tanstack/react-router` equivalents, one for one, typed against the route tree.
- `renderPage`, `App.test.tsx` and `index.test.tsx` stop wrapping in `MemoryRouter` and render through the real
  router with memory history.
- `react-router-dom` and `react-router` are removed from `apps/web/package.json`.
- The two root providers and the player get the SSR changes in section 3.

| URL | Carried over as | Replaced by |
|---|---|---|
| `/` | legacy `AllVideosPage` in a thin route | [58](58-modern-browse-layout-microinteractions-motion.md) |
| `/trending` | legacy `TrendingPage` | 58 |
| `/subscriptions`, `/subscriptions/videos` | legacy pages under `_authed` | 58 |
| `/channel/$channelId` | legacy `UserPage` | 58 |
| `/watch/$videoId` | legacy `VideoPage`, video detail from the loader | [59](59-video-watch-page-responsive-layout-enhancements.md), player in [57](57-production-video-player-hls-streaming-controls.md) |
| `/upload`, `/upload/edit/$videoId` | legacy upload and edit pages under `_authed` | [60](60-creator-studio-dashboard-video-management-ui.md) |
| header, sidebar, login | legacy `DefaultLayout` as the root layout | 58 (navigation), 56 (login) |
| unknown paths and the bare `/watch`, `/channel` | the same redirects as today | 70 (not-found page) |

### 6. Tests and CI

- The web specs run on Vitest through the app's own Vite config (one resolution for the app and its specs).
  `globals: true` stays, so specs do not import `describe`/`it`/`expect`/`vi`.
- CI keeps its current jobs and budgets. The route tree is regenerated in `lint-typecheck` and the job fails
  when the committed file differs. The web build is cached by turbo like every other package.
- The architecture suite follows the move: `local-first` reads whatever HTML shell Start renders instead of
  `public/*.html`, `frontend-vocabulary` stops saying webpack, `app-env.test.ts` in `@vp/env-schema` checks
  `VITE_*` instead of `REACT_APP_*`, and a zero-matches row fails on `react-scripts`, `craco` or
  `REACT_APP_` anywhere in the repo.

## Acceptance criteria

- [ ] `react-scripts`, `@craco/craco`, `craco.config.js` and `public/index.html` are gone; the zero-matches row
      for `react-scripts|craco|REACT_APP_` is 0.
- [ ] `pnpm --filter @vp/web dev` serves the app with HMR, `build` produces the SSR server and client assets,
      `start` serves the build; root `pnpm dev` includes the web app.
- [ ] Dev cold start and HMR update times recorded in the PR for CRA (before, on `main`) and Vite (after), same
      machine, same page.
- [ ] `routeTree.gen.ts` is committed and CI fails when regenerating it changes the file.
- [ ] A type-level spec fails to compile on `<Link to="/no-such-route">` and on a missing `videoId` param
      (`@ts-expect-error` that `typecheck` holds).
- [ ] Every URL in the table above resolves through the real router (a spec over memory history), and the
      redirects behave as they do today.
- [ ] Every route has Zod `params` parsing where it has params and a Zod `validateSearch`; an invalid
      `videoId` renders the not-found component rather than calling the API.
- [ ] SSR HTML test: a server render of `/watch/<id>` with the API stubbed contains the video title in the HTML.
- [ ] No refetch on hydrate: after the browser hydrates `/watch/<id>`, the video detail request count stays at
      the one the server made.
- [ ] Devtools render in dev and are absent from the production bundle (asserted on the build output).
- [ ] The build emits a separate chunk per route.
- [ ] Root `pendingComponent`, `errorComponent` and `notFoundComponent` are registered; the pending delay is set.
- [ ] `src/config` is the only reader of `import.meta.env`, parsed with Zod; `.env.example` documents
      `VITE_API_BASE_URL`.
- [ ] `pnpm --filter @vp/web test`, `pnpm typecheck`, `pnpm lint`, `pnpm test:architecture` green; CI stays
      inside its budgets.
- [ ] `react-router-dom` and `react-router` are gone from `apps/web/package.json` and from every import in
      `src/`.
- [ ] Server-rendering every URL in the table succeeds; the root providers render their server default and
      read storage after mount, and the watch page's player renders client-only with the poster on the server.
- [ ] `make smoke-offline` passes, and the page loads nothing from an off-machine host.
- [ ] Playing a video on `/watch/<id>` makes no request to `cdn.jsdelivr.net` or any other off-machine host
      (hls.js comes from the bundle through `window.Hls`); asserted by a spec on react-player's SDK loading
      and by the network log of a local playback.
- [ ] `apps/web/AGENTS.md` describes the stack as it now is and documents the structure and seams above;
      `packages/client/api-client/AGENTS.md`, `ARCHITECTURE.md`, `README.md` and SDD ADR-21 no longer mention CRA
      or craco as current.

## Out of scope

- Moving the other RTK Query endpoints, TanStack Form, deleting RTK Query: [53](53-frontend-architecture-modernization-tanstack-query.md).
- Tailwind, Radix, removing Bootstrap and SCSS: [55](55-design-system-tailwind-radix-dark-theme.md) and [62](62-frontend-performance-virtualization-ssr-bundle-hardening.md).
- Cookie sessions and SSR-aware auth: [56](56-frontend-universal-auth-session-security.md). Until then the server renders as a guest.
- SEO, OpenGraph, JSON-LD, sitemap and RSS: [63](63-tanstack-router-start-ssr-seo-streaming.md).
- jsdom, Testing Library and MSW: [54](54-frontend-testing-trophy-vitest-msw-integration-suite.md).
- A Dockerfile, compose service or k8s manifest for the web app (none exists today): [83](83-granular-container-topology-full-stack-deployment.md) ships whatever `apps/web` is, which after this ticket is a Node SSR server.
- Playwright: [75](75-fullstack-e2e-playwright-security-perf-validation.md).

## Open questions

- Decided: RTK Query coexists with TanStack Query until 53. The legacy pages keep their RTK Query hooks
  (`ApiProvider` is mounted in the root route), one endpoint moves to show the pattern, and no new code uses
  RTK Query. Rewriting every endpoint here would be work 53 redoes with its own query key design.
- Decided: React 19 lands here, not in 53, because TanStack Start's streaming SSR targets it. A legacy
  dependency that does not support 19 is replaced by the smallest compatible version bump, not by new code.
- Decided: the route tree file is committed, and CI checks it is current, because `typecheck` and the editor
  need it before any dev server has run.
- Decided: legacy URLs keep their current shape (`/channel/$channelId`, `/subscriptions/videos`). The page
  tickets move them (58 has `/feed/*`) and add the redirects when they do.
- Open: whether the SSR server needs its own API base URL inside compose (the browser and the server reach the
  API at different hosts there). Not needed locally; [83](83-granular-container-topology-full-stack-deployment.md) decides when it adds the web service.
- Decided (while building): `start` serves `dist/server/server.js` with `srvx`, the server Start itself uses
  for `vite preview`, instead of adding Nitro. 83 can put a Nitro preset in front if the image wants one.
- Decided: the route tree drift check runs in the `build` job, straight after the turbo build that writes it,
  not in `lint-typecheck`, which never runs `vite build`.
- Decided: every legacy `useLocalStorage` (the two root providers, the player volume and the list/grid
  toggle) moved to `useStoredState`, and `@uidotdev/usehooks` is gone; leaving the two page-level ones would
  have thrown on the server for `/`, `/trending` and `/channel`.
- Decided: `react-pro-sidebar` reads `matchMedia` in its initial state, so the sidebar gets its `md`
  breakpoint only after hydration. Without it every narrow screen failed hydration.
- Decided: the dead Google Fonts `@import` in `_mixins.scss` is deleted (no rule used either font), and
  `local-first.test.ts` now reads the web stylesheets too.
- Decided: browser-tier workspace packages resolve from source through a Vite alias built from
  `packages/{universal,client}/*/package.json` (`vite/workspace-sources.ts`), so a package edit hot-reloads.

## Definition of Done

- [ ] All acceptance criteria proved with command output or a recorded result in the PR.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
