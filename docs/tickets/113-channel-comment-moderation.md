# 113: Channel comment moderation - hold for review, blocked words, slow mode, hidden users and a moderation queue

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | L |
| Blocked by | 39 - Permissions · 41 - Channel subscriptions · 42 - Threaded comments · 44 - Creator studio video management · 59 - Modern video watch page · 60 - Creator studio dashboard · 95 - Design system 2 · 98 - Realtime user event stream · 99 - Notifications · 103 - Comment hearts, reports and the creator inbox · 117 - Channel team roles |
| Blocks | 114, 116, 118, 120, 122 |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §5 Domain model & DDL](../SDD.md#5-domain-model--database-schema) · [SDD ADR-24 Result-typed errors](../SDD.md#adr-24--result-typed-error-handling-domain-returns-the-edge-decides) |

**Status:** blocked

> **Why.** [42](42-threaded-comments-keyset-pagination-moderation.md) lets the owner pin a comment and delete any comment
> under their video, and [103](103-comment-hearts-reports-creator-inbox.md) adds hearts, reports and the creator's inbox;
> its Out of scope names hold-for-review, blocked words and channel bans, which is this ticket. Today every comment is
> public the moment it is posted, a creator cannot stop a pile-on before it starts, cannot delegate the queue, and a
> removed comment vanishes without telling its author why.

> **Builds on, does not redo.** Pin, unpin and the owner's delete are 42's endpoints and stay as they are; this ticket
> widens who may call them (117's roles) and surfaces them in the watch page. Hearts, reports and the inbox endpoint are
> 103's; this ticket adds filters and bulk actions to the inbox. Live chat's slow and subscribers-only modes
> ([76](76-live-streaming-rtmp-whip-llhls-packaging-chat.md)) are a different surface and are not touched. The
> moderator role, membership and the audit log table are [117](117-channel-team-roles.md)'s; this ticket writes its
> actions into that log.

### Pinning and hearts, one vocabulary

Defined here and used by every later ticket (114, 115, 119, 120, 121, 122). A **pin** is curation that changes order: one
`pin` action in `@vp/permissions` on each subject (`Comment`, `Thread`, `Post`, `Video` for a Start here shelf, `Playlist`),
never `feature`, `highlight` or `star`, with the channel conditions of 117's matrix. Each ticket states its cap once:

| Subject | Cap | Stored as | Ticket |
|---|---|---|---|
| comment | 1 per target (video, post or thread) | `is_pinned`, a new pin unpins the old one | [42](42-threaded-comments-keyset-pagination-moderation.md), generalised per target by 120 |
| thread | 3 per video | `pinned_at`, newest first | [120](120-community-posts-and-threads.md) |
| post | 3 per channel | `pinned_at`, newest first | 120 |
| Start here video | 6, ordered | `position` | [96](96-channel-featured-videos-start-here.md) |
| playlist in a viewer's library | 5 per user | `pinned_at`, newest first | [119](119-playlists-customisation-and-collaboration.md) |

42's boolean is the cap-one case and is not migrated; `position` is 96's because that shelf is an ordered set; the rest use
the same nullable `pinned_at`. A **heart** ([103](103-comment-hearts-reports-creator-inbox.md)) is creator recognition: it has
no order, never moves a comment, and notifies its author. Hearts and pins are different columns, actions and endpoints, and a
comment can be both.

## What to build

### 1. Data

- Table `channel_comment_settings` (one row per channel, created on first save, defaults when absent): `review_mode`
  (`none`, `links`, `all`), `blocked_words` (up to 200 entries of 2 to 40 characters), `link_allowlist` (up to 50
  hostnames), `slow_mode_seconds` (null or one of 5, 10, 30, 60, 300), `subscribers_only` (boolean),
  `min_account_age_days` (0 to 30).
- `videos.comments_enabled` (boolean, default true).
- On `video_comments`: `held_at` (nullable), `held_reason` (`review_all`, `link`, `blocked_word`, nullable) and
  `looks_like_question` (boolean, written at insert). A held comment is not in `comments_count` and not in 42's hot
  cache until approved.
- Table `channel_hidden_users` (`channel_id`, `user_id`, `hidden_by`, `created_at`), table
  `channel_trusted_commenters` (same shape), table `channel_saved_replies` (`id`, `channel_id`, `title` up to 40,
  `body` up to 2000, `position`; up to 20 per channel).
- Table `comment_removals` for removal reasons, because 42's delete is physical: `id`, `channel_id`, `video_id`,
  `author_id`, `excerpt` (first 200 characters), `reason` (`spam`, `harassment`, `hate`, `misinformation`,
  `off_topic`, `other`; 103's report reasons plus `off_topic`, one union in `@vp/domain`), `note` (up to 200),
  `removed_by`, `created_at`. Housekeeping deletes rows older than 30 days.
- Repository interfaces in `@vp/core/repositories` with postgres and in-memory implementations, one file each (Rule 5).

### 2. The gate on a new comment

One pure function in `@vp/domain-rules`, `evaluateCommentGate(settings, context, text)`, returns
`Result<'publish' | 'hold', Failure>`; `CommentService.create` composes it and `sendResult` unwraps it (Rule 14).
Checked in this order:

1. `commentsEnabled` false -> `COMMENTS_DISABLED` (403). Owner, managers and moderators may still comment.
2. `subscribers_only` and the author is not subscribed ([41](41-channel-subscriptions-subscriber-feed.md)) and not a
   channel member -> `COMMENTS_SUBSCRIBERS_ONLY` (403).
3. Account younger than `min_account_age_days` -> `COMMENTS_ACCOUNT_TOO_NEW` (403, with the day it opens).
4. Slow mode: one Redis `SET NX` with a TTL of `slow_mode_seconds` per `(channel, author)`; a second comment inside
   the window -> `COMMENTS_SLOW_MODE` (429 with `Retry-After`). Replies count.
5. Hold decision, skipped for trusted commenters and for channel members: a blocked-word match holds the comment in
   every mode (matching is case- and accent-insensitive, on word boundaries, normalised once in `@vp/validation`);
   `review_mode` `links` holds a comment with a URL whose host is not on the allowlist (subdomains of an allowed host
   pass); `all` holds everything.

A held comment answers `201` with `status: 'held'`. The author sees it, marked as waiting for review, and nobody
else does. Slow mode and the age check never apply to trusted commenters and members.

A hidden user's comments are accepted and stored, and shown only to their author: the read scope joins
`channel_hidden_users`, so unhiding restores them with no rewrite. Hiding or unhiding purges 42's hot cache for the
channel's videos that carry that user's comments. The author is never told.

`looks_like_question` is a pure rule in `@vp/validation`: the text contains a question mark, or a sentence starts with
one of a fixed list of interrogative words (English first; a list per locale follows
[86](86-localisation-rollout-locale-negotiation-rtl.md)). It is a marker for a filter, not a classifier, and it infers
nothing about the author.

### 3. API

| Endpoint | Who | What |
|---|---|---|
| `GET` and `PUT /v1/me/channel/comment-settings` | owner, manager | the settings above; `PUT` replaces, validates in `@vp/validation` |
| `PATCH /v1/videos/:id` (44) | video editors | gains `commentsEnabled`, under 44's version check |
| `POST /v1/comments/:id/approve` | owner, manager, moderator | publishes a held comment, bumps the count, emits the live event |
| `POST /v1/comments/:id/remove` | owner, manager, moderator | body `{ reason, note? }`; deletes through 42's delete and writes `comment_removals` |
| `GET`, `PUT` and `DELETE /v1/me/channel/hidden-users/:userId` | owner, manager, moderator | list (keyset), hide and unhide |
| `GET`, `PUT` and `DELETE /v1/me/channel/trusted-commenters/:userId` | owner, manager | trust list |
| `GET`, `POST`, `PATCH`, `DELETE /v1/me/channel/saved-replies` | owner, manager write; moderator reads | canned replies |
| `POST /v1/creator/comments/bulk` | per action | body `{ action: 'approve' \| 'remove' \| 'hide_author', ids (up to 100), reason? }`; each id is checked against its own rule and the response lists `{ id, ok, code? }`, so one refusal never fails the batch |
| `GET /v1/creator/comments` (103) | inbox | gains `filter=held`, `questions` and `hidden` beside 103's `all`, `unanswered`, `reported` |
| `GET /v1/me/comment-removals` | the author | their removed comments in the last 30 days with reason and note |

- Every comment resource gains `status` (`published`, `held`). A removed comment is gone, so its author reads the
  reason from `comment-removals`, and a removal also creates a [99](99-notifications.md) notification of a new kind
  `comment_removed`, added to 99's union here.
- Events (98's union): `comment.held` goes to every member who may moderate that channel, so an open queue and the
  nav badge update live; `comment.created` keeps going for published comments.
- Authorization is `@vp/permissions` only (Rule 8): actions `approve`, `remove`, `hideUser` and the existing `pin` on
  `Comment`, plus `update` on `CommentSettings`, as conditions on the comment's channel, with the owner, manager and
  moderator rows of 117's matrix. The platform `MODERATOR` keeps its global delete.
- Each of these calls records one action in 117's `channel_audit_log`: `comment.approved`, `comment.removed`,
  `comment.pinned`, `user.hidden`, `user.unhidden`, `trusted.added`, `trusted.removed`, `settings.comments.updated`,
  `video.comments.toggled`; a bulk call records one row per comment.
- New error codes in `@vp/errors` (SDD §6.2 updated in the same PR); everything in `@vp/api-contracts`, the committed
  OpenAPI document and SDD §6.1.

### 4. Web: the watch page's comment UI

On [59](59-video-watch-page-responsive-layout-enhancements.md)'s thread, through `useCan` and `CommentItem`'s menu
([docs/design/apps/web/comment-item.md](../design/apps/web/comment-item.md)):

- the menu gains Pin or Unpin (42's endpoint), Remove (a `Dialog` with the reason `Select` and a note), Hide user from
  channel and, on a held comment, Approve, each only when the ability allows it;
- `CommentItem` gains a `held` state: a `Badge` "Waiting for review" and a muted body, shown to the author and to
  moderators only; the thread shows nothing to anyone else;
- the composer ([docs/design/apps/web/comment-thread.md](../design/apps/web/comment-thread.md)) shows the refusal in
  place: comments off (a `Callout`, no field), subscribers only (the Subscribe action in the callout), account too
  new (the opening day), slow mode (a countdown from `Retry-After` on the submit `Button`, disabled until zero);
- the author's removed-comment notice comes through the bell (99), linking to a small `/you/removed-comments` list.

### 5. Studio

- `/comments` (103's page) gets the new filters as `SegmentedControl` options and a selection mode on its rows with a
  bulk bar (approve, remove, hide author) over `POST /v1/creator/comments/bulk`; a partial result shows which ids
  failed and why in a `Toast`.
- `/comments/queue`: the moderation queue for held comments, one comment at a time with its video, context and the
  author's recent comments on the channel. The keyboard flow: `j` and `k` move, `a` approves, `r` removes (opens the
  reason `Dialog`; `1` to `5` pick a reason, `Enter` confirms), `h` hides the author, `x` selects, `?` opens the key
  list; every shortcut also has a visible `Button` with a `Kbd` hint, and none fires while a field has focus. The row
  that acted leaves optimistically with rollback on error.
- A saved-replies `Popover` in the inbox's inline reply (pick, edit, send), and `/comments/settings`: independent
  sections, each with its own save (review mode, blocked words, link allowlist, slow mode, subscribers only, account
  age, trusted commenters, hidden users, saved replies), the way [96](96-channel-featured-videos-start-here.md) and
  [72](72-frontend-settings-customization-system.md) build `/customization`.
- The per-video comments switch in the video editor ([60](60-creator-studio-dashboard-video-management-ui.md)) and as
  a row action in the library.
- New kit parts, specified under `docs/design/` and built in this ticket: `TagInput` (a primitive over `Chip` and
  `Input`, for blocked words and the allowlist, with paste-a-list and duplicate handling), `BulkActionBar` and
  `ModerationQueue` (studio kit; the queue is a listbox with roving focus). Everything else is `DataTable`, `Dialog`,
  `Select`, `SegmentedControl`, `Switch`, `Field`, `Popover`, `Callout`, `Toast`, `Kbd`, `Badge`, `EmptyState` from
  [95](95-design-system-2.md).

## Delivery

One stack of three slices:

1. Data, the gate in `@vp/domain-rules`, the settings endpoints, `commentsEnabled`, the held state in reads and the
   cache, the `comment.held` event.
2. Approve, remove with reasons, hide, trusted, saved replies, bulk, the inbox filters, the removals endpoint, the
   notification kind and the audit calls.
3. The web comment UI and the studio (settings, bulk bar, queue and its keyboard flow).

## Acceptance criteria

- [ ] With `all`, a viewer's comment is held: the author sees "Waiting for review", nobody else sees it, the count and
      cache exclude it; approving it publishes it live for everyone.
- [ ] With `links`, a comment with a link to a host off the allowlist is held and one to an allowed host is not; a
      blocked word holds in `none`, `links` and `all`, but not for a trusted commenter.
- [ ] A hidden user's comment shows only to them; unhiding makes it visible with no data change; a hot-cache read never
      leaks it.
- [ ] Slow mode refuses a second comment inside the window with `Retry-After`, the composer counts down, and a member
      is exempt; subscribers only, account age and comments-off each refuse with their code and the composer says why.
- [ ] A removal needs a reason; the author sees reason and note in their list and the bell; a bulk call with one
      unauthorised id removes the rest and reports that id.
- [ ] A moderator (117) can approve, remove, pin and hide but gets a 403 on settings; an editor gets a 403 on all of
      them; `privilege-escalation.test.ts` gains the rows.
- [ ] The queue works by keyboard alone (`j`, `k`, `a`, `r`, `h`), with shortcuts inert inside fields.
- [ ] The questions filter lists comments with a question mark or a leading question word and nothing else.
- [ ] Every action above appears in the channel audit log with the acting member.
- [ ] The pieces meet the polish bar ([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `pnpm gen:contracts`
      (no diff) green, with output in the PR.

## Out of scope

- Any model, classifier or score on a comment or its author (spam, toxicity, sentiment, emotion): every rule here is a
  list, a count or a clock.
- Appeals, banning a user from the platform (admin panel, [61](61-admin-control-panel-category-moderation-ui.md)),
  cross-channel shared blocklists, and live chat moderation ([76](76-live-streaming-rtmp-whip-llhls-packaging-chat.md)).
- Email or push alerts about held comments.

## Testing plan

- Domain rules: one `it.each` table over `evaluateCommentGate` (mode x link x word x trusted x member x age) and one for
  the question markers.
- Repositories: the shared contract suite over postgres and in-memory.
- Routes: contract tests per endpoint, the partial bulk result, the 403 matrix, the cache not leaking held or hidden
  comments.
- Web and studio: `renderRoute` specs for the composer refusals, the menu actions, the bulk bar and the queue's
  keyboard flow (user-event, including shortcuts inside a field).
- E2E: hold, approve, hide and unhide across two accounts.

## Open questions

- Decided: a blocked word holds instead of rejecting, so a false positive costs a review click, not a lost comment,
  and the author is never told a word was blocked.
- Decided: trusted commenters and channel members skip every automatic hold and slow mode; hiding a user is the only
  action the author is not told about.
- Decided: a removal is a physical delete plus a 30-day `comment_removals` row, so 42's delete stays as is and the
  reason lives outside the comment table.
- Decided: slow mode, subscribers only and account age are channel-wide; a video turns comments off instead of
  overriding them.
- Decided: 117 ships first, so this ticket never builds a second moderator list.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] SDD §5, §6.1 and §6.2 updated; the OpenAPI document regenerated.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
