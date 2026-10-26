# 115: Channel identity - banner and avatar upload, handle change, trailer, links and series

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | L |
| Blocked by | 05 - Single PUT upload · 41 - Channel subscriptions · 44 - Creator studio video management · 46 - Playlists and watch history · 58 - Modern browse layout · 72 - Settings and customisation · 73 - Playlist and history library · 86 - Localisation rollout · 95 - Design system 2 · 104 - Channel page data · 117 - Channel team roles |
| Blocks | 119, 120, 121, 122 |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §7 Object storage layout](../SDD.md#7-object-storage-layout) · [SDD §11 Security](../SDD.md#11-security) · [SDD ADR-24 Result-typed errors](../SDD.md#adr-24--result-typed-error-handling-domain-returns-the-edge-decides) |

**Status:** blocked

> **Why.** A channel's identity cannot be set up properly: the banner and avatar are URLs, there is no trailer for a
> newcomer, the handle cannot change without breaking every link to it, and About carries five unlabelled links. [38](38-user-channel-identity-universal-auth.md) left avatar and banner upload out of scope,
> [72](72-frontend-settings-customization-system.md)'s channel form lists "avatar and banner upload with preview and
> safe-zone guides" without anything to upload to (`packages/server/storage/src/keys.ts` has no image key), and the handle
> cannot change without breaking every link to it.

> **Builds on, does not redo.** The channel form, `/customization` and its independent sections are 72's; the Start here
> shelf and `PUT /v1/me/channel/featured` are [96](96-channel-featured-videos-start-here.md)'s; About links, the channel stats and
> the public playlists endpoint are [104](104-channel-page-data.md)'s (this ticket raises its link limit and adds
> platform icons). The page's sections, tabs, drafts and scheduling are [121](121-channel-page-builder.md)'s, which
> places the trailer and returning-subscriber video this ticket resolves. [106](106-channel-branded-and-user-built-themes.md) owns the brand colour and lists banner theming as
> out of scope: this ticket supplies the banner image and nothing about its colours, and the two tickets edit different
> sections of `/customization`. Team members who may edit the channel are 117's matrix.

## What to build

### 1. Images: upload, crop and process

No image can be uploaded today, so this ticket adds the pipeline, on the local stack the platform already has (the
presigned PUT of [05](05-single-put-upload-complete-enqueue.md), the worker, `ffmpeg`; no new runtime dependency).

- `POST /v1/me/channel/images/:kind` (`avatar` or `banner`) returns a presigned PUT into the private `raw` bucket
  under `channel-images/{channelId}/{kind}/{uploadId}` (a new function in `packages/server/storage/src/keys.ts`);
  `POST /v1/me/channel/images/:kind/complete` takes the crop rectangles, verifies size, type (JPEG, PNG, WebP) and
  dimensions (banner at least 1024 x 576 and 6 MB, avatar at least 200 x 200 and 2 MB) and enqueues a `channel-image` job.
- The job strips metadata, applies each crop and writes WebP variants to the public bucket under
  `channelImageKey(channelId, kind, variant, version)`: avatar at 48, 72, 128 and 256 px square; banner at 1280 and 2560 px
  wide for each target below. Success CAS-updates the channel's `avatar_version` or `banner_version` and appends the audit
  event; failure keeps the old image and tells the studio through 98's stream. The job is idempotent per upload id and
  follows the worker's retry classes (`PermanentError` for a hostile file). Housekeeping purges superseded versions.
- Banner targets: `desktop` (6:1, from the expanded layout), `mobile` (3:1, compact) and `tv` (16:9, the whole image),
  with one crop rectangle each over the same upload and the safe area (the centre 1546 x 423 of a 2560 x 1440 image) drawn
  as guides in the studio.
- The channel resource keeps 38's `avatarUrl` and `bannerUrl` (the default variants) and gains `banner: { desktop, mobile,
  tv }` and `avatar: { sizes }` URL sets; an external image URL written by 38's `PATCH` stays valid until replaced.

### 2. Identity

- **Handle change** through `PATCH /v1/me/channel`: at most once every 30 days, validated by `@vp/validation`'s handle
  rule and availability. The old handle goes to `channel_handle_history` (`handle`, `channel_id`, `retired_at`) and
  resolves for 90 days: `GET /v1/channels/:idOrHandle` answers with the channel and `redirectedFrom`, web answers a
  retired handle's page with a `301` to the new one, and nobody but the owner can claim a retired handle until it is
  released.
- **Display name** has no cooldown. **Description** (the `bio` column) goes to 5000 characters of plain text, links
  auto-detected at render, no markup. **Country**: `channels.country` from the ISO 3166-1 list in `@vp/domain`, shown in
  About as a region name from `@vp/intl`.
- **Contact email**: `channels.contact_email` (nullable, format validated). The channel resource carries `hasContact`
  only; `POST /v1/channels/:id/contact-reveal` returns the address to a signed-in caller, rate-limited per caller (20 a
  day), and About shows a "Show contact email" `Button` that reveals it with a `mailto:` link. Nothing sends email.

### 3. Links, banner link, trailer, returning-subscriber video and languages

- **Social links**: 104's `links` limit goes from five to eight; each link's `platform` is derived on read from its host
  by one table in `@vp/domain` (`LINK_PLATFORMS`: website, GitHub, X, Instagram, TikTok, Twitch, Discord, Mastodon,
  Bluesky, LinkedIn, Reddit, Facebook; an unknown host is `website`), so no stored data changes. The icons are vendored
  SVGs in `@vp/ui` generated once from a devDependency, never fetched at runtime.
- **Banner link**: `channels.banner_link` (`{ label up to 24, url }`, `https` only), rendered as a small `Button` inside
  the banner's safe area, never as a click target over the whole banner.
- **Trailer and returning-subscriber video** (two slots under `update` on `Channel`, not pins; a pin orders a list, [113](113-channel-comment-moderation.md)): `channel_page_settings` (`channel_id`, `trailer_video_id`,
  `returning_video_id`), both the channel's own `READY` and `PUBLIC` videos, a rule in `@vp/domain-rules` returning
  `Result`. `GET /v1/channels/:idOrHandle/spotlight` resolves it for the viewer: a subscriber ([41](41-channel-subscriptions-subscriber-feed.md))
  gets the returning-subscriber video (the trailer when none is set), anyone else gets the trailer. It is the only viewer-dependent
  block, fetched on its own so the rest of the page stays cacheable.
- **Per language**: `channel_localizations` (`channel_id`, `locale`, `description`, `trailer_video_id`), one row per locale
  of [86](86-localisation-rollout-locale-negotiation-rtl.md)'s supported set, optional; the channel resource and the
  spotlight take the negotiated locale, falling back to the default fields.

### 4. Series

A series is a playlist ([46](46-youtube-playlists-watch-history-engine.md)) with `playlists.kind = 'series'` (default
`playlist`), made only of the owner's own videos. Nothing about order, reorder or the queue changes
([73](73-frontend-youtube-playlists-library-player-queue.md) already moves through a list). What a series adds, for a
signed-in viewer, on `GET /v1/playlists/:id`: each item's `episode` number (its position), its `progress` from
`watch_history` (46), and `nextEpisodeVideoId` (the first item after the last one watched that is below 92 percent, else
the first unfinished). The series page shows episode numbers and a progress bar per episode with a "Continue" button; the
watch page's queue labels the entries "Episode n".

### 5. Studio and web

- Studio `/customization` gains independent sections, each with its own save: **Images** (an `ImageCropper` over `Dialog`:
  drop or pick a file, a `SegmentedControl` for desktop, mobile and TV, safe-area guides, zoom `Slider`, a live preview of
  each target, and the job's progress through `Progress`), **Identity** (name, handle with the cooldown and the redirect
  explained in a `Callout`, description, country `Select`, contact email), **Links** (a `SortableList` with the platform
  icon detected as you type, the banner link) and **Spotlight** (trailer and returning-subscriber `Command` pickers,
  language tabs for the per-language description and trailer).
- Web: the header through [channel-header.md](../design/apps/web/channel-header.md) (banner variants through `<picture>`,
  the banner link as a part), the spotlight above Home's content, About with the icons, country and contact reveal, the
  handle redirect, and the series page and episode labels, all server-rendered.
- New kit parts, specified under `docs/design/` and built here: `ImageCropper` (studio kit), `PlatformIcon` (`@vp/ui`),
  `ChannelSpotlight` (web kit, the trailer or returning-subscriber video block). The rest is `Dialog`, `SortableList`, `Command`,
  `Tabs`, `Slider`, `Progress`, `SegmentedControl`, `Field`, `Callout`, `Toast`, `AspectRatio`, `Avatar` and `Button`
  from [95](95-design-system-2.md).

## Delivery

One stack of three slices:

1. Backend: the image pipeline and keys, identity (handle history, country, contact), links and the banner link, page
   settings and localisations, series fields, contracts and SDD.
2. Studio: the cropper and the Images, Identity, Links and Spotlight sections.
3. Web: the header variants, spotlight, About, handle redirect and series page.

## Acceptance criteria

- [ ] A creator uploads a banner, sets the three crops against the safe-area guides, and the channel page serves the right
      variant at desktop, mobile and TV widths; a hostile or oversized file is refused, metadata is gone from the output,
      and a failed job keeps the old banner.
- [ ] A handle change works once, a second change inside 30 days is refused, the old URL answers `301` to the new one for
      90 days, nobody else can take the old handle meanwhile, and the old handle works again for the owner.
- [ ] A visitor sees the trailer, a subscriber the returning-subscriber video; a viewer whose locale has a description and trailer gets
      them, others get the defaults.
- [ ] A 9th link, a non-https link or banner link, and a trailer that is private or another channel's are refused with
      their error codes; a trailer made private drops out of the spotlight without a save.
- [ ] Recognised links show their platform icon from the repo with no network request; unknown hosts show the website icon.
- [ ] The contact email is never in the channel resource; revealing it needs sign-in and is rate-limited.
- [ ] A series shows episode numbers and per-episode progress for the viewer, "Continue" opens the next unfinished episode,
      and a series refuses a video that belongs to another channel.
- [ ] An editor (117) can save, a moderator gets a 403; `privilege-escalation.test.ts` gains the rows.
- [ ] The studio sections and the page meet the polish bar ([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `pnpm gen:contracts`
      (no diff) green, with output in the PR.

## Out of scope

- Brand colours and theming (106), banner colour sampling beyond 95's ambient tint, animated banners and video banners.
- Sections, tabs, drafts, scheduling and preview ([121](121-channel-page-builder.md)), custom domains, channel
  verification.
- Email of any kind.

## Testing plan

- Domain rules and validation: `it.each` tables over links (platform detection), the handle cooldown and the locale
  fallback.
- Worker: the `channel-image` job over fixtures (valid, hostile, huge, wrong type), idempotency and the version CAS.
- Repositories: the shared contract suite over postgres and in-memory.
- Routes: contract tests per endpoint, the 403 matrix over roles, the redirect and the preview gating.
- Studio and web: `renderRoute` specs for the cropper, the identity sections, the spotlight and the series page.
- E2E: upload a banner and change the handle in the studio app, read the page as a visitor and as a subscriber in web.

## Open questions

- Decided: one banner upload with three crop rectangles, not three uploads, so a creator maintains one image.
- Decided: a retired handle redirects for 90 days and is reserved for its owner meanwhile, because a hijacked handle is
  worse than a held one.
- Decided: eight links, with the platform derived from the host on read, so 104's data needs no migration.
- Decided: a series is a playlist kind, not a new entity, so reorder, queue and history keep working unchanged.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] SDD §5, §6.1, §6.2 and §7 updated; the OpenAPI document regenerated.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
