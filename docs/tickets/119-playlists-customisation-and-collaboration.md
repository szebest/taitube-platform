# 119: Playlists and lists - collaboration, segments, sections, smart playlists, watch lists, import and export

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | XL (one stack of three slices, see *Delivery*) |
| Blocked by | 46 - Playlists and watch history · 57 - Production video player · 59 - Modern video watch page · 73 - Playlist and history library · 95 - Design system 2 · 98 - Realtime user event stream · 99 - Notifications · 104 - Channel page data · 105 - Clips · 115 - Channel identity · 116 - Video management power tools |
| Blocks | 121, 122 |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §5 Domain model & DDL](../SDD.md#5-domain-model--database-schema) · [SDD ADR-24 Result-typed errors](../SDD.md#adr-24--result-typed-error-handling-domain-returns-the-edge-decides) |

**Status:** blocked

> **Why.** [46](46-youtube-playlists-watch-history-engine.md)'s playlist is one owner's ordered list of videos, and
> [73](73-frontend-youtube-playlists-library-player-queue.md) lists collaborative playlists as out of scope. A study group
> cannot build a list together, a list cannot say why a video is in it or play only the part that matters, "videos from these
> channels I have not watched" must be rebuilt by hand, and Watch later is the only list that behaves like a queue.

> **Builds on, does not redo.** Playlists, `playlist_items`, sparse positions, `PUT /v1/playlists/:id/reorder`, visibility
> (`public`, `unlisted`, `private`), Watch Later and `watch_history` are 46's; the manager UI, inline edit, drag reorder, Save
> to playlist and the queue are 73's; the range-held player is [105](105-clips.md)'s; share links, their tokens, expiry and the
> `TimelineRangeEditor` are [116](116-video-management-power-tools.md)'s; the cover image pipeline is
> [115](115-channel-page-customisation.md)'s (this ticket adds the `playlist-cover` kind); the public playlists endpoint is
> [104](104-channel-page-data.md)'s. Series are 115's playlist kind. The channel audit log is 117's and is for channels: a
> playlist belongs to a user, so it keeps its own activity log here.

## What to build

### 1. Collaboration

- `playlist_collaborators` (`playlist_id`, `user_id`, `role` `editor | contributor`, `added_by`, `created_at`; up to 20 per
  playlist). **Editor**: add, remove, reorder, annotate, sectionise, edit title and description. **Contributor**: add videos,
  and remove or annotate only their own. **Owner**: everything, plus visibility, collaborators, rules, delete.
- Invites by user (`POST /v1/playlists/:id/collaborators { handle, role }`, the invitee is notified through
  [99](99-notifications.md) with a new kind `playlist_invite`, and accepts or declines) and by link: `playlist_invites`
  (`id`, `playlist_id`, `role`, `token`, `expires_at` (default 7 days, up to 30), `max_uses` (1 to 20, or unlimited), `use_count`,
  `revoked_at`) using 116's token generator and expiry check, accepted with `POST /v1/playlist-invites/:token/accept`.
  Leaving is `DELETE .../collaborators/me`.
- `playlist_items.added_by` records who added each item and every item shows its adder's avatar in a collaborative list.
  An item the reader cannot watch is filtered out of the read as 46 already does.
- Table `playlist_activity` (`id`, `playlist_id`, `actor_user_id`, `action` (a literal union in `@vp/domain`: `item_added`,
  `item_removed`, `items_reordered`, `note_edited`, `section_added`, `collaborator_added`, `collaborator_removed`,
  `role_changed`, `settings_changed`, `auto_removed`, `restored`), `target` jsonb, `created_at`); a reorder by the same actor
  within 5 minutes is one row; rows older than 180 days are purged by housekeeping. `GET /v1/playlists/:id/activity` is
  keyset-paged and visible to the owner and collaborators. The owner can restore an `auto_removed` or `item_removed` item
  from the log.
- Changes by a collaborator emit `playlist.updated` on 98's stream to the other collaborators, so an open list updates, and
  a grouped 99 notification (`playlist_update`, grouped by playlist) tells the owner.
- Authorization stays in `@vp/permissions` (Rule 8): actions on `Playlist` (`addItem`, `removeItem` with an `addedBy`
  condition for contributors, `manageItems`, `manageCollaborators`, `update`, `delete`), with the caller's role resolved by
  the repository onto the resource, never hand-checked.

### 2. Item notes, segments and sections

- On `playlist_items`: `note` (up to 300 characters), `start_ms` and `end_ms` (nullable; at least 1 second apart, inside the
  video's duration at save and clamped at read if the video is replaced). The queue plays the segment through 105's range-held
  player and advances at `end_ms`; the item shows its range and note.
- A section (divider) is a row with `kind = 'section'`, a `title` up to 80 characters and no video (`video_id` becomes
  nullable with a check, unique `(playlist_id, video_id)` unchanged for videos), in the same sparse ordering as items. Sections
  are not counted in the item count, the queue skips them, and the UI folds a section's items.

### 3. Smart playlists

- `playlists.rules` (nullable jsonb). A playlist with rules is smart: it has no stored items and its contents are computed on
  read, server-side, over the public feed's scope. `PlaylistRulesSchema` is a Zod schema in `@vp/api-contracts` (121 reuses it
  as a section source): `{ match: 'all' | 'any', conditions (up to 8), sort, limit (up to 200) }`, a condition being a tagged
  union on `field`: `channel` (up to 20 channels), `tag` (up to 5), `category`, `duration` (`under`, `over`, `between`, in
  seconds), `format` (`long` or `short`, [102](102-shorts.md)), `newer_than` (days) and `unwatched`.
- One query is built from the rules with the repository's `drizzleWhere` scope (the pushdown pattern of
  [108](108-end-to-end-single-source-abac-sql-pushdown-and-field-filtering.md)), keyset-paged on the sort key. `unwatched` joins
  the viewer's `watch_history` (below 92 percent counts as unwatched); for a guest it matches everything. The viewer-independent
  part is cached for 60 seconds.
- `POST /v1/playlists/:id/freeze` writes the current result (up to 200) as a new normal private playlist and keeps the smart
  one. Rules are the owner's to edit; a smart playlist accepts no manual items.

### 4. Watch lists

- Any playlist the owner has alone (no collaborators) may set `auto_remove_watched`: when 46's history flush marks a video
  watched (92 percent), it is removed from those lists in the same transaction, with an `auto_removed` activity row so it can
  be restored. The `pin` action on `Playlist` (owner only, up to 5 per user, `pinned_at`, [113](113-channel-comment-moderation.md)'s convention) puts lists in 73's library as their own shelves, which is how "To watch this
  weekend" sits beside Watch later. Watch Later keeps its system rules (46) and may set `auto_remove_watched` too.
- **Sorting**: `GET /v1/playlists/:id/items?sort=manual|added|duration|channel|unwatched_first`, keyset on the sort key, for any
  reader; `POST /v1/playlists/:id/sort` writes a sort back as positions for owner and editors.

### 5. Moving, merging, importing, exporting

- `POST /v1/playlists/:id/items/transfer { itemIds (up to 100), to, mode: 'move' | 'copy' }`, `POST /v1/playlists/:id/duplicate`
  and `POST /v1/playlists/merge { sourceIds (up to 5), into | newTitle, deleteSources }`. Each item is checked against the
  rules for removing from the source and adding to the target; duplicates in the target are skipped; the response lists
  `{ itemId, ok, code? }`, so one refusal never fails the batch.
- `GET /v1/playlists/:id/export?format=json|csv` returns `videoId`, URL, title, channel, note, start and end. `POST
  /v1/playlists/:id/import { format: 'json' | 'csv' | 'urls', content }` takes up to 500 lines and 1 MB, resolves each line to a
  video by id or by this platform's own watch URL, and reports each line `added`, `duplicate`, `not_found` or `unrecognised`.
  A foreign URL is reported and never fetched (local-first). CSV is parsed with the maintained parser at its current major
  (`npm view <pkg> version`), JSON through Zod.

### 6. Following, forking, covers, links, stats

- `playlist_follows` (`user_id`, `playlist_id`, `created_at`): a followed playlist is a live reference shown in the library; if
  its source turns private it stops resolving and shows "no longer available". `POST /v1/playlists/:id/fork` copies the items,
  notes, segments and sections into a new private playlist owned by the caller, with `forked_from_playlist_id` shown as
  attribution. Both need a playlist the caller can read.
- **Cover**: `cover_mode` (`auto`, `item`, `custom`), with `cover_video_id` for `item` and 46's `custom_thumbnail_key` for
  `custom`, uploaded through 115's pipeline (kind `playlist-cover`). `auto` draws a mosaic of the first four items'
  thumbnails at render, nothing stored.
- **Visibility**: 46's three values stay (`unlisted` still means anyone with the id). 116's `share_links` gain `target_type =
  'playlist'`: a link grants read of a private playlist until it expires or is revoked, with its opens counted, and the
  playlist's settings offer the same expiry presets as a video's.
- **Stats for the owner**: `GET /v1/me/playlists/:id/stats?range=7d|30d|90d` returns page opens, plays started from the playlist
  (the watch page's `list` parameter on the beacon, 73), follows, forks and the five most played items, from
  `playlist_stats_daily` and `playlist_plays_daily`, fed through 43's buffer and flush. A rule `read PlaylistStats` is the
  owner's only.

### 7. Web

All of it on web's `/playlist/$id`, the library and the queue ([73](73-frontend-youtube-playlists-library-player-queue.md)):
rows on the `SortableList` with notes, segment chips and section dividers; a Collaborators `Dialog` with role `Select`, user
`Command` and an invite link with expiry; the Activity list in a `Drawer`; the smart-rule builder as a form of condition rows
(`Select`, 113's `TagInput`, `Slider`); the Import `Dialog` with the per-line result; bulk selection with Move, Copy and Merge;
the sort `DropdownMenu`; follow and fork `Button`s; the stats in a `Sheet` for the owner. New kit parts, specified under
`docs/design/` and built here: `PlaylistCover` (mosaic and cover), `CollaboratorList`, `ActivityList`, `SmartRuleBuilder`,
`PlaylistItemRow` with note and segment, and `TimelineRangeEditor` moving from the studio's kit to `@vp/components` because
web now renders it. Everything else is 95's primitives and states.

## Delivery

One stack of three slices:

1. The model and engine: collaborators, invites, attribution, activity, notes, segments, sections, sorting, transfer,
   merge, duplicate, import and export, the permission rules, events and notification kinds.
2. Smart playlists and freeze, watch-list options, follow and fork, covers, share links on playlists, stats.
3. Web: the playlist page, library, queue segments and every dialog above.

## Acceptance criteria

- [ ] A user invites a collaborator by handle and another by link; both join with their role; a contributor can add and remove
      only their own items and gets a 403 on others; an expired, revoked or exhausted link cannot be used.
- [ ] Every item shows who added it; the activity log lists each change once, coalesces a reorder, and the owner restores a
      removed item from it.
- [ ] A segment plays only its range and advances at its end; an item with a note and a section divider render and fold;
      the queue skips dividers.
- [ ] A smart playlist ("channel A or B, under 10 minutes, unwatched, newer than 30 days") returns the right items for two
      viewers with different histories from one query; freezing it creates a normal playlist; a manual add is refused.
- [ ] `auto_remove_watched` removes a video once it is watched and logs it; the option is refused on a playlist with
      collaborators.
- [ ] Move, copy and merge skip duplicates and report per item; export then import round-trips a playlist; an unrecognised
      URL is reported and nothing is fetched from it.
- [ ] A followed playlist tracks its source and disappears when it turns private; a fork is independent and credits its source.
- [ ] A share link opens a private playlist until it expires; only the owner reads stats.
- [ ] `privilege-escalation.test.ts` gains the collaborator, link and stats rows.
- [ ] The pieces meet the polish bar ([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `pnpm gen:contracts`
      (no diff) green, with output in the PR.

## Out of scope

- Public collaboration on a public playlist for anyone (suggestions queue) and comments on playlists.
- Recommendations added to a playlist, and a smart condition that uses a model.
- Importing from another service by fetching its URL.

## Testing plan

- Domain: `it.each` tables over the collaborator rules matrix, the rules schema, segment bounds and the rule-to-query mapping
  (one table of conditions against expected predicates).
- Repositories: the shared contract suite over postgres and in-memory, including positions with sections and transfer.
- Routes: contract tests per endpoint, the 403 matrix over owner, editor, contributor and stranger, partial results, import
  line results.
- Web: `renderRoute` specs for collaborators, segments in the queue, the rule builder and import.
- E2E: two accounts build a playlist together; a smart list evaluated for each.

## Open questions

- Decided: collaboration is per playlist with two roles, separate from channel teams (117), because playlists belong to users.
- Decided: a smart playlist stores rules and no items, and freezing creates a new playlist, so the live list never changes
  under someone who froze it.
- Decided: "multiple watch lists" are ordinary private playlists with `auto_remove_watched` and a pin, not a new type.
- Decided: `auto_remove_watched` is off for lists with collaborators, because "watched" is one viewer's fact.
- Decided: unlisted keeps its 46 meaning and expiring access is a share link, so no existing URL changes behaviour.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] SDD §5, §6.1 and §6.2 updated; the OpenAPI document regenerated.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
