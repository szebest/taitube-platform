# 179: Scheduled video publishing - one scheduling mechanism for videos, posts and page layouts

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | M |
| Blocked by | 116 - Video management power tools · 120 - Community posts and threads |
| Blocks | — |
| Spec | [116 out of scope](116-video-management-power-tools.md) · [120 drafts and schedules](120-community-posts-and-threads.md) · [121 schedules](121-channel-page-builder.md) · [17 housekeeping schedulers](17-housekeeping-reconciler-purge.md) |

**Status:** blocked

## What to build

A creator sets a date and time on a video, and the video goes public (or unlisted) then, without them being there.

[116](116-video-management-power-tools.md) lists "Scheduled publishing (a separate ticket)" in its out of scope, and no such ticket was ever filed. Two other tickets already build a schedule of their own, each with its own table and housekeeping promoter: [120](120-community-posts-and-threads.md) (`channel_posts` with `status = scheduled`, `publish_at`, a CAS on `status`) and [121](121-channel-page-builder.md) (`channel_layout_schedules`, `status` `pending | applied | cancelled`, a CAS on `status`). A third bespoke mechanism for videos is the thing to avoid.

The first piece of work is the decision: one scheduling mechanism for all three, or three that deliberately differ. Decided in the first commit and written into this ticket under *Open questions* as "Decided: ...". The options to weigh:

1. A shared `scheduled_actions` table (subject kind, subject id, `run_at`, `status`, payload) with one housekeeping promoter and a registry of handlers per kind. 120 and 121 would migrate onto it (their own tickets, or a follow-up here).
2. A shared pure helper and one promoter pattern in `@vp/core`, each feature keeping its table.
3. A `publish_at` column on `videos` only, promoted by a CAS in housekeeping, leaving 120 and 121 as they are.

Then the video feature on the chosen mechanism, from Studio's video editor and bulk edit (116).

## Acceptance criteria

- [ ] The decision is written in *Open questions* with the reason, and names what happens to the schedules 120 and 121 build (migrate, share a helper, or stay apart and why).
- [ ] A creator can schedule a private or unlisted video to become public (or a private video unlisted) at a future time from the video editor, change the time, and cancel it; the contract, route and `@vp/permissions` rule exist, and the 403 matrix follows 117 (who may schedule on a team channel).
- [ ] The video becomes visible once at its time even if the promoter runs twice or on two workers (a CAS on the schedule's status, then the visibility change through the same path as a manual edit, so `video_events`, the audit log and subscriber notifications behave as they do today). A test runs it twice.
- [ ] A video that is deleted, held by screening, rejected, or still processing at its time is not published: the schedule ends in a failed or skipped state the creator sees, with a reason.
- [ ] A schedule in the past is refused on create; a clock skew of a minute is tolerated in one named place.
- [ ] Studio shows scheduled videos in the library with their time, and the creator gets a notification when it publishes or fails to.
- [ ] The scheduler is in the housekeeping stage's schedulers ([17](17-housekeeping-reconciler-purge.md)), with a metric and an alert-less log line per promotion; `docs/SDD.md` describes the mechanism and, if the decision is shared, the other two users of it.

## Setup & environment

Possibly one housekeeping cron entry and an env key for its interval. Add it to `packages/server/env-schema`, `.env.example` and `docs/ENVIRONMENT.md` (`pnpm gen:env-docs`) if so; "none" otherwise.

## Out of scope

- Recurring schedules, time zones per channel (store UTC, show in the viewer's zone), scheduled premieres with a countdown page.
- Scheduled deletion or archival.
- Migrating 120 and 121 if the decision keeps them apart.

## Notes for the implementer

- Raised by the status audit (2026-11-27): 116 names it, nobody filed it. The audit called the post schedules "120b"; there is no such file, they live inside 120.
- Blocked by 116 for the video editor and bulk edit it adds, and by 120 so the decision can read a built post schedule instead of a ticket text. 121 is not a blocker (its schedule is not built yet); if it has landed when this starts, include it in the decision.
- Visibility changes go through the existing edit rules (`edit-access.rule.ts`, optimistic version), never a direct column write from the promoter.

## Testing plan

Domain table for the schedule rules, a promoter idempotency test, route contract tests with the role matrix, a Studio component spec for the schedule field, one browser or e2e path with a short delay.

## Open questions

- Which of the three mechanisms. Decide first.

## Definition of Done

- [ ] Merged; SDD updated; `gen-index.py` re-run.
