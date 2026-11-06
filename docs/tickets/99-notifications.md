# 99: Notifications - model, producers, API and the live bell

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | L |
| Blocked by | 41 - Channel subscriptions · 42 - Threaded comments · 95 - Design system 2 · 97 - Saved preferences · 98 - Realtime user event stream |
| Blocks | 112, 113, 117, 119, 120, 122, 129, 131, 140 |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §10 Real-time status SSE](../SDD.md#10-real-time-status-sse) |

**Status:** done

The backend (sections 1 to 3: the model, the producers, the API and the live push) shipped in the notifications backend PR; the web part (section 4, the bell) follows after 95. The `live` producer is 76's live start, which enqueues the same `notify-subscribers` job.

> **Why.** Web's kit has a `NotificationCentre` and the header a bell with a count
> ([docs/design/apps/web/notification-centre.md](../design/apps/web/notification-centre.md)), and 72's settings
> have notification switches and per-channel levels. Nothing on the server produces, stores or serves a
> notification today.

## What to build

### 1. The model

- Table `notifications` in `@vp/db`: `id`, `user_id`, `kind`, `actor_channel_id`, `video_id`, `comment_id`,
  `group_key`, `payload` (jsonb), `read_at`, `created_at`; indexes for the newest-first list and the unread
  count per user. One migration.
- `kind` is one literal union in `@vp/domain`: `upload` (a subscribed channel published), `live` (a subscribed
  channel went live), `reply` (a reply to the viewer's comment), `mention`, `comment` (a comment on the viewer's
  video), `processing` (the viewer's upload finished or failed).
- **Grouping**: events with the same `group_key` inside an hour fold into one row ("3 new videos from Night
  Kitchen"); the row keeps the newest actor and a count.
- **Retention**: housekeeping deletes rows older than 90 days.

### 2. Who gets one

- **Per-channel level** on a subscription: `all`, `highlights` (uploads only, no live), `none`, stored on 41's
  subscription row and set through `PATCH /v1/channels/:id/subscribers/me`.
- **Per-kind switches** from 97's `notifications` section; a kind switched off produces nothing.
- **Producers**, each a worker job enqueued through the outbox ([30](30-transactional-outbox.md)) so a rolled-back
  change notifies nobody:
  - `upload`: when a video becomes public and ready, a `notify-subscribers` job fans out in batches over the
    channel's subscribers whose level and switch allow it.
  - `live`: on 76's live start, the same fan-out.
  - `reply`, `mention`, `comment`: on 42's comment create.
  - `processing`: on the pipeline's terminal states.
- Every created row also emits 98's `notification.created` to its user.

### 3. The API

| Endpoint | What |
|---|---|
| `GET /v1/me/notifications` | keyset list, newest first; `filter` (`all`, `subscriptions`, `mentions`) |
| `GET /v1/me/notifications/unread-count` | the badge number |
| `POST /v1/me/notifications/read` | `{ ids }` or `{ all: true }`; emits `notification.read` so other tabs and devices clear |

In `@vp/api-contracts`, the OpenAPI document and SDD §6.1; the owner check through `@vp/permissions`.

### 4. The web app

- The bell in `AppShell` shows the unread count from the `hello` event and live updates; a smart wrapper
  (`features/notifications/components/header-notifications.tsx`) feeds `NotificationCentre` from the list query,
  with grouping by day done by the app through `@vp/intl-react`.
- Opening an item marks it read and navigates (the video, the comment anchor, the channel); "Mark all as read".
- New notifications arrive live (a polite announcement, no toast for `upload`; a toast for `reply` and
  `mention`).
- The settings switches and per-channel levels ([72](72-frontend-settings-customization-system.md)) write
  through 97 and 41.

**Decided (web):** a live notification opens `/watch/$videoId`; reply, mention, comment and heart open the video with
`?comment=<id>`, which scrolls to and marks the comment when it is on the discussion's loaded pages (no deep paging);
a group of uploads opens the channel, one upload the video. Toasts only for `reply` and `mention`, a polite
announcement for the rest, nothing while the centre is open. Opening the centre marks nothing read; a row and Mark all
read do, and Mark all read clears every notification whatever the filter (the API takes only `all`). Per-channel
levels sit on `/settings/notifications` under Channels, as the settings design draws them, over the first page of the
viewer's subscriptions. No standalone notifications page.

### Smart wrappers

Over web's `NotificationCentre`, in `features/notifications/components/`: `HeaderNotificationCentre` and `NotificationRow`. Props, hooks and the feature folder of each are in [the wrapper table](../design/apps/web/README.md#smart-wrappers); 95 builds the kit parts and the reference wrapper, this ticket builds these.

## Acceptance criteria

- [x] Switching account or channel ([129](129-multiple-accounts-and-channels.md)) shows only the new identity's notifications and unread count, with no stale cache.
- [x] A channel publishes; each subscriber with level `all` or `highlights` and the switch on gets one
      `upload` notification, live in an open bell, and a subscriber with `none` gets nothing.
- [x] Three uploads from one channel within an hour show as one grouped row with a count.
- [x] A reply and a mention notify their targets; a comment on a video notifies its owner.
- [x] Marking read on one device clears the badge on another open device.
- [x] A rolled-back publish notifies nobody.
- [x] The bell and centre meet the polish bar ([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)).
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `pnpm gen:contracts`
      (no diff) green, with output in the PR.

## Out of scope

- Email and Web Push delivery; a creator's announcements to subscribers (community posts).

## Testing plan

- Producers: a fan-out spec over levels and switches with the in-memory adapters; grouping inside and across the
  hour.
- Routes: list with each filter, unread count, mark read, the 403.
- Web: the centre through `renderRoute` with MSW and a simulated event stream.

## Open questions

None.

## Definition of Done

- [x] All acceptance criteria proved with command output in the PR.
- [x] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
