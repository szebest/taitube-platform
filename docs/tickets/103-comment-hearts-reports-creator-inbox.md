# 103: Comments - creator hearts, reports and the creator's comment inbox

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | M |
| Blocked by | 39 - Permissions · 42 - Threaded comments · 95 - Design system 2 · 98 - Realtime user event stream |
| Blocks | 112, 113, 120, 124 |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** in-progress

The backend (sections 1 to 3: the API, schema, rules, permissions and the `comment.created` event) shipped in one PR; the app part (section 4) follows after [95](95-design-system-2.md).

> **Why.** Web's `CommentItem` shows a creator's heart, every comment has a Report action, the studio dashboard
> lists the latest comments across a creator's videos, and 61's moderation panel waits for a report queue
> ("once the API has a report endpoint"). 42 serves threads and pins; none of these exist.

## What to build

### 1. Hearts

- Column `hearted_at` on comments; `POST` and `DELETE /v1/comments/:id/heart`, allowed for the video's owner
  through a `@vp/permissions` rule, the `heart` action on `Comment`. A heart is recognition: it never reorders a comment and is
  not a pin (42's `pin`; vocabulary in [113](113-channel-comment-moderation.md)).
- Comment resources gain `heartedByCreator`. A heart notifies the comment's author through
  [99](99-notifications.md) when it lands.

### 2. Reports

- Table `comment_reports`: `comment_id`, `reporter_id`, `reason` (a literal union in `@vp/domain`: `spam`,
  `harassment`, `hate`, `misinformation`, `other`), `note`, `created_at`, `resolved_at`, `resolution`; one report
  per reporter per comment.
- `POST /v1/comments/:id/reports` for any signed-in viewer.
- `GET /v1/admin/reports` (keyset, open first) and `POST /v1/admin/reports/:id/resolve` (`removed` or `dismissed`,
  removing through 42's delete) for admins.

### 3. The creator's inbox

- `GET /v1/creator/comments`: comments across the caller's videos, newest first, with `filter` (`all`,
  `unanswered` (no reply from the creator), `reported`) and the video summary on each.
- A new comment on a creator's video emits 98's `comment.created` to the creator, so an open studio inbox and its
  nav badge update live.

### 4. The apps

- Web: the heart on `CommentItem` for the owner (the parts in web's kit from [95](95-design-system-2.md)), and Report as a `Dialog` with the reasons.
- Studio: the dashboard's latest comments and a `/comments` page on `DataTable` with the filters, reply inline,
  heart and pin; 61's moderation reads the report queue.

## Acceptance criteria

- [ ] A creator hearts a comment on their video; anyone else gets a 403; the heart shows to every viewer.
- [ ] A viewer reports a comment once; a second report by the same viewer is refused; the report appears in the
      admin queue and resolving it as removed deletes the comment.
- [ ] The creator's inbox lists comments across their videos with each filter, and a new comment appears live.
- [ ] `privilege-escalation.test.ts` gains the heart and admin rows.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `pnpm gen:contracts`
      (no diff) green, with output in the PR.

## Out of scope

- Automatic hold-for-review, blocked words, or banning a user from a channel.

## Testing plan

- Rules and routes: hearts, report de-duplication, resolve, the inbox filters, the 403s.
- Apps: the report dialog and the studio inbox through `renderRoute` with MSW and a simulated event.

## Open questions

None.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
