# 116: Video management power tools - bulk edit, history, replace file, corrections, share links, passwords, tests, chapters, trim and clip suggestions

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | XL (one stack of three slices, see *Delivery*) |
| Blocked by | 05 - Single PUT upload · 11 - Multipart upload · 12 - Ladder flows · 16 - Retries, DLQ and re-process generations · 17 - Housekeeping · 43 - Views buffer and creator analytics · 44 - Creator studio video management · 57 - Production video player · 59 - Modern video watch page · 60 - Creator studio dashboard · 65 - Playback telemetry · 95 - Design system 2 · 105 - Clips · 111 - Captions and transcripts · 113 - Channel comment moderation · 117 - Channel team roles |
| Blocks | 119, 120, 121, 122 |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §3.2 Processing pipeline](../SDD.md#32-processing-pipeline-fan-out--fan-in) · [SDD §11 Security](../SDD.md#11-security) · [SDD ADR-24 Result-typed errors](../SDD.md#adr-24--result-typed-error-handling-domain-returns-the-edge-decides) |

**Status:** blocked

> **Why.** [44](44-creator-studio-video-management-visibility.md) edits one video at a time with no way back, a mistake in
> a published video means a new upload and a lost URL, comments and history, a private link cannot expire, nothing tells a
> creator which of two thumbnails actually holds viewers, and chapters exist only as timestamps typed into the description
> ([59](59-video-watch-page-responsive-layout-enhancements.md)).

> **Builds on, does not redo.** Single edits, visibility, takedown and `version` conflicts are 44's; the library table, its
> row selection and its metadata editor are [60](60-creator-studio-dashboard-video-management-ui.md)'s (this ticket moves
> 60's batch visibility onto the one bulk endpoint below); generations and re-processing are
> [16](16-retries-dlq-admin-replay-reprocess.md)'s and [12](12-ladder-flows-fanout-fanin.md)'s; clips are
> [105](105-clips.md)'s; the transcript is [111](111-captions-and-transcripts.md)'s; views and watch time buffering is
> [43](43-high-scale-video-views-buffer-reconciler.md)'s and the beacon [65](65-first-party-video-playback-telemetry-analytics-beacon.md)'s;
> comments on or off is [113](113-channel-comment-moderation.md)'s column. Webhooks for creators are
> [77](77-platform-integrations-oembed-embed-player-webhooks.md)'s and [118](118-creator-data-portability-and-api.md) composes with them.

## What to build

### 1. One revisions model

Table `entity_revisions` (`id`, `entity_type` a literal union in `@vp/domain` (`video_metadata`, and 121's
`channel_layout`), `entity_id`, `version`, `snapshot` jsonb, `author_user_id`, `note`, `created_at`; unique
`(entity_type, entity_id, version)`; the last 50 per entity kept by housekeeping). A generic repository interface in
`@vp/core/repositories` with postgres and in-memory implementations: `append`, `list` (keyset), `get`. Restoring writes a
new revision from an old snapshot, so history is never rewritten. Other tickets add an entity type and a snapshot schema,
nothing else.

### 2. Bulk edit and metadata history

- `POST /v1/creator/videos/bulk`: `{ ids (up to 100), patch: { visibility?, categoryId?, addTags?, removeTags?, commentsEnabled? } }`.
  Each id goes through 44's update service and rule (`update` on that `Video`, a CAS on its `version`), so one refusal never
  fails the batch; the response is `[{ id, ok, code? }]`. 60's batch visibility moves onto it.
- Every successful update (single or bulk) appends a `video_metadata` revision in the same transaction, the snapshot being
  title, description, tags, category, visibility, thumbnail selection, chapters and `commentsEnabled`. `GET
  /v1/creator/videos/:id/revisions` and `POST .../revisions/:revisionId/restore` (a normal 44 update under the current
  `version`, so a conflict is a 409) list and revert; the audit log of [117](117-channel-team-roles.md) records both.

### 3. Chapters

- Table `video_chapters` (`video_id`, `position`, `start_ms`, `title` up to 60): at least three, the first at 0, at least 10
  seconds apart. The video resource gains `chapters`; 59's description-timestamp parser stays as the fallback when a video has
  none stored. A `PUT /v1/videos/:id/chapters` replaces the set under 44's `version`.
- **Auto-chapters from the transcript**: `GET /v1/creator/videos/:id/chapter-suggestions` runs a pure function over 111's
  `video_transcript_cues`: it cuts the transcript into windows of about 30 seconds, builds a term-frequency vector per window
  (lowercased words minus a stop list for the track's language, English first, and without a list the function uses pauses
  only), and places a boundary where the cosine similarity of adjacent windows falls below a threshold and at least 90
  seconds have passed since the last one, favouring silences of 2.5 seconds or more; a title is the three highest-weighted
  terms of the chapter. It returns at most 12 suggestions and saves nothing; there is no model and nothing leaves the machine.
- Studio: a chapters editor in 60's editor (rows with a time field, a "use the playhead" button, a title field, reorder is
  automatic by time) with a "Suggest from transcript" button that fills the rows for editing.

### 4. Corrections shown in the player

- Table `video_corrections` (`id`, `video_id`, `start_ms`, `end_ms` (2 to 30 seconds), `text` up to 200, `created_at`; at
  most 10 per video). A correction is a card laid over the player while the playhead is inside its range, and the list is
  repeated under the description ("Corrections") so it survives a skipped moment. Endpoints under `/v1/videos/:id/corrections`;
  `GET` is public for a video the caller can watch, writes need `update` on the video.
- Web builds one `PlayerCardLayer` for the player ([57](57-production-video-player-hls-streaming-controls.md)): timed cards
  anchored to a corner of the stage, keyboard-dismissible, shown at most one at a time, respecting reduced motion and
  never covering the control bar. [122](122-linked-content-graph.md) reuses it for link cards.
- Studio: a corrections list in the editor with a range on the `Slider` over the sprite frames, as 105's clip dialog does.

### 5. Share links and passwords

- Table `share_links` (`id`, `target_type` (`video`; 119 adds `playlist`), `target_id`, `token` (22 random URL-safe
  characters), `label` up to 60, `expires_at` (nullable; presets 1 hour, 24 hours, 7 days, 30 days, never), `created_by`,
  `revoked_at`, `created_at`; up to 50 active per target). A link opens `/watch/$id?s=token`; a `@vp/permissions` rule
  grants `read` on a private or unlisted video when the token is live and matches the target, and nothing else (no comments
  write, no stats). An expired or revoked link answers `410 SHARE_LINK_EXPIRED` and the page says so.
- **Per-link analytics**: opens (distinct viewers per day through 43's per-day HyperLogLog pattern), views and watch seconds,
  the link id carried by the beacon as one more component of 43's buffer field and flushed in the same batch into
  `share_link_stats` (`link_id`, `day`, `opens`, `views`, `watch_seconds`).
- **Password**: `videos.access_password_hash` (`scrypt` from `node:crypto` with a per-video salt, no new dependency),
  allowed only on an unlisted video. `POST /v1/videos/:id/unlock { password }` sets a signed, `HttpOnly`, `SameSite=Lax`
  cookie for that video for 12 hours (signed with a secret from `env-schema`, no default) and is limited to 5 attempts a
  minute per client and video. The watch page, the embed ([77](77-platform-integrations-oembed-embed-player-webhooks.md)) and the
  playback information show a gate until the cookie or a valid share link is present.
- Both are access gates on the page, the player and the API, not encryption: segments sit in the public bucket under
  unguessable keys, exactly as for unlisted videos (SDD §3.3), and the studio says so in a `Callout` next to the toggle.
- Studio: a Sharing panel in the editor (create link with expiry and label, copy, revoke, per-link numbers in a `Table`; a
  password `Switch` and `Field`).

### 6. Title and thumbnail tests

- Table `video_experiments` (`id`, `video_id`, `kind` `title | thumbnail | both`, `variants` jsonb (2 or 3, each a title and
  or a thumbnail source from 44's selection), `status` `running | finished | stopped`, `started_at`, `winner_variant_id`) and
  per-day counters `video_experiment_stats` (`experiment_id`, `variant_id`, `day`, `impressions`, `starts`, `watch_seconds`).
  One running experiment per video, five per channel.
- A viewer's variant is `hash(experiment id, session key) mod variants`, where the session key is 65's ephemeral session id
  (no cookie, no identifier); a pure function in `@vp/domain`. Feed, search, related and watch responses pass through one
  `applyExperiments` step after their caches, over one batched lookup of the running experiments for the ids on the page.
  oEmbed, OpenGraph and the sitemap always carry the control (variant A), so a link preview never changes.
- Impressions (a card with the variant rendered in view), starts and watch seconds arrive on 65's beacon and are buffered like
  views. The result shown is **watch seconds per impression** beside click-through and average view duration, per variant,
  and "not enough data" until each variant has 1000 impressions. The creator chooses the winner ("Apply" writes it through
  44's update and finishes the test); nothing is applied automatically.

### 7. Replace the file, trim and blur

- **Replace**: `POST /v1/videos/:id/replacement` returns an upload (05's presigned PUT, or 11's multipart) into a new
  generation; completing it runs 12's pipeline as a re-process ([16](16-retries-dlq-admin-replay-reprocess.md)) while the
  video stays `READY` and serves the current generation's master. When the new ladder is complete one CAS swaps the active
  generation, bumps `version` and appends `video.replaced`; the old renditions are purged after 24 hours so players holding
  the old playlist finish. A failure leaves the old video untouched and tells the creator through 98's stream. The URL, views,
  likes, comments and subscribers stay. Retention is recorded per generation (the current curve is shown); chapters,
  corrections and captions are flagged `needs_review` when the duration changes by more than 2 seconds, and 111 re-runs
  captions. Allowed on a `READY` video with no replacement in progress; any screening [112](112-upload-screening.md) adds
  applies to the new generation before the swap.
- **Trim and blur**: table `video_edits` (`video_id`, `base_generation`, `trim` (`start_ms`, `end_ms`) nullable, `blurs`
  jsonb up to 20 of `{ start_ms, end_ms, shape (rect, ellipse), x, y, w, h (0 to 1), strength }`, `status`). Saving an edit
  enqueues an `apply-edits` job that renders a new generation from the **base generation's** top rendition (the raw source has expired by then, so this is one re-encode), a filter graph
  built by a pure argv builder in `@vp/ffmpeg` (`trim`, and `boxblur` limited by `enable='between(t,...)'` over a cropped
  region), then the same swap as above. Chapters, corrections and transcript cues are shifted or cut by one pure
  `shiftTimeline` function. Reverting the edits swaps back to the base generation. The base generation is kept for 14 days
  after the last edit and then purged, after which the edit list is baked into the current generation and further edits
  apply to it, which the studio says before the first save. Studio: an editor with the player, a range on the `Slider` for
  trim, rectangles drawn over the stage for blurs, and a before and after preview that plays the filter-free base.
- Roles: `update` on the video, the editor row of 117's matrix; deleting stays owner and manager.

### 8. Clip suggestions

`GET /v1/creator/videos/:id/clip-suggestions`: a pure function over 65's retention curve and the duration returns up to
three non-overlapping windows of 15 to 45 seconds where viewers were lost least relative to their neighbours (the flattest
stretches, the moments people stayed for), each with the share lost and, when chapters exist, the chapter's title. The
studio's analytics page and the editor list them with a preview loop and a "Create clip" button that calls 105's
`POST /v1/videos/:id/clips` as the creator, so clips follow 105's rules and storage and nothing new is stored.

### 9. Studio

The library table's selection gets a bulk bar over the bulk endpoint (a `Dialog` per field, a result `Toast` listing failures);
the editor gains tabs (`Tabs`): Details, Chapters, Corrections, Sharing, Tests, Edit video, History (the revisions list with a
diff of changed fields and Restore). New kit parts, specified under `docs/design/` and built here: `PlayerCardLayer` (web
kit), `TimelineRangeEditor` (studio kit; a range plus markers over sprite frames, used by corrections, trim, blur and chapters),
`RevisionList` (shared; 121 reuses it), `ExperimentResultCard` (studio kit, over `StatCard` and `Table`). The bulk bar is 113's `BulkActionBar`. The rest is `Dialog`, `Tabs`, `Table`, `DataTable`, `Switch`, `Field`, `Select`, `Slider`,
`Callout`, `Toast`, `Progress` and `EmptyState` from [95](95-design-system-2.md).

## Delivery

One stack of three slices:

1. Revisions and metadata: the revisions model, bulk edit, history and restore, chapters and suggestions, corrections and
   the player card layer, with their studio tabs.
2. Access and tests: share links with analytics, passwords, experiments and their results, with the Sharing and Tests tabs.
3. Pipeline: replacement, trim and blur with the `apply-edits` job, clip suggestions and the Edit video tab.

## Acceptance criteria

- [ ] Bulk edit changes visibility, category, tags and comments on 30 videos; one unauthorised id fails alone and is
      reported; each change is in that video's history and can be restored, and a stale restore is a 409.
- [ ] Chapters saved in the editor show on the seek bar and replace the description's timestamps; suggestions from a fixture
      transcript are deterministic and respect the 90-second rule; nothing is saved by suggesting.
- [ ] A correction card appears only inside its range, is dismissible by keyboard, never covers the controls, and is also
      listed under the description.
- [ ] A share link opens a private video, stops at its expiry with 410, counts opens, views and watch seconds per link, and
      revoking it works at once; the link grants nothing beyond watching.
- [ ] A password-protected video shows a gate on the page and the embed, a wrong password is counted and limited, and the
      12-hour cookie lifts the gate; the password is never in a response or a log.
- [ ] A two-variant test serves each session one variant consistently, leaves oEmbed and OpenGraph on the control, reports
      watch seconds per impression, click-through and view duration per variant, and says "not enough data" under 1000
      impressions; the winner is applied only by the creator.
- [ ] Replacing a video keeps its URL, views, likes and comments, serves the old renditions until the new ladder is
      complete, swaps once even if the job retries, and a failed replacement changes nothing.
- [ ] A trim and a blur render into a new generation with the blur on the right frames and the chapters shifted; reverting
      swaps back to the base generation within the 14 days.
- [ ] Clip suggestions return windows inside the video and creating one yields a normal 105 clip.
- [ ] An editor (117) may do all of this except delete; a moderator gets a 403; `privilege-escalation.test.ts` gains the
      rows.
- [ ] The studio tabs and the player cards meet the polish bar ([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `pnpm gen:contracts`
      (no diff) green, with output in the PR.

## Out of scope

- Scheduled publishing (a separate ticket), monetisation of any kind, DRM or encrypted segments, per-viewer ad-hoc access
  lists, and AI of any kind (every suggestion above is arithmetic over data the platform already has).
- A multi-variant statistical engine: the test reports and the creator decides.
- Editing audio, cuts in the middle of a video that join two takes, and a full timeline editor.

## Testing plan

- Domain: `it.each` tables over the chapter rules, the auto-chapter function (fixture transcripts), `shiftTimeline`, variant
  assignment, the retention plateau function and share-link validity.
- Worker: the `apply-edits` argv builder (pure, snapshot-free assertions), job idempotency and the generation CAS swap, the
  replacement flow with a failing job.
- Repositories and routes: the shared contract suites, bulk partial results, revisions restore under `version`, the 403
  matrix, rate limiting, `410` and the unlock cookie.
- Web and studio: `renderRoute` specs for the gate, the card layer, the editor tabs and the bulk bar.
- E2E: replace a video and watch the old one keep playing until the swap; a share link expiring.

## Open questions

- Decided: one `entity_revisions` table for every versioned document, so 121's layouts and this ticket's metadata share one
  shape and one restore flow.
- Decided: a password only on an unlisted video, and both password and links are page and API gates, not encryption, with
  the limit stated in the UI.
- Decided: tests measure watch seconds per impression and the creator decides, because click-through alone rewards
  misleading thumbnails and an auto-applied winner is a ranking decision.
- Decided: the base generation of an edit is kept 14 days, because the raw source expires after 7 days (SDD §3) and
  re-rendering from a finished rendition each time would lose quality on every edit.
- Decided: retention is kept per generation, so a replaced or trimmed video does not blend two different videos' curves.
- Decided: 60's batch visibility moves onto the bulk endpoint, so there is one place that changes many videos.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] SDD §3, §5, §6.1 and §6.2 updated; the OpenAPI document regenerated.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
