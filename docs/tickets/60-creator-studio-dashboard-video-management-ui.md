# 60: Creator studio dashboard — video library, analytics charts & upload modal

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#60](https://github.com/szebest/taitube-platform/issues/60) |
| Size | L |
| Blocked by | 44 — Creator studio backend · 55 — Modern design system · 56 — Frontend auth |
| Blocks | 62, 75 |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §10 Real-time status SSE](../SDD.md#10-real-time-status-sse) |

**Status:** blocked

## What to build

The legacy frontend had no management dashboard for video creators. Once a video was uploaded, creators had no way to edit its metadata, track its processing stages, monitor views, or change visibility.

This ticket builds the dedicated **Taitube Creator Studio** (`/studio`):
1. **Video Content Library Table (`/studio/videos`) with TanStack Table (`@tanstack/react-table` v8)**:
   - Headless data table with sorting by date, views, likes, and comments.
   - Multi-select row actions: batch delete, batch visibility change (`Public` / `Unlisted` / `Private`).
   - Status indicators (`UPLOADING`, `PROCESSING`, `READY`, `FAILED`).
   - Quick action controls: Edit Details, Change Visibility, View Analytics, and Delete Video (with confirmation modal), conditionally rendered via `useCan` and typed helpers (`canUpdateVideo`, `canDeleteVideo`) from `@vp/permissions`.
2. **Video Metadata Editor (`/studio/videos/:id/edit`) with TanStack Form (`@tanstack/react-form`)**:
   - Built on `@tanstack/react-form` + `@tanstack/zod-form-adapter` for reactive, zero-re-render form validation with `@taitube/api-contracts`.
   - Form fields: Title, Description (with markdown preview), Category dropdown (populated from dynamic Ticket 37 API), Tags input chip field.
   - Thumbnail selector: choose between generated poster frames or upload custom thumbnail.
   - Optimistic lock conflict handler: If another session edited the video, prompts user cleanly instead of failing silently.
3. **Studio Analytics Dashboard (`/studio/analytics`) & Metrics Visualizer**:
   - Channel-wide KPI summary cards: Total Views, Estimated Watch Time (hours), Net Subscriber Growth, and Average View Duration (AVD).
   - Per-video views over time chart (7d / 30d / 90d / Lifetime) powered by Recharts using Ticket 43 daily analytics API.
   - **Audience Retention Curve Visualizer:** Integrates Ticket 65 drop-off curve showing second-by-second percentage of viewers retained with key moment badges (Intro, Continuous Watch, Dips).
   - **Real-Time 48-Hour Pulse Chart:** Live bar chart showing hourly views over the past 48 hours.
   - Top Videos & Traffic Sources Breakdown: Direct/Search/External and device type percentages.
4. **Enhanced Upload & Transcoding Modal with TanStack Form**:
   - Drag-and-drop file upload with presigned S3 PUT flow managed via TanStack Form.
   - Real-time SSE progress bar showing transcoding percentage across 1080p, 720p, 480p and thumbnail extraction.

## Acceptance criteria

- [ ] Route `/studio` protected by Creator / User authentication guard and `@vp/permissions` checks.
- [ ] Headless data table built on `@tanstack/react-table` displaying video library with sorting, row selection, status badges, pagination, and search filter.
- [ ] Full metadata editing form built on `@tanstack/react-form` + `@tanstack/zod-form-adapter` with live validation using shared Zod schemas.
- [ ] Category selector dynamically populated from `GET /v1/categories`.
- [ ] Interactive analytics dashboard rendering daily views, 48-hour live pulse bar chart, watch time, and audience retention decay curves.
- [ ] Live SSE upload/transcoding widget displaying granular progress without blocking the creator from browsing other studio tabs.
- [ ] Component tests verifying TanStack Table sorting, TanStack Form validation and submission, category loading, and analytics rendering.

## Out of scope

- Revenue & monetization payout settings.
- Multi-user team channel permissions.

## Notes for the implementer

- Utilize Tailwind CSS / Radix UI primitives for clean, accessible modal dialogs and dropdown menus.
- Handle version numbers automatically when submitting `PATCH /v1/creator/videos/:id`.

## Testing plan

- E2E studio test: Upload a video via Studio modal, edit its title and category, verify updated data in studio list.
- Conflict test: Simulate a version mismatch error from the API and assert that the conflict dialog is displayed.

## Definition of Done

- [ ] `pnpm --filter @taitube/web test` and `pnpm --filter @taitube/web typecheck` pass.
- [ ] Creator Studio fully functional in local dev mode.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
