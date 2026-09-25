# AGENTS.md — @vp/web (Frontend Application)

Instructions for any coding agent working on the Taitube web client (`apps/web`).

---

## 1. The stack

| Concern | What it is |
|---|---|
| Framework | **TanStack Start** on **Vite 7**, **React 19**, server-rendered and hydrated |
| Routing | file-based **TanStack Router** under `src/routes/`; `src/routeTree.gen.ts` is generated and committed |
| Data | **TanStack Query** for new code (one `QueryClient` per request and per tab, in router context); **RTK Query** still serves the legacy pages until 53 deletes it |
| Styling | Bootstrap 5 + `react-bootstrap`, global SCSS under `src/styles/`, `*.module.scss` beside components, until 55 |
| Playback | legacy `react-player` 2, fed the bundled `hls.js` so it never fetches the CDN copy, until 57 |
| Tests | Vitest through the app's own Vite config (`vitest.config.ts` merges `vite.config.ts`), `environment: 'node'`, `globals: true` |
| Server | `vite build` writes `dist/client` and `dist/server/server.js` (a fetch handler); `start` serves it with `srvx` |

`apps/web` is **tier `client`, layer T5**. It may import `packages/universal/*` and `packages/client/*`
only; `pnpm boundaries` fails on anything else. The browser-tier packages resolve **from their TypeScript
source** through `vite/workspace-sources.ts`, so an edit to `@vp/intl-react` hot-reloads the app; `tsc`
still reads their built `.d.ts`, which is why `typecheck` depends on `^build`.

---

## 2. Structure

```
src/
├── routes/               file routes only: params, validateSearch, loader, head, component
│   ├── __root.tsx        the HTML document, global styles, provider stack, legacy layout, devtools
│   ├── _authed.tsx       pathless members-only layout (legacy AuthorizedContainer today)
│   └── $.tsx             the legacy redirects for unmatched paths
├── features/<feature>/   new code: api/ (queryOptions, loaders), components/, hooks/
├── integrations/         query/ (QueryClient factory), auth/ (the session in router context),
│                         router/ (param parsing), devtools/ (dev server only)
├── components/           app-wide pieces: <Can>, the route fallbacks; ui/ is the design system (55)
├── hooks/                useCan, useStoredState
├── modules/              legacy pages; each page ticket deletes the folder it replaces
├── layout/               legacy chrome: header, sidebar, login, DefaultLayout
├── config/               the only reader of import.meta.env, parsed with Zod
└── router.tsx            getRouter(): context { queryClient, auth }, defaults, SSR query integration
vite/                     build-time code: bundle guard, workspace source aliases
```

### A route file stays thin

```tsx
export const Route = createFileRoute('/watch/$videoId')({
  params: {
    parse: ({ videoId }) => ({ videoId: parseParam(VideoIdParamSchema.shape.id, videoId) }),
    stringify: ({ videoId }) => ({ videoId }),
  },
  validateSearch: z.object({}),
  loader: ({ context: { queryClient }, params: { videoId } }) => ensureVideo(queryClient, videoId),
  component: VideoPage,
});
```

- **Params parse with the contract's own schema.** `parseParam` throws `notFound()` on a segment the
  schema refuses, so a malformed id renders the not-found page and never reaches the API.
- **Every route declares `validateSearch`**, an empty `z.object({})` until the route has search state. URL
  state lives there, never in component state that should survive a refresh or a shared link (69).
- **Data loads in the loader** through `queryClient.ensureQueryData(xQueryOptions(...))`; the component reads
  the same options with `useSuspenseQuery`. The `/watch/$videoId` route is the reference: `videoQueryOptions`
  and `ensureVideo` in `src/features/watch/api/`. The server's fetch is dehydrated into the page, and the
  default `staleTime` keeps the browser from asking again on hydration.
- **Loading and error UI come from the router**: `defaultPendingComponent`, `defaultErrorComponent` and
  `defaultNotFoundComponent` in `router.tsx`, with a pending delay so a fast navigation never flashes.
- **Links are typed against the tree**: `<Link to="/channel/$channelId" params={{ channelId }}>`, never an
  interpolated string. `src/__tests__/router.test.tsx` holds `@ts-expect-error` cases the typecheck keeps.
- **Code splitting is automatic** (the Start router plugin splits each route's component into its own
  chunk). Write no `React.lazy` for a route. `vite/bundle-guard.ts` fails the build if a route lands in the
  entry chunk, two routes share one, or devtools reach the production bundle.

### Rendering on the server

Everything under `src/` runs on the server first. A component that reads `window`, `localStorage` or
`document` during render breaks every page above it. Reach for:

- **`useStoredState(key, schema, serverValue, clientDefault?)`** from `src/hooks/` for persisted UI state:
  the server and the hydration render `serverValue`, the stored value arrives once the page is live.
- **A mount check** for a browser-only widget, as `WatchPlayer` does for the legacy player: the poster is
  the server's markup, the player mounts after hydration.

The session token lives in `localStorage`, so every server render is a guest's (`guestSession()` in
router context). 56 moves the session to a cookie and puts a `beforeLoad` guard on `_authed`.

### Seams for the tickets that follow

| Ticket | Where it plugs in |
|---|---|
| 53 data layer | `integrations/query/`, the `videoQueryOptions` + `ensureVideo` pattern; `base-api.ts` and `modules/shared/api/` are the RTK Query it deletes |
| 55 design system | `components/ui/`; global styles are linked once, in `__root.tsx` |
| 56 auth | `auth` in router context (`integrations/auth/session.ts`) and the `_authed` layout route |
| 69 URL state | the `validateSearch` every route already declares |
| 57 player | `features/watch/components/watch-player.tsx`, which mounts the legacy player today |

---

## 3. Rules

### Rule 1: Declarative authorization only
No component hand-checks a user id, a role or ownership. Permission decisions go through `useCan`
(`src/hooks/use-can.ts`) or `<Can>` (`src/components/can.tsx`), both evaluating the memoized CASL ability
from `PermissionsProvider`:

```tsx
<Can type="ability" do="create" on="Video">…</Can>
<Can type="rule" I={canUpdateVideo} this={{ video: { id, ownerId } }}>…</Can>
```

A check `@vp/permissions` cannot express gets a rule there, not a branch in JSX. See
[docs/standards/authorization.md](../../docs/standards/authorization.md).

### Rule 2: Every HTTP call goes through `apiClient`
`apiClient` in `src/base-api.ts` wraps `createApiClient` from `@vp/api-client` with `API_BASE_URL` from
`src/config`. `axios` carries no API traffic; its one use is the PUT of file bytes to presigned storage URLs
in `src/modules/Upload/api/upload-video.ts`. A component consumes a hook or a query and renders; it never
calls `apiClient` itself.

### Rule 3: New code goes to `features/`, `integrations/` and `routes/`
Nothing new goes into `src/modules/` or RTK Query. A legacy page gets mechanical edits only; the page ticket
that replaces it owns the redesign.

### Rule 4: Rules come from a package, and the component holds none
Not built yet; 53 and 70 build it. `@vp/validation` is where a form check comes from and `@vp/domain-rules`
an entity-dependent decision, the same functions the API runs. A hook unwraps the `Result` and returns a
`ViewState`; a component is `(viewState) => JSX`, with no API call, `try/catch` or validation literal.
`present(failure)` is a total `switch` ending in `assertNever`. The authority is
[docs/standards/error-handling.md](../../docs/standards/error-handling.md).

### Rule 5: Components never format
Every number, date, duration and count goes through `@vp/intl-react`: `<Format value={...} />`,
`useT().tOr(...)` or `useFormat()`. The root passes `locale="en"` and `timeZone="UTC"` explicitly so the
server and the hydration print the same text; locale negotiation is 86. `no-adhoc-formatting.test.ts` fails
on `toLocaleString()`, a displayed `toFixed` or an `Intl` constructor. See
[docs/standards/formatting-and-i18n.md](../../docs/standards/formatting-and-i18n.md).

### Rule 6: Nothing phones home
No absolute third-party host in `src/`, the document `__root.tsx` renders included, and no analytics beacon.
Fonts, icons and `hls.js` are bundled from `node_modules`. `local-first.test.ts` holds it. See
[docs/LOCAL_FIRST.md](../../docs/LOCAL_FIRST.md).

### Rule 7: One test file per source file
Specs live in `__tests__/` beside their source and use the Vitest globals without importing them. A page
renders through `renderPage` (`src/__tests__/render-page.tsx`), which mounts it in a one-route TanStack
router over memory history with the root's providers; a route renders through `serverRender`
(`src/__tests__/server-render.ts`), which answers a request with the real route tree the way the server does.

---

## 4. Local commands

```bash
pnpm --filter @vp/web dev         # Vite dev server with HMR on http://localhost:5173; root `pnpm dev` starts it too
pnpm --filter @vp/web build       # dist/client and dist/server; regenerates src/routeTree.gen.ts
pnpm --filter @vp/web start       # serves the build on http://localhost:5173
pnpm --filter @vp/web test
pnpm --filter @vp/web typecheck   # tsconfig.json (the app) and tsconfig.spec.json (specs and vite/)
```

The dev server and `start` use port 5173, which the API's `CORS_ORIGINS` allows. `VITE_API_BASE_URL`
moves the API from `http://localhost:3000`. After adding, renaming or deleting a route file, run the dev
server or `build` and commit the regenerated `src/routeTree.gen.ts`; CI fails when it is stale.

---

## 5. Also read

- [packages/AGENTS.md](../../packages/AGENTS.md) — tiers, layers and what `apps/web` may depend on
- [ARCHITECTURE.md](../../ARCHITECTURE.md) — Invariant 5, the tier boundary
- [docs/standards/testing.md](../../docs/standards/testing.md)
- The TanStack skills shipped in `node_modules/@tanstack/*/skills/` match the installed versions; read them
  before reaching for an API from memory.
