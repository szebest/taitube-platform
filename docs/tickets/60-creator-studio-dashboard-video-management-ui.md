# 60: Creator studio dashboard — video library, analytics charts & upload modal

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#60](https://github.com/szebest/taitube-platform/issues/60) |
| Size | L |
| Blocked by | 44 - Creator studio backend · 53 - Frontend data layer · 55 - Design system · 56 - Frontend auth · 89 - TanStack Start foundation · 91 - Web import aliases · 93 - Creator Studio as its own app · 95 - Design system 2 |
| Blocks | 62, 66, 111, 112, 113, 114, 116, 118, 128, 131 |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §10 Real-time status SSE](../SDD.md#10-real-time-status-sse) |

**Status:** blocked

> **Ticket 85 note:** every number, date, duration, count and list this ticket renders comes from `@vp/intl`
> (`compact`, `relative`, `duration`, `list`, `collator`, `truncate`, …) and every string from `@vp/messages`.
> Components never call `Intl.*`, `toLocaleString` or `toFixed`, and never hold a copy literal — an
> architecture test enforces both. See [85](85-universal-intl-formatting-message-core.md).

> **Builds on 93.** The studio is its own app, `apps/client/studio`, on its own origin (`localhost:5174`,
> `studio.<domain>` in cloud), so its routes carry no `/studio` prefix. [93](93-creator-studio-separate-app.md)
> moved the legacy upload and edit pages (`src/modules/Upload`) there on `/upload` and `/upload/edit/$videoId`
> under `_authed`, and web already redirects both URLs to the studio. This ticket owns deleting
> `src/modules/Upload`, its remaining endpoints and its SCSS, and redirects the two studio URLs to the routes
> below.

> **Data sources.** The dashboard's latest comments and the `/comments` page read [103](103-comment-hearts-reports-creator-inbox.md)'s creator inbox and update live through [98](98-realtime-user-event-stream.md); upload and processing progress use 98's typed stream; the retention curve is [65](65-first-party-video-playback-telemetry-analytics-beacon.md).

## What to build

Routes under `apps/client/studio/src/routes/_authed/`, feature code in `apps/client/studio/src/features/`. The
upload and edit forms (TanStack Form from `@vp/forms`, `@vp/validation` rules) get the studio layout; shared query
and mutation factories stay in `@vp/queries`, studio-only ones live in the studio.

The look is the studio in [docs/design/README.md section 8, Studio](../design/README.md#studio): the
`_authed` layout is 95's `StudioWorkspace` (navigation, toolbar, content, an inspector for the selected
item; [95](95-design-system-2.md) section 6) with compact density as the studio's default, tables on the
`DataTable` shell, KPIs on `StatCard`, and empty, error and partial states from 95's states patterns. The
field components in `@vp/forms` (`TextField`, `SelectField`, `FileField`) move onto `@vp/ui`'s `Field`,
`Input`, `Select` and `Textarea` here, with their Bootstrap markup and `file-field.module.css` gone, since the
legacy upload and edit pages are their only other users.

### 1. Video library `/videos`

- TanStack Table (`@tanstack/react-table`) state rendered through 95's `DataTable` shell: sort by date, views, likes, comments; status badges (`UPLOADING`,
  `PROCESSING`, `READY`, `FAILED`) as `Badge`s with their status icon; pagination and a title filter.
- Sort, page and filter are the route's `validateSearch` params, so a table view is a shareable URL; the
  loader calls `ensureQueryData` for that page from [44](44-creator-studio-video-management-visibility.md)'s
  creator endpoints.
- Row selection with batch delete and batch visibility (`Public`, `Unlisted`, `Private`).
- Row actions (edit, visibility, analytics, delete with confirmation) rendered through `useCan` and the
  `@vp/permissions` helpers, never a role check.
- `pendingComponent`: the `DataTable` skeleton with the loaded column widths; no videos renders `EmptyState`
  with one action, Upload.

### 2. Metadata editor `/videos/$videoId/edit`

- TanStack Form: title, description with a markdown preview, category (from
  [37](37-admin-category-management-cached-api.md)'s public API), tags as chips.
- Thumbnail: pick a generated frame or upload a custom one.
- `PATCH` carries the video's `version`; a version conflict from the API opens a dialog offering reload or
  overwrite, it never fails silently.
- The selected row's details open in the workspace inspector on expanded and up, and as a `Sheet` below.

### 3. Upload

- A `Dialog` reachable from any studio page: drag and drop, the presigned upload flow, then a progress widget fed
  by the SSE status stream ([15](15-sse-progress-events.md)) showing per-rendition and thumbnail progress,
  each on the `Progress` primitive.
- The widget lives in the studio layout route, so it keeps running while the creator moves between studio tabs.
- Byte-level upload progress, separate from the SSE processing progress above, replaces the progress handling in
  `apps/client/web/src/features/upload/api/upload-video.ts` that 53 left as is:
  - byte-based `{ loaded, total }` from `onUploadProgress`, for the single PUT and for each multipart part PUT
    (multipart sums the parts);
  - stored in the TanStack Query cache under an upload id;
  - the upload is a pure mutation options factory, matching the query and mutation options pattern 53 set up in
    `apps/client/web`;
  - a `useUploadProgress(id)` hook reads it.

### 4. Analytics `/analytics` (later slice)

- `StatCard`s (views, watch time, net subscribers, average view duration), per-video views over time
  (7d / 30d / 90d / lifetime, a `SegmentedControl`), a 48-hour hourly bar chart, and the retention curve.
- Charts take their colours from 95's chart helpers over the `dataviz` palettes only
  ([docs/design/README.md section 3](../design/README.md#3-colour-roles)), never a UI role.
- This slice picks the charting library, at its current latest major (`npm view <pkg> version`), and builds the
  charts over 95's `ChartFrame`, `useChartTheme`, `seriesColor` and `sequentialScale`
  ([docs/design/apps/studio/charts.md](../design/apps/studio/charts.md)). The kit supplies the frame and the
  colours and never a chart; the library stays in the studio.
- Data from [43](43-high-scale-video-views-buffer-reconciler.md) (daily analytics) and
  [65](65-first-party-video-playback-telemetry-analytics-beacon.md) (retention). This slice starts only when
  those endpoints exist; the chart library is lazy-loaded with the route.

### Smart wrappers

Over the studio's kit: `LibraryTable` (`features/content/components/`) over `DataTable` and `LibraryVideoRow`, `KpiCard` over `StatCard` and `ViewsChart` and `RetentionHeatmap` over `ChartFrame` (`features/analytics/components/`), `StudioShell` over `StudioWorkspace` (`features/shell/components/`). Props, hooks and the feature folder of each are in [the wrapper table](../design/apps/studio/README.md#smart-wrappers-the-studio-needs); 95 builds the kit parts and the reference wrapper, this ticket builds these.

## Delivery slices

1. Studio shell (`StudioWorkspace` over the `_authed` layout 93 left as plain markup), the `@vp/forms` fields
   on `@vp/ui` primitives, and the `/videos` table with URL-driven sort, page and filter; `/` lands on `/videos`.
2. Metadata editor with the version conflict dialog; the studio's `/upload/edit/$videoId` redirects here.
3. Upload dialog with the byte progress rework (query cache, `useUploadProgress`) and the SSE progress widget; the studio's `/upload` opens it; `src/modules/Upload` deleted.
4. Batch actions (delete, visibility).
5. Analytics dashboard, once 43 and 65 ship their endpoints.

## Acceptance criteria

- [ ] Every studio route sits under `_authed`; a guest is redirected to sign in by 56's `beforeLoad` guard.
- [ ] The table sorts, paginates, filters and selects rows; each of those is reflected in the URL and restored
      from it on reload.
- [ ] Row and batch actions are rendered through `useCan`; no role or user id check in a component.
- [ ] The editor validates with `@vp/validation` rules, loads categories from `GET /v1/categories`, and a
      version conflict opens the conflict dialog.
- [ ] Upload shows live SSE progress per rendition and keeps running across studio tabs.
- [ ] Byte progress for single and multipart uploads is stored in the query cache and read through
      `useUploadProgress(id)`, with a spec for each path.
- [ ] The studio's `/upload` opens the upload dialog and `/upload/edit/<id>` redirects to `/videos/<id>/edit`
      (web's old URLs keep landing there through 93's redirects); `src/modules/Upload` is deleted.
- [ ] Analytics renders daily views, the 48-hour chart, watch time and retention from the backend endpoints.
- [ ] The studio renders in compact density unless the viewer chose otherwise; `features/` defines no table,
      card, stat, skeleton or state component of its own.
- [ ] `@vp/forms` fields render only `@vp/ui` primitives: no Bootstrap class and no `.module.css` left in the
      package.
- [ ] Every chart renders inside `ChartFrame` over the charting library at its latest major, and every chart series colour comes from the `dataviz` helpers, and each series meets 3:1 against `surface`
      in every theme and mode (asserted over the registry's themes).
- [ ] The table is keyboard complete: arrow keys move between rows, Space selects, Enter opens the inspector,
      and the batch toolbar announces the selection count.
- [ ] Meets the polish bar ([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)) on every
      surface this ticket builds.
- [ ] Integration specs for table sorting, form validation and submission, and the conflict dialog, through
      54's `renderRoute` with MSW.

## Out of scope

- Monetisation and payouts.
- Team channels with multiple users.

## Testing plan

- Studio flow in [75](75-fullstack-e2e-playwright-security-perf-validation.md) once it exists: upload, edit title
  and category, see the change in the table.
- Conflict: MSW returns the version conflict problem, assert the dialog.

## Definition of Done

- [ ] `pnpm --filter @vp/studio test` and `pnpm typecheck` pass.
- [ ] Studio works end to end in local dev.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
