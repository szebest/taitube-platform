# 121: Channel page builder - configurable sections, tabs and custom pages with drafts, scheduling and preview

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | XL (one stack of three slices, see *Delivery*) |
| Blocked by | 17 - Housekeeping · 41 - Channel subscriptions · 58 - Modern browse layout · 72 - Settings and customisation · 76 - Live streaming · 86 - Localisation rollout · 95 - Design system 2 · 96 - Channel featured videos · 102 - Shorts · 104 - Channel page data · 106 - Channel brand colour and themes · 115 - Channel identity · 116 - Video management power tools · 117 - Channel team roles · 119 - Playlists and lists · 120 - Community posts and threads |
| Blocks | 122 |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §11 Security](../SDD.md#11-security) · [SDD ADR-24 Result-typed errors](../SDD.md#adr-24--result-typed-error-handling-domain-returns-the-edge-decides) |

**Status:** blocked

> **Why.** A channel page is the same page for every creator: fixed tabs, a fixed Home, and the Start here shelf
> ([96](96-channel-featured-videos-start-here.md)) as the one thing a creator arranges. A creator who makes a series, a
> shop-talk show and Shorts wants a Home that leads with the right one, a tab per show, a different first impression for
> a newcomer and for a subscriber, and a seasonal page that comes back by itself.

> **Builds on, does not redo.** Identity, the banner and avatar pipeline, the trailer and the per-language description are
> [115](115-channel-page-customisation.md)'s (this ticket adds the `page-image` kind to its `channel-image` job). The
> brand colour and `deriveAccent` are [106](106-channel-branded-and-user-built-themes.md)'s. Smart-playlist rules are
> [119](119-playlists-customisation-and-collaboration.md)'s, posts [120](120-community-posts-and-threads.md)'s, live
> [76](76-live-streaming-rtmp-whip-llhls-packaging-chat.md)'s, Shorts [102](102-shorts.md)'s. The revisions table and the
> restore flow are [116](116-video-management-power-tools.md)'s and are reused, not copied. Who may edit is 117's matrix.

## What to build

### 1. The layout document

One versioned JSON document, `ChannelLayoutSchema`, a Zod schema in `@vp/api-contracts` that is the contract's single
source (the studio form, the API, the resolver and the stored snapshot all parse it). It carries `schemaVersion`, and a
pure `migrateLayout` in `@vp/domain` upgrades older documents on read.

```ts
Layout  = { schemaVersion, landing: { visitor: TabId, subscriber: TabId }, tabs: Tab[] }
Tab     = { id, title, hidden, visibility, ...kind }            // kind is the discriminant
  kind 'home'                                          sections: Section[]
  kind 'videos' | 'shorts' | 'posts' | 'playlists' | 'about'     fixed body
  kind 'custom'   slug, icon?, description?, header?: ImageId, sections: Section[]
Section = { id, ...kind }
  kind 'content'           source, filters, sort, layout, itemCount, seeAll, presentation, visibility, hideWhenEmpty
  kind 'rich_text'         body (limited Markdown), presentation, visibility
  kind 'links'             links (up to 8, the platform icons of 115), presentation, visibility
  kind 'featured_channels' channelIds (up to 12), presentation, visibility
```

Every union has one literal discriminant and an exhaustive `switch` ending in `assertNever`; a new kind is one more member
and fails the typecheck wherever it is unhandled.

**Source** (`type`): `videos` (long videos), `shorts`, `posts`, `live` (streams, live now, upcoming and past),
`playlists` (the channel's public playlists), `playlist` (one, by id; a series is a playlist), `picked` (a hand-picked
mix of videos, Shorts, playlists and posts, in order), `start_here` (96's source, with its popular fallback),
`smart_playlist` (a `PlaylistRules` document from 119, evaluated over the channel's own public content) and
`channels` (a featured-channels list). 122 adds `linked` to this union.

**Filters**: `tags` (up to 5), a date range (absolute, or "the last N days"), `duration` (min, max), `hideWatched`.
**Sort**: `newest`, `popular`, `oldest`, `most_liked`, `manual` (only for `picked` and `playlist`) and `random`.
**Layout**: `shelf`, `grid` (2 to 6 columns), `list`, `hero` (one large item), `masonry` (posts only). **Item count** 1 to
24 (hero 1). **See all**: a tab id (the link resolves to that tab's URL). **Presentation**: `title` and `subtitle`
(each a `LocalizedText`, a default plus any locale of 86's set), an optional `background` image id, an optional `accent`
hex (validated with 97's `ACCENT_PATTERN`, derived through 106's `deriveAccent` and scoped to the section's subtree, below
the viewer's own accent override), `density` (`compact`, `comfortable`) and `show` flags for duration, views and date.
**Visibility**: `audience` (`everyone`, `visitors` (not subscribed, signed in or not), `subscribers`, `signed_in`), an
optional window (`from`, `to`), optional `locales`, and `hideWhenEmpty` on the section. Tabs carry the same `visibility`.

**Caps**: 10 tabs in total, 4 of them custom; 20 sections per tab and 60 per layout; 24 picked items per section; 128 KB per document. A violation is a
`Result` failure from `@vp/domain-rules`, with its own code in `@vp/errors` and SDD §6.2.

**Built-in tabs** can be renamed, reordered and hidden; Home and About cannot be hidden (a channel always has an entry
point and an identity page); Home's body is a section list, the others are fixed grids with the viewer's sort and filter.
A tab that has nothing to show (no Shorts, no posts) is not rendered whatever its setting. **Custom tabs**: `title` (up to
24), a `slug` (3 to 30 of `a-z0-9-`, unique in the channel, never a built-in's slug or a reserved word, stable once
published so its URL does not move), an optional `icon` from 95's icon set, a description of up to 280 characters shown at
the top, and a header image with desktop and mobile crops under 115's safe-area rules. The URL is
`/channels/$handle/$slug`. **Landing**: `landing.visitor` and `landing.subscriber` name the tab a viewer opens first; a
landing tab the viewer may not see falls back to Home.

**Rich text** is Markdown restricted to paragraphs, `h2` and `h3`, bold, italic, lists, line breaks, `https` links and
images that reference the creator's own `page-image` ids with alt text (never a URL), at most 8000 characters and 6
images. It is parsed with the parser 60's description preview uses and validated by walking the tree against a node
whitelist in `@vp/validation`; web renders the tree as elements, never as HTML, every link carries
`rel="nofollow noopener ugc"`, and nothing loads from another origin.

### 2. Storage, drafts, revisions, schedules

- `channel_layout_drafts` (`channel_id` primary key, `doc` jsonb, `version`, `updated_by`, `updated_at`): one draft per
  channel, saved under an optimistic `version` check like 44's edits, so two members cannot overwrite each other silently.
- The published layout is the latest row of 116's `entity_revisions` for `entity_type = 'channel_layout'` (snapshot jsonb,
  the author, a note, the last 50 kept). Publishing appends a revision in one transaction with 117's audit event; restoring
  an older one appends a new revision from its snapshot, so history is never rewritten and the published layout is always
  the newest row.
- `channel_layout_schedules` (`id`, `channel_id`, `doc`, `publish_at`, `status` `pending | applied | cancelled`): promoted by
  a housekeeping scheduler ([17](17-housekeeping-reconciler-purge.md)) with a CAS on `status`, so a retry applies once.
  Seasonal pages are two schedules; the studio's "schedule my return" queues the current published layout for a later date.
- Per-section and per-tab windows need no job: they are evaluated at read.

### 3. Resolution: one batched read, bounded and cached

`GET /v1/channels/:idOrHandle/page?tab=&seed=` returns the layout for the viewer with every visible section's items
resolved. The resolver, in `@vp/core`, takes the layout and an audience (`guest`, `member`, `subscriber`) and:

1. drops tabs and sections the audience may not see and the ones outside their window or locale;
2. groups the remaining sections' sources by type and runs **one query per source type** against the public feed's own
   scope, plus **one hydration query** for every item id collected (channel, counts, thumbnail), never a query per
   section or per item; each query is capped at the sum of its sections' item counts (over-fetched to 48 where `random`
   or `hideWatched` need a pool);
3. applies sort, filters and `hideWatched` in memory (for a signed-in viewer, one `watch_history` lookup over the pool's
   ids; a guest sees everything), picks the `random` order from `seed` so a visit is stable, and drops empty sections
   marked `hideWatched` or `hideWhenEmpty`.

The resolved pool is cached in Redis per `(channel, revision, audience, locale)` with 60 s of freshness and singleflight on a
miss ([42](42-threaded-comments-keyset-pagination-moderation.md)'s pattern); windows, `seed` and the per-viewer steps run after
the cache. A new revision is a new key, so publishing needs no invalidation. A query-count test asserts the bound for a
layout with 20 sections of every source type. The page renders on the server from the same call.

### 4. API

| Endpoint | Who | What |
|---|---|---|
| `GET /v1/channels/:idOrHandle/page` | anyone | the resolved landing tab or `?tab=`, as above |
| `GET` and `PUT /v1/me/channel/page/draft` | members who may edit the page | read, save under `version` |
| `POST /v1/me/channel/page/publish` | same | validates against the live data, appends a revision |
| `POST /v1/me/channel/page/schedule`, `DELETE .../schedule/:id` | same | queue or cancel |
| `GET /v1/me/channel/page/revisions`, `POST .../revisions/:id/restore` | same | 116's history endpoints, over this entity type |
| `GET /v1/me/channel/page/preview?as=visitor\|subscriber&tab=` | same | the draft resolved, `no-store`, never cached |

- Everything in `@vp/api-contracts`, the committed OpenAPI document and SDD §6.1; the owner, manager and editor rows of
  117's matrix through `@vp/permissions` (Rule 8); every save, publish, schedule and restore writes 117's audit log.
- Entity-dependent rules (a picked video exists, is the channel's own and public, a `playlist` source is the channel's, the
  slug is free, `seeAll` points at a real tab, a rule document is valid) are pure `Result`-returning functions in
  `@vp/domain-rules`; a section whose item later turns private drops out on read and stays in the document.

### 5. Studio: the page builder

`/customization/page`, built from 95's kit with the kit's `SortableList` for dragging and keyboard reordering:

- a tab strip (reorder, rename, hide, duplicate, add custom tab, set landing per audience), a section list per tab
  (reorder, duplicate, hide, delete, "Add section" through a `Command` of block kinds), and a `Drawer` per section with its
  fields grouped as Source, Filters, Sort and layout, Presentation, Visibility; a live card preview of the section in the
  drawer;
- the publish bar: Save draft (autosave through the version check), Publish, Schedule (a date and time picker), a `Callout`
  for validation failures that link to the offending section, and the revisions list with Restore (116's list component);
- **Preview as**: a pane that embeds web's own channel page in a sandboxed `iframe` at
  `/channels/$handle?preview=draft&as=visitor|subscriber` at full width or 390 px (a `SegmentedControl`: new visitor,
  subscriber, mobile). Web honours `preview` only for a session whose ability allows editing the page, `as` switches the
  audience only and grants nothing, the response is `no-store` and `noindex`, and its `frame-ancestors` names the studio
  origin and nothing else;
- **Templates**: "Creator starter" (Start here, latest uploads, popular, playlists, featured channels; About), "Series-focused"
  (a hero of the newest episode, the series playlists as a grid, Start here, a custom Episodes tab) and "Blank", as
  validated documents in `@vp/domain` (a spec parses each through the schema); applying one asks in a `Dialog` and
  replaces the draft only.
- New kit parts, specified under `docs/design/` and built here: `SectionEditorCard`, `SectionPreview`, `TabStrip` (studio kit),
  `DateTimePicker` is 120's, and in web's kit `ContentSection` (one component over `Shelf`,
  grid, list, hero and masonry), `RichTextView` (the whitelisted tree), `SectionBackdrop`. The rest is `Drawer`, `Dialog`,
  `Command`, `Tabs`, `Switch`, `Select`, `Slider`, `SegmentedControl`, `Field`, `Callout`, `Toast`, `Badge`, `EmptyState`.
- Web renders the page from the resolved response, server-rendered, through 58's shelves and cards
  ([docs/design/apps/web/shelf.md](../design/apps/web/shelf.md), [video-card.md](../design/apps/web/video-card.md)), with
  card density and the show flags passed down as props.

## Delivery

One stack of three slices:

1. The schema, `migrateLayout`, rules, the drafts, revisions use, schedules and scheduler, the resolver with its cache and
   query-count test, endpoints, contracts and SDD.
2. Web: `ContentSection` and the other kit parts, the page route and custom tab routes, landing per audience, the
   `page-image` kind in 115's job, and the preview gating.
3. Studio: the page builder, templates, the publish bar, schedules, revisions and preview as.

## Acceptance criteria

- [ ] A layout with every source type, every section layout and every sort renders; a creator changes a source, a sort and
      a layout in the studio and the draft preview shows it before anyone else does.
- [ ] A channel page makes at most one query per source type plus one hydration query (a count test over a 20-section
      layout), and a second request at the same audience is served from the cache.
- [ ] A section limited to subscribers is absent for a guest and present for a subscriber, with identical cached output per
      audience; a section outside its window, locale or with nothing to show and `hideWhenEmpty` is absent.
- [ ] `hideWatched` removes the signed-in viewer's watched videos and leaves a guest's section whole; `random` is stable
      within one visit and changes between visits.
- [ ] A custom tab opens at its slug, shows its header and description, renders its sections, and refuses a duplicate or
      reserved slug; landing sends a new visitor and a subscriber to different tabs.
- [ ] Built-in tabs can be renamed, hidden (not Home or About) and reordered; an empty built-in tab is not rendered.
- [ ] The caps hold: an 11th tab, a 5th custom tab, a 21st section on a tab, a 25th picked item, an oversized document and
      Markdown with HTML, scripts or an image URL are refused with their codes.
- [ ] A section accent applies inside the section only, a viewer's own accent still wins and status roles do not move.
- [ ] Draft, publish, schedule and restore work; a schedule applies once even when the scheduler runs twice; "schedule my
      return" brings the earlier layout back; two members saving the draft get a version conflict.
- [ ] Preview as new visitor, subscriber and mobile shows what that audience gets; `preview=draft` is ignored for anyone
      who cannot edit the page.
- [ ] A section pointing at a video made private drops out without a save; an editor (117) can edit and publish, a
      moderator gets a 403; `privilege-escalation.test.ts` gains the rows.
- [ ] Both apps meet the polish bar ([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `pnpm gen:contracts`
      (no diff) green, with output in the PR.

## Out of scope

- Brand colours (106), animated or video backgrounds, per-viewer personalised layouts, layout A/B tests, custom domains.
- Premieres (nothing in the platform produces one; `live` covers 76's streams only).
- Arbitrary HTML, scripts, embeds from other origins, and any block that loads a third-party resource.
- Sources from other creators' content beyond featured channels (a cross-channel `linked` source is 122's).

## Testing plan

- Schema and rules: `it.each` tables over every caps case, slug case, the Markdown whitelist, audience and window
  evaluation, and `migrateLayout`; each template parses.
- Resolver: the query-count test, per-audience cache keys, `hideWatched` and seeded `random`, a source whose items turned
  private.
- Repositories and routes: the shared contract suite, the 403 matrix over roles, schedule CAS and scheduler idempotency,
  preview gating.
- Studio and web: `renderRoute` specs for reorder by keyboard, the section drawer, the publish bar, preview as, and the
  server render of a custom tab.
- E2E: build a layout and a custom tab in the studio app, publish, read it as a guest and as a subscriber in web.

## Open questions

- Decided: this ticket is split from 115 so identity ships on its own and the builder can take its three slices.
- Decided: Home is a section list and the other built-in tabs are fixed grids, so a creator customises the page that
  matters without every tab becoming a builder; only custom tabs are free-form.
- Decided: the cache holds the pool per audience and the per-viewer steps run after it, so `hideWatched` and `random` never
  fragment the cache by viewer.
- Decided: windows and locales are evaluated at read, and only whole-layout changes use a scheduler.
- Decided: rich-text images reference uploaded ids, never URLs, so a page cannot phone home and local-first holds.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] SDD §5, §6.1 and §6.2 updated; the OpenAPI document regenerated.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
