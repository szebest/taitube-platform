# 122: Linked content - one typed link graph between videos, Shorts, posts, threads, playlists, clips, live and episodes

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | XL (one stack of three slices, see *Delivery*) |
| Blocked by | 43 - Views buffer and creator analytics · 44 - Creator studio video management · 46 - Playlists and watch history · 57 - Production video player · 59 - Modern video watch page · 65 - Playback telemetry · 76 - Live streaming · 95 - Design system 2 · 99 - Notifications · 102 - Shorts · 105 - Clips · 113 - Channel comment moderation · 115 - Channel identity · 116 - Video management power tools · 117 - Channel team roles · 119 - Playlists and lists · 120 - Community posts and threads · 121 - Channel page builder |
| Blocks | 126 |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §5 Domain model & DDL](../SDD.md#5-domain-model--database-schema) · [SDD ADR-24 Result-typed errors](../SDD.md#adr-24--result-typed-error-handling-domain-returns-the-edge-decides) |

**Status:** blocked

> **Why.** Content on the platform is connected in the creator's head and nowhere else: a Short is cut from a long video, an
> episode follows another, a video answers someone else's, a thread discusses a moment, a correction replaces an error.
> [102](102-shorts.md) specifies no link between a Short and its source, [105](105-clips.md) keeps a clip's source only as
> its own field, [116](116-video-management-power-tools.md)'s correction cards are timed text, and the end of every video
> shows the same related list. This ticket is the one place those relations live.

> **Builds on, does not redo.** A clip's reference to its video (105) is not copied: `clip_of` is read from the `clips` table.
> A series is 115's playlist kind and its "next episode" is 115's field. 116's `PlayerCardLayer` draws timed cards and 120's
> `TimelineMarkerLayer` draws markers; this ticket gives them link content. Posts that share a video at a timestamp are 120's
> `video_share`, a post's own payload; the links here are a separate, creator-curated layer that can point a post at a video
> with a stated relation. Related videos on the watch page remain
> [100](100-home-shelves-related-videos.md)'s and are what an end screen falls back to. Channel tabs are
> [121](121-channel-page-builder.md)'s. Notifications are [99](99-notifications.md)'s; roles and the audit log are
> [117](117-channel-team-roles.md)'s.

## What to build

### 1. The model

**A content reference** is a tagged union on `type` in `@vp/domain`: `video` (a Short is a video whose `format` is `short`,
read from 102 and never stored as a separate type), `clip`, `post`, `thread`, `playlist`, `live` and `episode`
(`{ playlistId, videoId }`, an item of a series). It is stored as `type`, `id` and an auxiliary id for the episode's playlist.

**A relation** is a tagged union on `relation`, each member with its reading, the label its reverse side shows, its allowed
source and target kinds, whether it may cross channels, and any parameters, in one table in `@vp/domain` that the rule, the
API, the studio picker and the labels all read:

| `relation` | Source ... target | Reverse label | Across channels |
|---|---|---|---|
| `full_video` | a Short or clip is cut from the target | "Cut into n Shorts" | no |
| `clip_of` | the clip's video (virtual, from 105) | "n clips" | n/a |
| `part_of` (`part`) | part N of a series or a parent video | "Parts" | no |
| `previous` | the target comes before the source | "Next" | no |
| `follow_up` | the source continues the target | "Follow-up" | no |
| `recap` | a summary of the target | "Recap" | no |
| `extended_cut` | a longer version of the target | "Extended cut" | no |
| `behind_the_scenes` | making of the target | "Behind the scenes" | no |
| `translation` (`locale` from 86's set) | a dub or translation of the target | "Also in Español" | no |
| `corrects` | corrects an error in the target (pairs with 116's correction cards) | "Corrected in ..." | no |
| `response_to` | answers the target | "n responses" | yes |
| `reaction_to` | reacts to the target | "n reactions" | yes |
| `remix_of` | a remix or duet of the target | "n remixes" | yes |
| `discussion` | a post or thread discussing the target | "Discussed in n threads" | yes |
| `related` | symmetric | "Related" | yes |

A new relation is one more member and fails the typecheck wherever the table is not exhaustive (`assertNever`).

**Anchors**: optional `source_start_ms`, `source_end_ms`, `target_start_ms`, `target_end_ms`, so a timestamp links to a
timestamp and a span to a span; only on kinds that have a timeline, end after start, inside the duration at save and clamped
at read if the video is later replaced or trimmed (116).

**Table `content_links`**: `id`, `source_type`, `source_id`, `source_aux_id`, `target_type`, `target_id`, `target_aux_id`,
`relation`, `params` jsonb, the four anchors, `status` (`active`, `pending`, `declined`, `suggested`, `broken`),
`source_channel_id`, `target_channel_id`, `created_by`, `decided_by`, `created_at`; unique `(source, target, relation)`;
indexes `(source_type, source_id, status)`, `(target_type, target_id, status)` and `(target_channel_id, status, created_at)`
for the approval queue. The contract carries `source` and `target` as `ContentRef` unions, never as bare ids.

**Caps**: 20 outgoing links per item, 5000 per channel, inbound counts shown to 99 and then "99+". No self links; `previous`,
`part_of` and `follow_up` chains may not loop (checked to depth 50 at write, a `Result` failure from
`@vp/domain-rules`).

**Direction and visibility**: links are directional and the reverse side reads them as backlinks. A link is listed to a
viewer only when they can see the *other* end, decided by the same visibility scope the feeds use (private, unlisted-by-id,
held and unready content never appears, and never counts in a backlink total), so a private target leaks neither its title
nor its existence. When a target is hard-deleted its inbound links become `broken`; when it turns private they stay `active`
and simply stop resolving for others, and both appear in the creator's fix-up list.

### 2. Who may link what

- A creator links any content of their own channel (and any member with the ability, 117's matrix: owner, manager and editor)
  and it is `active` at once. A relation the table marks "no" for cross-channel is refused across channels
  (`LINK_RELATION_SAME_CHANNEL`).
- **Across channels** the target channel's setting decides, `link_policy` on its settings (default `approve`): `allow` (active
  at once; the target's owner is told and can remove it at any time), `approve` (the link is `pending` and appears in the
  target channel's queue for owner and manager, who approve or decline; the requester is told) or `block` (refused with
  `LINK_TARGET_BLOCKS`). A cross-channel target must be public and ready.
- **Viewers suggest**: a signed-in viewer proposes `source -> target` with a relation and anchors on a public video, which
  stores a `suggested` row and puts it in the source channel's queue; accepting makes it a creator link and then the target's
  policy applies if it crosses channels. One open suggestion per viewer, source, target and relation; 10 a day per viewer;
  a viewer shadow-banned by 113 is dropped without a signal and a banned one gets 113's refusal. A suggestion has no free text.
- Authorization is `@vp/permissions` only (Rule 8): `link` on the source and `approveLink` and `removeInboundLink` on the
  target through the channel conditions of 117, plus `suggest` for any signed-in viewer, through 117's existing rows. The
  rules (allowed pairs, caps, loops, policy, anchors) are pure `Result` functions; codes in `@vp/errors` and SDD §6.2.
- Notifications through 99, new kinds added to its union here: `link_request` (to the target's owner and managers),
  `link_decision` (to the requester), `link_added` (an `allow` link to the target's owner) and `link_suggestion` (to the
  source channel's managers, grouped by day). Every change is a row in 117's audit log.

### 3. Reads, batched

`ContentLinkService.forItems(refs, viewer)` is the only read path: one query over `source` and `target` with `UNION ALL`
for the direction, filtered by the visibility scope, one hydration for every ref found (the same batched hydration the feeds
use), grouped into `outgoing` by relation and `incoming` counts and samples by reverse label; `clip_of` is merged in from
`clips` in the same call. The watch page's read, a page of Shorts and a channel section each make **one call** for all their
items, so a page never issues a query per item, and a query-count test asserts it. The public result is cached per ref for 60
seconds; the viewer's own series progress (from `watch_history`, 115) is a second lookup over the ids already in hand.

### 4. Where links show

- **Shorts**: a chip "Full video at 3:21" over `ShortsPlayerFrame`
  ([docs/design/apps/web/shorts-player-frame.md](../design/apps/web/shorts-player-frame.md)); activating it opens the full
  video at `target_start_ms` carrying `via` (the link id, below). The Shorts feed items carry the chip's data from the
  batched read.
- **Watch page**: a "Connected" panel under the description, grouped by relation in a fixed order, then backlinks as one-line
  rows ("Cut into 3 Shorts", "Discussed in 2 threads", "Corrected in ..."), each opening a `Popover` of the first five; a
  video that is part of a series shows "Continue the series" with the viewer's per-episode progress. A video with a `corrects`
  link pointing at it shows a `Callout` "Corrected in ..." above the player.
- **In the player**: a link with a source range shows as a timed card through 116's `PlayerCardLayer` and a marker through
  120's `TimelineMarkerLayer`; and **end screens**.
- **Elsewhere**: a post or thread shows the content it is linked to inline as a card; a playlist can "Add everything linked
  to X" (a bulk add of the current result) or use `linked_to` as one more member of 119's smart-rule condition union; 121's
  section source union gains `linked` (`{ ref, relations?, direction }`), both one added member each.

### 5. End screens

`video_end_screens` (`video_id`, `layout` `grid` | `row` | `hero`, `starts_at_ms` (at least 5 seconds before the end and at
most 20), `items` jsonb up to **4**, `show_subscribe`). An item is a tagged union on `type`: `content` (a `ContentRef` the
creator may link), `channel_tab` (a channel's tab or custom page from 115 and 121, as `{ channelId, tabId }`), `next_episode`
(filled at read from the series' next episode for this viewer, absent when none) and `subscribe`. Creator-picked; a video with
none falls back to 100's related videos. The web player draws it as an overlay over the stage when the playhead passes
`starts_at_ms`: arrow-key and tab navigable, focus moved in and out of it, `Esc` dismisses, reduced motion respected, and
nothing covers the controls. `PUT /v1/videos/:id/end-screen` replaces it under 44's `version`.

### 6. Suggested links, no model

`GET /v1/creator/content-links/suggestions` computes on demand over the creator's last 200 items from signals the platform
already has, each with a stated reason:

1. a description, post or thread of theirs that contains a watch URL of one of their videos (a `t` parameter becomes the
   target anchor) -> `related`, or `full_video` when the source is a Short;
2. consecutive episodes of a series (115) with no `previous` link -> `previous`;
3. a Short and a long video of the same channel uploaded within 24 hours that share at least two tags -> `full_video`,
   ordered by overlap;
4. a creator's own post sharing a video at a timestamp (120) -> `discussion` with the anchor.

Dismissals are remembered (`content_link_dismissals`). Clips of a video are already connected through 105 and need no
suggestion.

### 7. Per-link analytics

`content_link_stats_daily` (`link_id`, `day`, `impressions`, `clicks`, `watch_seconds`). An impression is a chip, card, row or
end-screen item rendered in view, a click is activating it, and the watch time is what the target's session records after a
click that carried `via=linkId`, all arriving on 65's beacon and buffered with 43's views, as 116 does for share links. The
studio shows impressions, clicks, click-through and watch seconds per link and rolled up by relation; only members with the
analytics ability see them.

### 8. Studio and web

- Studio, over 60's shell: a **Linked content** tab in the video editor (outgoing links as rows with relation `Select`, a target
  `Command` that searches the creator's own content and accepts a public watch URL for others, anchors through 116's
  `TimelineRangeEditor` on both sides, status `Badge`s, and the stats); an **End screen** tab (layout `SegmentedControl`, a
  `SortableList` of up to 4 items, the start time, a live preview); the final step of the upload dialog, "Link this video"
  (pick a source video for a Short, or a series), shown only when a likely target exists; a bulk "Link selected" action in the
  library through 113's `BulkActionBar`; and `/links` with `Tabs` Requests, Suggestions, Fix-ups and All over a `DataTable`,
  each row with approve, decline or fix (replace the target or remove) and its stats. The cross-channel policy is a `Select`
  in `/customization`.
- Web: `LinkChip` (Shorts), `ConnectedPanel` and `BacklinkRow` (watch page), `LinkCard` (content for the card layer, posts and
  threads), `EndScreen` and a viewer's "Suggest a link" `Dialog` in the video menu. All specified under `docs/design/` and
  built here, from [95](95-design-system-2.md)'s `Popover`, `Dialog`, `Callout`, `Badge`, `Button`, `Progress` and the cards
  of web's kit; the studio's new parts are `LinkEditorRow` and `EndScreenEditor`.

## Delivery

One stack of three slices:

1. The model: the union and relation table, `content_links`, the rules and caps, policy, suggestions and approvals,
   notifications and audit, the batched read and the fix-up job, contracts and SDD.
2. Creator tools: the editor tabs, end screen data and editor, the queue and fix-ups page, bulk linking, suggestions, the
   stats pipeline and the studio.
3. Web surfaces: the Shorts chip, Connected panel, timed cards and markers, end screens, inline cards in posts and threads,
   the `linked` and `linked_to` sources and the viewer suggestion dialog.

## Acceptance criteria

- [ ] A creator links a Short to its full video at 3:21; the Short shows "Full video at 3:21", activating it opens the video at
      that second, and the full video lists "Cut into 1 Short" for viewers but never counts a private or unlisted Short.
- [ ] A span-to-span link (source 0:10 to 0:25, target 2:00 to 2:15) shows as a timed card with a timeline marker over exactly
      that span and opens the target at 2:00.
- [ ] A cross-channel response with the target on `approve` is `pending`, notifies the target's managers, is invisible to
      viewers until approved, and an `allow` policy activates it at once while a `block` policy refuses it; the target's owner
      can remove an active inbound link.
- [ ] A relation that must stay in one channel is refused across channels; a loop of `previous` links, a self link, a 21st
      outgoing link and a bad anchor are refused with their codes.
- [ ] A private, unlisted-by-id or held target never appears in a link, a title, a count or a suggestion for anyone who cannot
      see it, in the API and in the cache.
- [ ] Deleting a target marks its inbound links `broken` and lists them in Fix-ups; making it private hides them from viewers
      only; making it public again restores them with no data change.
- [ ] A viewer's suggestion lands in the source channel's queue once, is capped per day, and accepting it applies the target's
      policy; a shadow-banned viewer's suggestion is dropped without a signal.
- [ ] Suggested links show for the four signals with their reasons, are dismissible, and need no model.
- [ ] An end screen with four items (content, a channel tab, next episode, subscribe) shows at its start time in each layout,
      is keyboard-operable and dismissible, and falls back to related videos when unset; "continue the series" shows the
      viewer's own progress.
- [ ] A watch page, a page of Shorts and a channel section each make one batched link read, asserted by a query-count test.
- [ ] Per-link impressions, clicks and watch seconds appear in the studio within one flush interval, for members with the
      analytics ability only.
- [ ] An editor (117) links their channel's content, a moderator gets a 403; `privilege-escalation.test.ts` gains the rows.
- [ ] The pieces meet the polish bar ([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `pnpm gen:contracts`
      (no diff) green, with output in the PR.

## Out of scope

- Any model that guesses relations from content, and a recommendation engine (100's related videos remain the fallback).
- Links to anything outside the platform; every reference is an id of this platform's content.
- Paid or members-only links, and end screens that cover the player's controls.
- Editing another channel's content in any way: a link changes only the linker's own records.

## Testing plan

- Domain: `it.each` tables over the relation matrix (allowed pairs and cross-channel flags), anchors, loops, caps, the policy
  decision and the four suggestion signals.
- Repositories: the shared contract suite over postgres and in-memory for links, dismissals and end screens.
- Routes: contract tests per endpoint, the 403 matrix over roles, visibility leakage cases (private, unlisted, held,
  deleted) with the cache on and off, and the query-count tests.
- Web and studio: `renderRoute` specs for the chip, the panel, the card layer with a fake clock, the end screen's keyboard
  and focus, the queue and the editor.
- E2E: link a Short in the studio app and follow the chip in web; a cross-channel response approved by a second account.

## Open questions

- Decided: 102 specifies no Short-to-video link, so it is not edited; this ticket owns the relation, and 105's clips are read
  as `clip_of` rather than copied.
- Decided: `approve` is the default cross-channel policy, because a creator should never find their video presented as the
  object of someone else's content without having been asked.
- Decided: a link stays valid but invisible when its target goes private, and breaks only when the target is deleted, so a
  temporary privacy change loses nothing.
- Decided: cross-channel links are limited to relations that are about another creator's work (response, reaction, remix,
  discussion, related); everything that claims "this is the same work" must be one channel's own.
- Decided: end screens hold at most 4 items and never cover the controls, and a viewer's "next episode" is the only
  viewer-specific item.
- Decided: Shorts are videos with a format, so a Short needs no separate content kind and 102's feed stays untouched.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] SDD §5, §6.1 and §6.2 updated; the OpenAPI document regenerated.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
