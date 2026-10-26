# 120: Community - channel posts, polls and quizzes, and timestamped viewer threads

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | XL (one stack of three slices, see *Delivery*) |
| Blocked by | 17 - Housekeeping · 38 - User identity · 39 - Permissions · 40 - Video reactions · 41 - Channel subscriptions · 42 - Threaded comments · 57 - Production video player · 58 - Modern browse layout · 59 - Modern video watch page · 95 - Design system 2 · 98 - Realtime user event stream · 99 - Notifications · 103 - Comment hearts, reports and the creator inbox · 113 - Channel comment moderation · 115 - Channel identity · 116 - Video management power tools · 117 - Channel team roles |
| Blocks | 121, 122 |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §5 Domain model & DDL](../SDD.md#5-domain-model--database-schema) · [SDD §11 Security](../SDD.md#11-security) · [SDD ADR-24 Result-typed errors](../SDD.md#adr-24--result-typed-error-handling-domain-returns-the-edge-decides) |

**Status:** blocked

> **Why.** [104](104-channel-page-data.md) leaves the channel page's Community tab hidden "until its own ticket", and this is it.
> A creator can reach subscribers only by uploading: there is no way to ask them a question, share an update, point at a
> video, or run a poll, and the only discussion lives under a video as one flat list with timestamps typed into the text.

> **Builds on, does not redo.** Comments, threading, sorting, pinning and the cache are
> [42](42-threaded-comments-keyset-pagination-moderation.md)'s; hearts, reports and the creator inbox are
> [103](103-comment-hearts-reports-creator-inbox.md)'s; silent or visible hold, hide and remove, shadow bans and bans, blocked words, slow mode, removal
> reasons and the audit entries are [113](113-channel-comment-moderation.md)'s and apply here unchanged; reactions and their
> counter cache are [40](40-high-throughput-video-reactions-counter-caching.md)'s; the subscriber feed and the per-channel
> notification level are [41](41-channel-subscriptions-subscriber-feed.md)'s and [99](99-notifications.md)'s; the image pipeline
> is [115](115-channel-page-customisation.md)'s (this ticket adds the `post-image` kind); revisions are
> [116](116-video-management-power-tools.md)'s; roles are [117](117-channel-team-roles.md)'s. The Posts tab is the Community
> tab of 104 under the name [121](121-channel-page-builder.md) uses (a creator can rename it there).

## What to build

### 1. Comments become commentable

42's `video_comments` is keyed to a video and 113 scopes moderation by the video's channel; replies on a post or a thread
need the same model, so one table serves all three instead of two copies of 42, 103 and 113.

- One migration renames `video_comments` to `comments` and adds `target_type` (`video`, `post`, `thread`), `target_id` and
  `channel_id`, backfilled from `video_id` (which becomes `target_id` with `target_type = 'video'`). The target no longer has
  a foreign key, so deleting a post, a thread or a video deletes its comments in the same transaction, and a spec proves each
  path. Indexes follow 42's with `(target_type, target_id)` in front.
- 42's repository, service, cache key (`taitube:{targetType}:{id}:comments:top`) and routes take a `CommentTarget` value (a
  tagged union on `type`) instead of a video id; the existing `/v1/videos/:id/comments` endpoints stay as they are and call
  it with `{ type: 'video' }`. New: `GET` and `POST /v1/posts/:id/comments` and `GET` and `POST /v1/threads/:id/comments`, with
  42's sort, keyset and one-level replies. `PATCH`, `DELETE` and `pin` by comment id are unchanged.
- 113's gate, 103's hearts and reports, the inbox (which gains a target summary on each row) and 117's matrix condition on
  the comment's `channel_id`, so a moderator moderates posts and threads with the same actions. Replies take 42's pin (one per target) and
  103's heart (`heart` on `Comment`, owner and manager rows), unchanged, so posts and threads add no second mechanism; the post
  itself has likes only and no creator heart. Per-target switches follow 113's `commentsEnabled` (a column on posts and threads' parent video).
- Reactions: the counter-cache helper of 40 takes a target kind; posts get `post_reactions` (`user_id`, `post_id`, `LIKE`) and
  likes only. `video_reactions` is not migrated, because it is the hot path of the platform and nothing about it needs to
  change.

### 2. Posts

- Table `channel_posts` (`id`, `channel_id`, `author_user_id`, `kind`, `payload` jsonb, `status` `draft | scheduled |
  published`, `publish_at`, `published_at`, `pinned_at`, `comments_enabled`, `edited_at`, `created_at`). `payload` is a Zod
  tagged union on `kind` in `@vp/api-contracts`, one member per kind and an exhaustive `switch` ending in `assertNever`:
  - `text`: up to 2000 characters of plain text; `https` links are detected at render and nothing else is markup.
  - `images`: 1 to 4 images, each with alt text up to 200 characters (required), uploaded through 115's pipeline as the
    `post-image` kind (variants at 640 and 1280 px wide), plus an optional caption.
  - `poll`: a question up to 140 characters, 2 to 6 options up to 60, an optional close time within 30 days. One vote per
    viewer, final; results show after voting or after the close, always to the creator.
  - `quiz`: a poll with `correctIndex` and an `explanation` up to 300, revealed after answering; the creator sees the share
    who answered correctly.
  - `video_share`: a public video, an optional comment up to 500 and an optional `startMs`, which is how a post quotes a moment
    of a video; `playlist_share`: a public playlist and a comment.
- Votes in `post_poll_votes` (`post_id`, `user_id`, `option_index`; unique `(post_id, user_id)`), tallied through 40's counter
  cache with Postgres as the source of truth. A shared video that later turns private shows "Unavailable" and nothing of it.
- **Drafts and schedules**: a draft is visible to the channel's members who may post; `scheduled` carries `publish_at` and a
  housekeeping scheduler ([17](17-housekeeping-reconciler-purge.md)) promotes it with a CAS on `status`, so a retry publishes
  once, and publishing creates the notifications and the feed rows.
- **Edit history**: editing a published post appends a revision in 116's `entity_revisions` (entity type `channel_post`); the
  public post shows "edited", members who may post see the history and can restore. A poll's options cannot change after the
  first vote.
- **Pinned**: the `pin` action on `Post`, up to 3 per channel, stored as `pinned_at`, newest pin first, on the Posts tab above
  the rest (the vocabulary and the caps table are [113](113-channel-comment-moderation.md)'s).
- Limits: 20 posts a day per channel, 50 drafts and scheduled posts.
- **Local-first**: a post renders only its own text, images uploaded here and cards for this platform's content; no link
  unfurling, no embeds and no third-party resource, and every link carries `rel="nofollow noopener ugc"`.

### 3. API

| Endpoint | Who | What |
|---|---|---|
| `GET /v1/channels/:idOrHandle/posts` | anyone | published posts, pinned first then newest, keyset; each with the viewer's vote and like |
| `GET /v1/posts/:id` | anyone who can see the channel | one post |
| `POST /v1/me/channel/posts`, `PATCH`, `DELETE /v1/me/channel/posts/:id` | members who may post | create (draft, schedule or publish), edit with a `version`, delete (comments go with it) |
| `POST /v1/me/channel/posts/:id/pin`, `DELETE` | same | pin and unpin |
| `PUT /v1/posts/:id/vote { optionIndex }` | signed in | one final vote or answer, `409` after the first |
| `PUT` and `DELETE /v1/posts/:id/reactions` | signed in | like and unlike |
| `GET /v1/feed/community` | signed in | posts from subscribed channels, newest first, keyset (a separate feed from `/v1/feed/subscriptions`, whose items are videos) |
| `GET /v1/me/channel/posts/:id/stats` | owner, manager, analytics role | opens, likes, replies, votes by option, share clicks, quiz correct share |
| `GET`, `POST /v1/videos/:id/threads`, `GET /v1/threads/:id` | see section 5 | viewer threads |

- Authorization is `@vp/permissions` only (Rule 8): `create`, `update`, `delete`, `pin` on `Post` and `read` on `PostStats`,
  all through 117's existing rows (owner, manager and editor manage and pin posts, the analytics role reads post stats, the
  moderator removes replies through 113 and nothing else). Members' posts show the channel as the
  author and the member in 117's audit log.
- Rules (the poll shape, the close time, a shared target is public, the daily limit, an unchanged poll after votes) are pure
  `Result`-returning functions in `@vp/domain-rules`; new error codes land in `@vp/errors` and SDD §6.2 together.
- Posts reach subscribers through 99: a new kind `post` for subscriptions on `all` (the `highlights` level skips them), grouped
  by channel within an hour, and a reply to a viewer's comment on a post uses the existing `reply` kind.

### 4. Stats

`post_stats_daily` (`post_id`, `day`, `opens`, `share_clicks`): opens with 43's per-day HyperLogLog pattern, share clicks from
the post card's click beacon; likes, replies and votes are read from their own tables. Only members with `read PostStats`
see any of it, and nothing is on the public post resource.

### 5. Viewer threads on a video

- Table `video_threads` (`id`, `video_id`, `author_id`, `anchor_ms`, `title` up to 100, `body` up to 1000, `pinned_at` (the `pin` action on `Thread`, up to 3 per video),
  `created_at`). A thread is a discussion about one moment: replies are comments with `target_type = 'thread'` (section 1).
  Creating one goes through 113's gate as a comment on the video (comments off, hold, blocked words, slow mode, shadow bans, bans
  and the account-age rules all apply; a held thread is invisible to others), at most 5 open threads per viewer per video, the
  anchor inside the video's duration.
- `GET /v1/videos/:id/threads` returns the visible threads for the watch page and the player. A thread shows as a **marker on
  the seek bar** once it has at least 2 replies from at least 2 viewers, or when the creator pins it; markers within 1 percent
  of the duration merge into one with a count, and at most 20 are drawn. Replies from shadow-banned or banned users do not count toward the marker threshold, and a banned user's post like or vote is refused with 113's `COMMENTS_BANNED`. Moderators remove a thread (silent or visible, with a reason) the way
  they remove a comment, and its replies go with it.
- Watch page: the discussion area ([59](59-video-watch-page-responsive-layout-enhancements.md)) gains `Tabs` Comments and
  Threads; a thread opens in a panel, and "Start a thread at 3:21" is an action in the engagement menu and the comment
  composer, taking the playhead. The player ([57](57-production-video-player-hls-streaming-controls.md)) draws the markers
  through its marker slot; hovering shows the title and the reply count, activating seeks to the anchor and opens the thread.

### 6. Studio and web

- Studio `/posts`: a `DataTable` of posts (draft, scheduled, published) with filters, a composer in a `Dialog`, `Drawer` or
  page on compact (kind `Tabs`; text with a counter; an image drop zone with alt-text fields and reorder; the poll and quiz
  editors; a video or playlist `Command` picker with a start time through `TimelineRangeEditor`; a schedule field on the new
  `DateTimePicker`), the edit history list (116's `RevisionList`), a stats `Sheet` and pin and delete. Threads and post replies
  appear in 103's and 113's inbox with a target chip.
- Web: the channel's Posts tab (a column of `PostCard`s, pinned first), `/post/$id` with the replies thread over 42's
  `CommentThread`, the Community feed on the Subscriptions page as a second tab, and "Create post" for members linking to the
  studio. Everything server-rendered, with images through the pipeline's variants.
- New kit parts, specified under `docs/design/` and built here: `PostCard` (compound, web kit: header, body, media, poll and
  quiz, share card, actions), `PollView` (over `Progress`, with the revealed-after-vote states), `PostComposer` (studio kit),
  `DateTimePicker` (primitive), `ThreadPanel` and `TimelineMarkerLayer` (web kit; the layer shares the `PlayerCardLayer`
  positioning rules of 116). The rest is `DataTable`, `Dialog`, `Drawer`, `Tabs`, `Command`, `Textarea`, `Field`, `Select`,
  `Switch`, `Callout`, `Toast`, `Badge`, `Avatar`, `Progress`, `Sheet` and `EmptyState` from [95](95-design-system-2.md).

## Delivery

One stack of three slices:

1. Commentable comments and posts: the migration and `CommentTarget`, the posts model, the text, images and share kinds,
   reactions, the feed and notifications, the permission rules and the `post-image` kind.
2. Polls and quizzes, drafts, schedules, edit history, pinning, stats, the studio `/posts` page and its inbox integration.
3. Web: the Posts tab, post page and Community feed, then viewer threads with their markers and the discussion tabs.

## Acceptance criteria

- [ ] Switching account or channel ([123](123-multiple-accounts-and-channels.md)) shows only the new identity's posting identity and drafts, with no stale cache.
- [ ] After the migration every existing video comment, its replies, pins, hearts and reports behave as before (42's and 103's
      suites pass unchanged against the generalised table), and deleting a video, a post or a thread removes its comments.
- [ ] A creator publishes a text post, a post with images, a poll, a quiz and a post sharing a video at a timestamp; the
      shared card opens the video at that second; a shared video made private shows "Unavailable".
- [ ] A viewer votes once; a second vote is a 409; results appear after voting and after close; a quiz reveals its answer;
      the creator sees the breakdown and the correct share; a poll's options cannot change after the first vote.
- [ ] A scheduled post publishes once at its time even if the scheduler runs twice, and notifies subscribers on `all`, not on
      `highlights`; the post appears in the Community feed of subscribers.
- [ ] Editing a post shows "edited" publicly and its history to members, who can restore; the fourth pin is refused.
- [ ] Replies on a post and on a thread follow 113: held, blocked-word, slow-mode, shadow-ban, ban and comments-off rules apply, a silently moderated reply never reaches counts, notifications or events,
      a moderator removes and hides, an editor cannot moderate; `privilege-escalation.test.ts` gains the rows.
- [ ] A viewer starts a thread at a timestamp; it becomes a marker after two replies from two viewers (or a pin), nearby
      markers merge, and activating a marker seeks the player and opens the thread.
- [ ] Only members with the analytics ability read post stats; nothing of them is in a public response.
- [ ] A post renders with no request to another origin, and links carry `rel="nofollow noopener ugc"`.
- [ ] The pieces meet the polish bar ([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `pnpm gen:contracts`
      (no diff) green, with output in the PR.

## Out of scope

- Memberships, paid or members-only posts, and tips of any kind.
- Link previews, embeds of other sites, GIF or sticker pickers, and mentions.
- Posts by viewers, a viewer feed of posts from non-subscribed channels, and algorithmic ranking of the Community feed.
- Any classification of posts or replies (spam, sentiment, emotion).

## Testing plan

- The migration: a spec seeding video comments before and after, and the existing 42, 103 and 113 route suites as the
  regression.
- Domain: `it.each` tables over every payload kind's validation, the poll and quiz rules, schedule and limit rules, and the
  thread marker merge function.
- Repositories: the shared contract suite over postgres and in-memory for posts, votes, threads and the generalised comments.
- Routes: contract tests per endpoint, the 403 matrix over roles, the vote conflict, scheduler idempotency.
- Web and studio: `renderRoute` specs for the composer kinds, `PostCard` states, voting, the feed and thread markers (a fake
  player clock).
- E2E: publish a poll in the studio app, vote as a subscriber in web; start a thread and watch its marker appear.

## Open questions

- Decided: comments are generalised onto a `CommentTarget` with one table, because 103 and 113 are built on the comment row
  and two copies of the model would need two copies of their rules; reactions are not generalised, because the video
  counters are the platform's hottest path and posts only need likes.
- Decided: a thread is its own row with a title and anchor and its replies are comments, so threads reuse sorting, pinning,
  moderation and notifications without a second reply model.
- Decided: a thread becomes a marker only after two replies from two people (or a creator pin), so one account cannot cover a
  seek bar.
- Decided: quoting a video with a timestamp is a `video_share` with `startMs`, not a separate repost kind, so there is one
  card; typed relations between content ([122](122-linked-content-graph.md)) are a different, creator-curated layer.
- Decided: posts are likes only and polls are final, to keep the counters and the results unambiguous.
- Decided: the tab is `posts` with the default title "Posts", the Community tab 104 refers to.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] SDD §5, §6.1 and §6.2 updated; the OpenAPI document regenerated.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
