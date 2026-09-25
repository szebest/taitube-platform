# 60: Creator studio dashboard — video library, analytics charts & upload modal

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#60](https://github.com/szebest/taitube-platform/issues/60) |
| Size | L |
| Blocked by | 44 - Creator studio backend · 53 - Frontend data layer · 55 - Design system · 56 - Frontend auth · 89 - TanStack Start foundation |
| Blocks | 62, 66 |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §10 Real-time status SSE](../SDD.md#10-real-time-status-sse) |

**Status:** blocked

> **Ticket 85 note:** every number, date, duration, count and list this ticket renders comes from `@vp/intl`
> (`compact`, `relative`, `duration`, `list`, `collator`, `truncate`, …) and every string from `@vp/messages`.
> Components never call `Intl.*`, `toLocaleString` or `toFixed`, and never hold a copy literal — an
> architecture test enforces both. See [85](85-universal-intl-formatting-message-core.md).

> **Builds on 89.** Replaces the legacy upload and edit pages (`src/modules/Upload`) that
> [89](89-web-tanstack-start-foundation.md) carries over on `/upload` and `/upload/edit/$videoId` under
> `_authed`. This ticket owns deleting `src/modules/Upload`, its remaining endpoints and its SCSS if 53 and 55
> have not already, and redirects both old URLs into the studio.

## What to build

Routes under `apps/web/src/routes/_authed/studio/`, feature code in `apps/web/src/features/studio/`. The upload
and edit forms 53 moved to TanStack Form (`src/integrations/form/`, `@vp/validation` rules) move here and get the
studio layout; the query and mutation factories stay where 53 put them.

### 1. Video library `/studio/videos`

- TanStack Table (`@tanstack/react-table`): sort by date, views, likes, comments; status badges (`UPLOADING`,
  `PROCESSING`, `READY`, `FAILED`); pagination and a title filter.
- Sort, page and filter are the route's `validateSearch` params, so a table view is a shareable URL; the
  loader calls `ensureQueryData` for that page from [44](44-creator-studio-video-management-visibility.md)'s
  creator endpoints.
- Row selection with batch delete and batch visibility (`Public`, `Unlisted`, `Private`).
- Row actions (edit, visibility, analytics, delete with confirmation) rendered through `useCan` and the
  `@vp/permissions` helpers, never a role check.
- `pendingComponent`: a table skeleton with the loaded column widths.

### 2. Metadata editor `/studio/videos/$videoId/edit`

- TanStack Form: title, description with a markdown preview, category (from
  [37](37-admin-category-management-cached-api.md)'s public API), tags as chips.
- Thumbnail: pick a generated frame or upload a custom one.
- `PATCH` carries the video's `version`; a version conflict from the API opens a dialog offering reload or
  overwrite, it never fails silently.

### 3. Upload

- A dialog reachable from any studio page: drag and drop, the presigned upload flow, then a progress widget fed
  by the SSE status stream ([15](15-sse-progress-events.md)) showing per-rendition and thumbnail progress.
- The widget lives in the studio layout route, so it keeps running while the creator moves between studio tabs.

### 4. Analytics `/studio/analytics` (later slice)

- KPI cards (views, watch time, net subscribers, average view duration), per-video views over time
  (7d / 30d / 90d / lifetime), a 48-hour hourly bar chart, and the retention curve.
- Data from [43](43-high-scale-video-views-buffer-reconciler.md) (daily analytics) and
  [65](65-first-party-video-playback-telemetry-analytics-beacon.md) (retention). This slice starts only when
  those endpoints exist; the chart library is lazy-loaded with the route.

## Delivery slices

1. Studio layout under `_authed` and `/studio/videos` table with URL-driven sort, page and filter.
2. Metadata editor with the version conflict dialog; `/upload/edit/$videoId` redirects here.
3. Upload dialog with the SSE progress widget; `/upload` redirects here; `src/modules/Upload` deleted.
4. Batch actions (delete, visibility).
5. Analytics dashboard, once 43 and 65 ship their endpoints.

## Acceptance criteria

- [ ] `/studio/*` sits under `_authed`; a guest is redirected to sign in by 56's `beforeLoad` guard.
- [ ] The table sorts, paginates, filters and selects rows; each of those is reflected in the URL and restored
      from it on reload.
- [ ] Row and batch actions are rendered through `useCan`; no role or user id check in a component.
- [ ] The editor validates with `@vp/validation` rules, loads categories from `GET /v1/categories`, and a
      version conflict opens the conflict dialog.
- [ ] Upload shows live SSE progress per rendition and keeps running across studio tabs.
- [ ] `/upload` and `/upload/edit/<id>` redirect to their studio routes; `src/modules/Upload` is deleted.
- [ ] Analytics renders daily views, the 48-hour chart, watch time and retention from the backend endpoints.
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

- [ ] `pnpm --filter @vp/web test` and `pnpm typecheck` pass.
- [ ] Studio works end to end in local dev.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
