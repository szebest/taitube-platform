# 101: Pick of the day - editors schedule the home spotlight

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | M |
| Blocked by | 39 - Permissions · 58 - Modern browse layout · 61 - Admin control panel |
| Blocks | — |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** in-progress

> **Why.** Home opens on Pick of the day: one video, a short editorial note and a visible window ("Picked today,
> 14 h left"), the move that says a person chose this ([docs/design/README.md section 1](../design/README.md#signature-moves)).
> 58 fills `PickOfTheDay` with the top trending video until someone can pick one.

## What to build

### 1. Data and rules

- Table `picks` in `@vp/db`: `id`, `video_id`, `starts_at`, `ends_at`, `note` (up to 280 characters, the editorial
  line), `created_by`, `created_at`; one migration. Windows may not overlap.
- Rules in `@vp/domain-rules` over the pick and its video: the video is public and ready, the window is in the
  future or current, it overlaps no other pick, the note is within bounds.
- Picking is a `@vp/permissions` ability (`manage` on `Pick`) granted to admins, never a role check.

### 2. The API

| Endpoint | Who | What |
|---|---|---|
| `GET /v1/picks/current` | anonymous | the current pick with its video summary, note and `endsAt`; when none is scheduled, the fallback (the feed's top trending video) with `source: 'fallback'` and no note |
| `GET /v1/admin/picks`, `POST`, `PATCH /:id`, `DELETE /:id` | admins | schedule, edit, cancel |

`GET /v1/picks/current` is cached until `endsAt`; scheduling or cancelling drops the cache. A pick whose video turns
private mid-window gives way to the next pick or the fallback on the next read.

### 3. Studio: curation

An admin page in the studio (61's admin area, `/admin/curation`): a calendar of the next 30 days of windows, a
`Command` picker over public videos, the note with its counter and a live `PickOfTheDay` preview, overlap shown
before save.

### 4. Web

58's home loader reads `GET /v1/picks/current`; `PickOfTheDay` shows the note in the editorial face and the window
through `@vp/intl-react`, and hides the note and window for a fallback.

## Acceptance criteria

- [ ] An admin schedules a pick for tomorrow; at its start the home page shows it with its note and a counting-down
      window, with no deploy.
- [ ] Overlapping windows, a private video or an over-long note are refused, in the API and in the studio form.
- [ ] With nothing scheduled, home shows the fallback without a note.
- [ ] A non-admin gets a 403 on every admin route; `privilege-escalation.test.ts` gains the rows.
- [ ] The studio page and the spotlight meet the polish bar ([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `pnpm gen:contracts`
      (no diff) green, with output in the PR.

## Out of scope

- Several picks per day, regional picks, or picks per category.

## Testing plan

- Rules: an `it.each` table over windows and videos.
- Routes: current with a pick, with none, at the window edge; admin CRUD and the 403s.
- Studio and web: the curation page and the spotlight through `renderRoute` with MSW.

## Open questions

None.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
