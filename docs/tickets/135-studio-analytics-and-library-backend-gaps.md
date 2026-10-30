# 135: Studio analytics and library - the backend gaps and the UI that waits on them

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | M |
| Blocked by | 60 - Creator studio dashboard |
| Blocks | — |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [Studio charts](../design/apps/studio/charts.md) |

**Status:** ready

> **Why.** [60](60-creator-studio-dashboard-video-management-ui.md) shipped the dashboard on the endpoints that exist. These are the pieces the endpoints cannot serve yet, so they moved here.

## What to build

Backend first, then the studio reads each:

- **48-hour chart.** An hourly views series for the last 48 hours, per channel and per video ([43](43-high-scale-video-views-buffer-reconciler.md) holds daily buckets only).
- **Net subscribers.** Gains minus losses over the range, for the KPI card ([41](41-channel-subscriptions-subscriber-feed.md)).
- **Lifetime range.** `lifetime` beside 7d, 30d and 90d on the analytics endpoints.
- **KPI deltas.** Each KPI returns the previous period's value, so a card shows its change.
- **Thumbnail progress.** The SSE status stream ([15](15-sse-progress-events.md)) reports the thumbnail stage as it does each rendition, so the upload widget shows it on a `Progress`.
- **Server-side title filter.** The creator video list takes a `q` filter on the title; the table's filter reads it instead of filtering the loaded page.

## Acceptance criteria

- [ ] The 48-hour hourly chart renders from the backend, per channel and per video.
- [ ] A net subscribers `StatCard` shows gains minus losses over the range.
- [ ] The range switch offers lifetime, and the endpoints answer it.
- [ ] Each KPI card shows its change against the previous period.
- [ ] The upload widget shows thumbnail progress from the SSE stream.
- [ ] The `/videos` title filter is a server-side `q` param, in the URL, across all pages.
- [ ] `pnpm gen:contracts` (no diff), `pnpm test:bun` and `pnpm test:architecture` green, with output in the PR.
- [ ] `pnpm typecheck`, `pnpm lint` and the touched packages' tests pass, with output in the PR.

## Out of scope

- Retention and daily views: they shipped in 60.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
