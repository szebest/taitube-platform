# 113: Channel comment moderation - hold for review, blocked words, slow mode, silent or visible actions, bans and a moderation queue

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

### The moderation model: silent or visible

Every moderation action is one value of a tagged union, `ModerationAction`, in `@vp/domain`, discriminated on `action`, with
a `disclosure` of `silent` or `visible` where the action may be either. A pure function `applyModeration(state, action)` in
`@vp/domain-rules` returns the next state or a `Failure`; the services, the routes, the queue, the bulk bar, the audit log
and the read scopes all take this one type, so no action carries a flag of its own.

| `action` | Subject | `silent` | `visible` | Notes |
|---|---|---|---|---|
| `hold` | comment | the author's copy looks published | the author's copy shows "Waiting for review" | out of public reads until `approve`; also what the gate applies |
| `approve` | held comment | - | - | publishes; the restore of a hold |
| `hide` | comment | the author sees it as normal, others do not | the author sees it marked hidden, with the reason | `unhide` restores it |
| `unhide` | hidden comment | - | - | the restore of a hide |
| `remove` | comment | gone for everyone, the author is not told | the author gets the reason and a notification | physical delete through 42, so no restore |
| `shadow_ban` | user, per channel | always | - | the user keeps posting and sees their own items; nobody else does; never told |
| `ban` | user, per channel | - | always | writes are refused with the reason and expiry; optional `expiresAt` (presets 1 hour, 24 hours, 7 days, 30 days, or none for permanent) |
| `lift` | user, per channel | - | - | lifts either restriction |

`shadow_ban` is silent and `ban` is visible by definition, which is why they are two members and not one with a flag. A
banned or shadow-banned user's restriction is read at read time (shadow) and at write time (ban), so `lift` rewrites nothing.
The disclosure of `hold`, `hide` and `remove` is chosen by the moderator each time.

**Defaults**: `channel_comment_settings.disclosure` holds one default per action: `hide`, `remove`, `manual_hold`, and the
automatic holds `auto.blocked_words`, `auto.links` and `auto.review_all`, each `silent` or `visible`. Out of the box:
`hide` silent, `remove` visible, `manual_hold` visible, `auto.blocked_words` silent (the author is never told a word
matched), `auto.links` and `auto.review_all` visible. Every endpoint, the queue and the bulk bar take an optional
`disclosure` that overrides the default for that one action; a visible `remove` or `hide` needs a reason, a silent one may
keep one for the audit log only.

**What the author sees**: for a silent state the comment resource says `status: 'published'` and `moderation: null`, exactly
as an unmoderated one; for a visible state it carries `moderation: { state: 'held' | 'hidden', reason? }`; a moderator
sees `moderation: { state, disclosure, reason, by, at }` on everything. Nobody else gets the item at all.

### 1. Data

- Table `channel_comment_settings` (one row per channel, created on first save, defaults when absent): `review_mode`
  (`none`, `links`, `all`), `blocked_words` (up to 200 entries of 2 to 40 characters), `link_allowlist` (up to 50
  hostnames), `slow_mode_seconds` (null or one of 5, 10, 30, 60, 300), `subscribers_only` (boolean),
  `min_account_age_days` (0 to 30).
- `videos.comments_enabled` (boolean, default true).
- On `video_comments`: `moderation_state` (`published`, `held`, `hidden`; default `published`), `moderation_disclosure`,
  `moderation_reason`, `moderated_by`, `moderated_at`, `held_reason` (`review_all`, `link`, `blocked_word`, nullable) and
  `looks_like_question` (boolean, written at insert). Only `published` comments of unrestricted authors are in
  `comments_count`, reply counts and 42's hot cache.
- Table `channel_user_restrictions` (`channel_id`, `user_id`, `kind` `shadow | ban`, `reason` up to 200 (ban only),
  `expires_at` (nullable), `created_by`, `created_at`; one row per `(channel_id, user_id)`; an expired row counts as absent
  and housekeeping purges it after 30 days), table `channel_trusted_commenters` (`channel_id`, `user_id`, `created_by`,
  `created_at`), table `channel_saved_replies` (`id`, `channel_id`, `title` up to 40, `body` up to 2000, `position`; up to
  20 per channel).
- Table `comment_removals` for removal reasons, because 42's delete is physical: `id`, `channel_id`, `video_id`,
  `author_id`, `excerpt` (first 200 characters), `reason` (`spam`, `harassment`, `hate`, `misinformation`,
  `off_topic`, `other`; 103's report reasons plus `off_topic`, one union in `@vp/domain`), `note` (up to 200),
  `disclosure`, `removed_by`, `created_at`. The author's list shows `visible` rows only; housekeeping deletes rows older than
  30 days.
- Repository interfaces in `@vp/core/repositories` with postgres and in-memory implementations, one file each (Rule 5).

### 2. The gate on a new comment

One pure function in `@vp/domain-rules`, `evaluateCommentGate(settings, context, text)`, returns
`Result<'publish' | 'hold', Failure>`; `CommentService.create` composes it and `sendResult` unwraps it (Rule 14).
Checked in this order:

0. A visible `ban` on the author (not expired) -> `COMMENTS_BANNED` (403 with `reason` and `expiresAt`); this applies to
   comments, thread creation, post replies and reactions on the channel's videos, comments and posts. A shadow ban takes
   no part in the gate: the write succeeds and is stored, which is what keeps it silent.
1. `commentsEnabled` false -> `COMMENTS_DISABLED` (403). Owner, managers and moderators may still comment.
2. `subscribers_only` and the author is not subscribed ([41](41-channel-subscriptions-subscriber-feed.md)) and not a
   channel member -> `COMMENTS_SUBSCRIBERS_ONLY` (403).
3. Account younger than `min_account_age_days` -> `COMMENTS_ACCOUNT_TOO_NEW` (403, with the day it opens).
4. Slow mode: one Redis `SET NX` with a TTL of `slow_mode_seconds` per `(channel, author)`; a second comment inside
   the window -> `COMMENTS_SLOW_MODE` (429 with `Retry-After`). Replies count.
5. Hold decision, skipped for trusted commenters and for channel members: a blocked-word match holds the comment (with the
   disclosure of `auto.blocked_words`) in
   every mode (matching is case- and accent-insensitive, on word boundaries, normalised once in `@vp/validation`);
   `review_mode` `links` holds a comment with a URL whose host is not on the allowlist (subdomains of an allowed host
   pass); `all` holds everything.

A held comment answers `201`; the author's copy follows the disclosure of the rule that held it (silent: it looks published
to them; visible: marked as waiting for review) and nobody else sees it. Slow mode and the age check never apply to
trusted commenters and members.

A shadow-banned user's comments are accepted and stored, shown only to their author, and answered with the same `201`, the
same body and the same path as any comment, so nothing in the response differs.

**Silent state never leaks.** One read scope in the comment repository, `publicCommentScope(viewer)`, is the only way
comments are read (lists, replies, permalinks, the inbox for non-moderators, the hot cache, counts): it admits `published`
comments of unrestricted authors, plus the viewer's own items. On top of it:

- Counts (`comments_count`, reply counts, post and thread reply counts) exclude every item that is not public, adjusted in
  the transaction that changes a state; a `shadow_ban`, `ban` or `lift` enqueues an idempotent `recount-comments` job for that
  user's targets. The author's own view adds their own non-public items, in one batched lookup per page, so their count
  matches their list.
- Replies to a hidden or removed comment follow it out of public reads; a silent `remove` or `hide` is not announced to their
  authors, who still find them under their own comments.
- Notifications ([99](99-notifications.md)): a non-public item creates none for anyone else (replies, mentions, hearts, a post
  reply to the creator); moving an item out of public removes the unread ones that refer to it.
- Events ([98](98-realtime-user-event-stream.md)) and webhooks ([77](77-platform-integrations-oembed-embed-player-webhooks.md),
  [118](118-creator-data-portability-and-api.md)): `comment.created` and its webhook go out for public comments only;
  `comment.held` carries ids to moderators only; a silent action emits nothing beyond the audit log.
- Exports: [118](118-creator-data-portability-and-api.md)'s comment export is for owner and manager, who can see
  everything, and carries the state and disclosure; no other reader gets a non-public row.
- The hot cache and the Redis counters hold public state only, and a state change purges the target's entries.

`looks_like_question` is a pure rule in `@vp/validation`: the text contains a question mark, or a sentence starts with
one of a fixed list of interrogative words (English first; a list per locale follows
[86](86-localisation-rollout-locale-negotiation-rtl.md)). It is a marker for a filter, not a classifier, and it infers
nothing about the author.

### 3. API

| Endpoint | Who | What |
|---|---|---|
| `GET` and `PUT /v1/me/channel/comment-settings` | owner, manager | the settings above including the `disclosure` defaults; `PUT` replaces, validates in `@vp/validation` |
| `PATCH /v1/videos/:id` (44) | video editors | gains `commentsEnabled`, under 44's version check |
| `POST /v1/comments/:id/moderate` | owner, manager, moderator | body is a comment `ModerationAction`: `{ action: 'hold' \| 'approve' \| 'hide' \| 'unhide' \| 'remove', disclosure?, reason?, note? }`; `remove` deletes through 42's delete and writes `comment_removals`; one endpoint for every comment action |
| `GET /v1/me/channel/restrictions`, `PUT` and `DELETE /v1/me/channel/restrictions/:userId` | owner, manager, moderator | list (keyset, with kind, reason and expiry), apply `{ action: 'shadow_ban' }` or `{ action: 'ban', reason?, expiresAt? }`, and `lift` |
| `GET`, `PUT` and `DELETE /v1/me/channel/trusted-commenters/:userId` | owner, manager | trust list |
| `GET`, `POST`, `PATCH`, `DELETE /v1/me/channel/saved-replies` | owner, manager write; moderator reads | canned replies |
| `POST /v1/creator/comments/bulk` | per action | body `{ ids (up to 100 comments), action }` where `action` is any `ModerationAction` (a user action applies to each comment's author, once per author), with its `disclosure` and reason; each id is checked against its own rule and the response lists `{ id, ok, code? }`, so one refusal never fails the batch |
| `GET /v1/creator/comments` (103) | inbox | gains `filter=held`, `hidden`, `questions` and `restricted` beside 103's `all`, `unanswered`, `reported` |
| `GET /v1/me/comment-removals` | the author | their visibly removed comments in the last 30 days with reason and note (silent removals are not listed) |
| `GET /v1/channels/:id/me/restriction` | signed in | the caller's own visible ban with reason and expiry; `404` for none and for a shadow ban |

- Every comment resource gains `status` and `moderation` as described above. A visible `hold`, `hide`, `remove` or `ban` also
  creates one [99](99-notifications.md) notification of a new kind `moderation` (payload: the action, the reason, the
  expiry), added to 99's union here; a silent action creates none.
- Events (98's union): `comment.held` goes to every member who may moderate that channel, so an open queue and the
  nav badge update live; `comment.created` keeps going for published comments.
- Authorization is `@vp/permissions` only (Rule 8): actions `hold`, `approve`, `hide`, `unhide`, `remove` and the existing `pin` on
  `Comment`, `restrict` on `ChannelUser` (shadow ban, ban and lift), plus `update` on `CommentSettings`, as conditions on the comment's channel, with the owner, manager and
  moderator rows of 117's matrix. The platform `MODERATOR` keeps its global delete.
- Each of these calls records one action in 117's `channel_audit_log`: `comment.held`, `comment.approved`, `comment.hidden`,
  `comment.unhidden`, `comment.removed`, `comment.pinned`, `user.shadow_banned`, `user.banned`, `user.restriction_lifted`,
  `trusted.added`, `trusted.removed`, `settings.comments.updated`, `video.comments.toggled`. Every moderation row carries
  `meta.disclosure` (`silent` or `visible`), and a ban its `expiresAt`; a bulk call records one row per comment.
- New error codes in `@vp/errors` (SDD §6.2 updated in the same PR); everything in `@vp/api-contracts`, the committed
  OpenAPI document and SDD §6.1.

### 4. Web: the watch page's comment UI

On [59](59-video-watch-page-responsive-layout-enhancements.md)'s thread, through `useCan` and `CommentItem`'s menu
([docs/design/apps/web/comment-item.md](../design/apps/web/comment-item.md)):

- the menu gains Pin or Unpin (42's endpoint) and a Moderate submenu (Hold, Approve, Hide, Unhide, Remove, Shadow ban user,
  Ban user, Lift), each only when the ability allows it; an action opens a `Dialog` with a `SegmentedControl` **Silent |
  Visible** preset to the channel's default for that action, the reason `Select` and note (required when visible), and for
  a ban the duration `Select`;
- `CommentItem` gains `held` and `hidden` states for the author and moderators: a `Badge` "Waiting for review" or "Hidden by
  moderators" with the reason, and a muted body; a moderator also sees a quiet "silent" marker; the thread shows nothing to
  anyone else;
- the composer ([docs/design/apps/web/comment-thread.md](../design/apps/web/comment-thread.md)) shows the refusal in
  place: comments off (a `Callout`, no field), subscribers only (the Subscribe action in the callout), account too
  new (the opening day), slow mode (a countdown from `Retry-After` on the submit `Button`, disabled until zero), and a visible ban (a `Callout` with
  the reason and the expiry, no field); a shadow-banned user sees the normal composer;
- a visible action reaches the author through the bell (99), linking to a small `/you/moderation` list of their visibly
  removed comments and their current visible ban.

### 5. Studio

- `/comments` (103's page) gets the new filters as `SegmentedControl` options and a selection mode on its rows with a
  bulk bar (approve, hide, remove, shadow ban, ban) with a Silent | Visible control over `POST /v1/creator/comments/bulk`; a partial result shows which ids
  failed and why in a `Toast`.
- `/comments/queue`: the moderation queue for held comments, one comment at a time with its video, context and the
  author's recent comments on the channel. The keyboard flow: `j` and `k` move, `a` approves, `r` removes (opens the
  reason `Dialog`; `1` to `5` pick a reason, `Enter` confirms), `h` hides the comment, `b` bans the author, `v` flips the next action between silent and visible (the current value is
  always shown on the action's `Button`), `x` selects, `?` opens the key
  list; every shortcut also has a visible `Button` with a `Kbd` hint, and none fires while a field has focus. The row
  that acted leaves optimistically with rollback on error.
- A saved-replies `Popover` in the inbox's inline reply (pick, edit, send), and `/comments/settings`: independent
  sections, each with its own save (review mode, blocked words, link allowlist, slow mode, subscribers only, account
  age, **visibility defaults** (one Silent | Visible control per action with a line saying what the author sees),
  trusted commenters, **restrictions** (shadow bans and bans with their expiry and Lift), saved replies), the way [96](96-channel-featured-videos-start-here.md) and
  [72](72-frontend-settings-customization-system.md) build `/customization`.
- The per-video comments switch in the video editor ([60](60-creator-studio-dashboard-video-management-ui.md)) and as
  a row action in the library.
- New kit parts, specified under `docs/design/` and built in this ticket: `TagInput` (a primitive over `Chip` and
  `Input`, for blocked words and the allowlist, with paste-a-list and duplicate handling), `DisclosureControl` (the Silent |
  Visible switch over `SegmentedControl`, shared by the dialog, the queue and the bulk bar), `BulkActionBar` and
  `ModerationQueue` (studio kit; the queue is a listbox with roving focus). Everything else is `DataTable`, `Dialog`,
  `Select`, `SegmentedControl`, `Switch`, `Field`, `Popover`, `Callout`, `Toast`, `Kbd`, `Badge`, `EmptyState` from
  [95](95-design-system-2.md).

## Delivery

One stack of three slices:

1. Data, `ModerationAction` and `applyModeration`, the gate in `@vp/domain-rules`, the read scope and counts, the settings endpoints, `commentsEnabled`, the held state in reads and the
   cache, the `comment.held` event.
2. `moderate`, restrictions, trusted, saved replies, bulk, the leak tests, the inbox filters, the removals endpoint, the
   notification kind and the audit calls.
3. The web comment UI and the studio (settings, bulk bar, queue and its keyboard flow).

## Acceptance criteria

- [ ] Switching account or channel ([123](123-multiple-accounts-and-channels.md)) shows only the new identity's moderation queue, with every action written as the acting identity, with no stale cache.
- [ ] With `all` and the visible default, a viewer's comment is held: the author sees "Waiting for review", nobody else sees
      it, the count and cache exclude it; approving it publishes it live for everyone. With the silent default the author's
      copy looks published.
- [ ] With `links`, a comment with a link to a host off the allowlist is held and one to an allowed host is not; a
      blocked word holds in `none`, `links` and `all`, but not for a trusted commenter.
- [ ] A shadow-banned user's comment is accepted with a response identical to an ordinary one, shows only to them, and lifting
      the ban makes it visible with no data change; a hot-cache read never leaks it.
- [ ] A visible ban refuses comments, thread creation, post replies and reactions on the channel with `COMMENTS_BANNED`, the
      reason and the expiry, tells the user through 99, and ends at its expiry or on `lift` with no rewrite; a timeout of 24
      hours is over after 24 hours without any job having run.
- [ ] Slow mode refuses a second comment inside the window with `Retry-After`, the composer counts down, and a member
      is exempt; subscribers only, account age and comments-off each refuse with their code and the composer says why.
- [ ] A visible removal or hide needs a reason and the author sees it in their list and the bell; a silent one tells the
      author nothing and creates no notification. The moderator can override each channel default per action, in the dialog,
      the queue and the bulk bar; a bulk call with one unauthorised id applies the rest and reports that id.
- [ ] Every comment action and automatic hold honours its own disclosure setting (`hide`, `remove`, `manual_hold`,
      `auto.blocked_words`, `auto.links`, `auto.review_all`), and every audit row records the disclosure used.
- [ ] **No leak of silent state**: for a silently hidden, held, removed or shadow-banned item, a table-driven spec over every
      read path (comment lists and replies, permalink, hot cache, `comments_count` and reply counts, the inbox for a
      non-moderator, post and thread replies, notifications and events, the webhook payloads, the export for a
      non-exporter, and the error and timing of the write) shows it identical to "nothing happened" for every viewer except
      its author and the moderators, and the author's own view matches their own count.
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
- Leaks: one `it.each` over (state x disclosure x viewer kind x read path) asserting the public result is unchanged by a silent
  action, run against the repository, the cache layer, the routes and the event and notification producers.
- Domain: `it.each` over `applyModeration` (every action x state x disclosure, including the refused combinations).
- Routes: contract tests per endpoint, the partial bulk result, the 403 matrix, the cache not leaking held or hidden
  comments.
- Web and studio: `renderRoute` specs for the composer refusals, the menu actions, the bulk bar and the queue's
  keyboard flow (user-event, including shortcuts inside a field).
- E2E: hold, approve, hide and unhide across two accounts.

## Open questions

- Decided: one `ModerationAction` union and one `moderate` endpoint carry every comment action, and the silent or visible choice
  is a `disclosure` field on the action, not a flag per feature, so a new action is one more member.
- Decided: a blocked word holds instead of rejecting, so a false positive costs a review click, not a lost comment, and its
  default disclosure is silent.
- Decided: trusted commenters and channel members skip every automatic hold and slow mode.
- Decided: a shadow ban is silent and a ban is visible by definition, so they are two members of the union, and a timeout is a
  ban with an expiry.
- Decided: replies follow a hidden or removed parent out of public reads, and their authors are not told for silent actions;
  a reply author may notice the missing context, which is the cost of not showing a placeholder.
- Decided: a removal is a physical delete plus a 30-day `comment_removals` row, so 42's delete stays as is and the
  reason lives outside the comment table.
- Decided: slow mode, subscribers only and account age are channel-wide; a video turns comments off instead of
  overriding them.
- Decided: 117 ships first, so this ticket never builds a second moderator list.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] SDD §5, §6.1 and §6.2 updated; the OpenAPI document regenerated.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
