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
| Tests | Vitest through the app's own Vite config, `globals: true`, in two projects: `node` (`vitest.config.ts`) and `jsdom` (`vitest.jsdom.config.ts`, the `*.dom.test.tsx` specs) with Testing Library; MSW answers for the API in both |
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

A spec that clicks, types or waits for the browser to update is a `*.dom.test.tsx` and runs under jsdom;
`<stem>.dom.test.tsx` counts as the spec of `<stem>.tsx`. A route in the browser renders through
`renderRoute(url, { handlers?, auth? })` (`src/__tests__/render-route.tsx`): the real router from
`routeTree.gen.ts` over memory history, a fresh `QueryClient` that never retries, and `auth` as the session
in context. Drive the app through URLs and clicks, not by mounting a page with hand-made providers:

```tsx
it('renders the video the loader fetched', async () => {
  await renderRoute(`/watch/${VIDEO_ID}`, {
    handlers: [mockEndpoint(getVideo, () => HttpResponse.json(video({ title: 'Launch day' })))],
  });

  expect(await screen.findByRole('heading', { name: 'Launch day' })).toBeInTheDocument();
});
```

It returns Testing Library's render result plus `router`, `queryClient` and a `user` from `userEvent.setup()`.
`src/__tests__/jsdom.setup.ts` fills in the browser APIs jsdom lacks (`matchMedia`, `scrollTo`,
`IntersectionObserver`). A spec that expects an error page silences the error React logs with
`vi.spyOn(console, 'error').mockImplementation(() => undefined)`.

### Rule 8: `#app/` for anything outside the feature folder
`#app/*` is a Node subpath import declared once in `package.json` `"imports"` and pointing at `src/`, so
TypeScript, Vite, Vitest and the SSR build resolve it without a tsconfig `paths` entry or a Vite alias.

```ts
import { API_BASE_URL } from '#app/config';          // outside the feature folder
import { videoQueryOptions } from './video-query-options';  // a sibling
import { WatchPlayer } from '../components/watch-player';   // one level up, still the same feature
```

- `./` and at most one `../` for a close sibling; `#app/...` for everything else, specs and `vi.mock`
  paths included. No `src/...` import and no `../../`: two zero-matches rows hold both at 0.
- No extension on any import, `.js` included.
- The target is an array (`./src/*` first, then `*.ts`, `*.tsx`, `*/index.ts`, `*/index.tsx`) because Vite
  reads only the first entry and probes extensions itself, while TypeScript probes nothing and walks the list.
  Keep the order when you touch it.
- Not `#/`: TypeScript 5.9 refuses a specifier starting with `#/`. Revisit on TypeScript 6.
- SCSS does not use it (Vite's Sass importer drops everything after `#` as a URL fragment). Stylesheets import
  from `src/` through Sass `loadPaths`: `@import "styles/abstract/variables";`.

### Rule 9: The API in a spec is MSW, typed by the contracts
Every web spec runs with an MSW server (`src/__tests__/msw/api-server.ts`, installed by
`api-server.setup.ts`). A handler is built from the `@vp/api-contracts` endpoint the app calls, so a body
the contract does not return, or a param it does not declare, fails the typecheck:

```ts
import { getVideo } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { HttpResponse } from 'msw';
import { mockEndpoint, problemReply } from '#app/__tests__/msw/mock-endpoint';

const answered = mockEndpoint(getVideo, ({ params }) => HttpResponse.json(video({ id: params.id })));
const failed = mockEndpoint(getVideo, () => problemReply(ErrorCodes.INTERNAL));

await serverRender(`/watch/${VIDEO_ID}`, { handlers: [answered] });
await renderPage(<Page />, { handlers: [failed] });
```

- `handlers` on `renderRoute`, `serverRender` and `renderPage` (or `apiServer.use(...)`) lasts one test;
  handlers reset after each.
- A request no handler answers never leaves the process: MSW answers it with a 500 and the test that made it
  fails after it ends, naming the request.
- `problemReply(code)` is the RFC 9457 body at the status the API reports that code as; pass a status to
  override it.
- `recordRequests` in `api-store.ts` stubs `fetch` outright and predates this; new specs use MSW.

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
