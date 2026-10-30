# AGENTS.md — @vp/studio (Creator Studio)

Instructions for any coding agent working on the Taitube creator studio (`apps/client/studio`): the creator
surface (upload, edit, and the library, analytics and admin panel the tickets after 93 add), served and deployed
apart from the viewer app.

> Owner: ticket [93](../../../docs/tickets/93-creator-studio-separate-app.md) · the shell, library and editor:
> [60](../../../docs/tickets/60-creator-studio-dashboard-video-management-ui.md) · the admin panel: [61](../../../docs/tickets/61-admin-control-panel-category-moderation-ui.md)

---

## 1. The same stack as web

Everything in [apps/client/web/AGENTS.md](../web/AGENTS.md) applies here: TanStack Start over Vite 8 and React 19,
file routes under `src/routes/` with a committed `src/routeTree.gen.ts`, TanStack Query filled by loaders, TanStack
Form, the `#app/` import alias, the design system from `@vp/ui`, the two Vitest projects and the Playwright suite in
`e2e/`. Its rules (declarative authorization, the API client from router context, rules from packages, formatting
through `@vp/intl-react`, nothing phones home, one spec per source, MSW typed by the contracts) hold here word for
word. This file lists only what differs.

`apps/client/studio` is **tier `client`, layer T6**, like web. It depends on the same client packages; a module both
apps need lives in one of them, never in a copy (`tests/architecture/client-app-duplicates.test.ts` fails a source
file byte-identical between the two apps).

## 2. What differs

| Concern | Studio |
|---|---|
| Origin | `http://localhost:5174` for `dev`, `vite preview` and `start`; `studio.localhost` on k3d, `studio.<domain>` in cloud (SDD §11, §12) |
| Config | `src/config` is the only reader of `import.meta.env`: `VITE_API_BASE_URL`, `SSR_API_BASE_URL` and `VITE_COOKIE_DOMAIN` as web reads them (through `resolveApiBaseUrl` and the env schemas in `@vp/queries`), plus `VITE_WEB_URL` (default `http://localhost:5173`), where the viewer app is |
| Routes | `/` redirects to `/videos`; `/videos` (the library, its sort, page and title filter in the address), `/videos/$videoId/edit` (the metadata editor), `/analytics` (the channel's figures and daily views) and `/videos/$videoId/analytics` (the same for one video, plus its retention), both with the range (`7d`, `30d`, `90d`) in the address, and `/upload` (it opens the upload dialog over the library) under the `_authed` layout, plus `/upload/edit/$videoId`, which redirects to the editor; `/admin/categories`, `/admin/moderation` and `/admin/queues` under `_authed/admin`, whose `beforeLoad` evaluates `canAccessAdmin` (a denial redirects to `/?denied=admin`, which the shell turns into a toast); `/login`, the studio's own sign-in; nothing else public |
| Shell | `src/features/shell/components/studio-shell.tsx`, mounted by `__root.tsx` on every page: `StudioWorkspace` (`src/components/workspace/studio-workspace/`) with the skip link, the navigation (the library, upload, the way back to web), the toolbar (the logo, the theme menu, the account through `shell-account-menu.tsx`) and the page in its content; the library's inspector opens beside the page for a selected row; `UploadDockProvider` (`features/upload/hooks/upload-dock.tsx`) wraps it, so the upload dialog (opened from the navigation, the toolbar or `/upload`) and `UploadWidget` (byte progress, then each rendition's and the thumbnail's progress from the user event stream) outlive every page the creator moves between |
| Guests | the session cookie is the one web reads (SDD §11), so a creator signed in on web is signed in here; `_authed`'s `beforeLoad` sends a guest to the studio's own `/login?redirect=<path>`, never to web, and back once signed in |
| Search engines | `public/robots.txt` disallows everything and `__root.tsx` sets `robots: noindex, nofollow`; no studio route carries SEO meta |
| Copy | studio strings live in `@vp/messages` under the `studio.` prefix (`packages/universal/messages/src/en/studio.ts`); every string of the studio is a key there |
| App kit | `src/components/<area>/<name>/`: `workspace/studio-workspace`, `table/data-table`, `analytics/stat-card` and `analytics/chart-frame` (the frame and the palette helpers; the charts are `features/analytics/`'s). The reference smart wrapper is `features/content/components/library-video-row.tsx`, on `VideoThumbnail` from `@vp/components`. Adding one: [design-system.md](../../../docs/standards/design-system.md) |
| Styles | `src/studio.css` sets the body on the design tokens; no Bootstrap, no SCSS and none of web's `src/styles/` |
| Upload | `features/upload/`: `uploadVideo` (presigned single or multipart PUTs) reports `{ loaded, total }` bytes, `uploadVideoMutationOptions` writes them to the query cache under the upload's id and `useUploadProgress(id)` reads them; the dialog, the widget and its processing rows read the dock |
| Editor | `features/videos/`: `EditVideoForm` (TanStack Form over `@vp/validation` rules, categories from `GET /v1/categories`, tags as chips, a sanitised markdown preview of the description through `react-markdown`) saves with `PATCH /v1/creator/videos/:id` against the video's `version`; a `VERSION_CONFLICT` opens `VersionConflictDialog` (reload, or overwrite on the newest version) |
| Analytics | `features/analytics/`: `KpiCard` over `StatCard`, `ViewsChart` and `RetentionHeatmap` over `ChartFrame` and recharts, on `analyticsQueryOptions(api, scope, range)` (`scope` is the channel or one video) and the shared `videoRetentionQueryOptions`; each chart's recharts plot is `React.lazy`, so the library loads with the page that draws it, in its own chunk. Series colours come from `seriesColor` and `sequentialScale` only (`series-color.test.ts` holds every series at 3:1 on `surface` in each registry theme and mode); each chart also writes its data as a visually hidden table. The API has no previous period, no hourly buckets, no subscriber change and no lifetime range, so there is no delta, no 48-hour chart, no subscriber card and the range stops at `90d` |
| Batch actions | `features/content/`: the batch bar in `LibraryTable` (`LibraryBatchActions`) and the row menu delete and visibility share `useBatchActions`, which fans `DELETE /v1/creator/videos/:id` and `PATCH` (against each row's `version`) out per video, since there is no batch endpoint; a partial failure toasts `done of total`, and the failed rows stay selected. Rendered through `useCan`, deletes behind `DeleteVideosDialog` |
| Browser suite | `e2e/`: the upload dialog and widget, the editor reached from the old edit URL, and the headers and XSS suites from `tests/playwright/security/` pointed at the library, `/upload` and `/videos/$videoId/edit`; `playwright.config.ts` is `clientAppPlaywrightConfig` on port base 5400 |

## 3. Local commands

```bash
pnpm --filter @vp/studio dev         # Vite dev server with HMR on http://localhost:5174; root `pnpm dev` starts it too
pnpm --filter @vp/studio build       # dist/client and dist/server; regenerates src/routeTree.gen.ts
pnpm --filter @vp/studio start       # serves the build on http://localhost:5174
pnpm --filter @vp/studio test
pnpm --filter @vp/studio typecheck   # tsconfig.json (the app), tsconfig.spec.json (specs and vite.config.ts), tsconfig.e2e.json
pnpm --filter @vp/studio test:e2e    # the Playwright suite; `make e2e-studio` is the same
```

The browser calls the studio's own `/api`, which its server forwards to the API with the session cookie's token, as
in web. Locally `/login` offers the dev personas, which `dev-token serve` (started by `pnpm dev`) mints.

## 4. Also read

- [apps/client/web/AGENTS.md](../web/AGENTS.md) — the stack and the rules, which this app shares
- [packages/AGENTS.md](../../../packages/AGENTS.md) — tiers, layers and what a client app may depend on
- [docs/standards/testing.md](../../../docs/standards/testing.md)
