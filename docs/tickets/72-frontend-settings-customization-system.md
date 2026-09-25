# 72: Extensive settings & customization system — themes, playback preferences, privacy toggles & channel branding

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#72](https://github.com/szebest/taitube-platform/issues/72) |
| Size | M |
| Blocked by | 38 - User identity · 53 - Frontend data layer · 55 - Design system · 56 - Frontend auth · 89 - TanStack Start foundation · 91 - Web import aliases |
| Blocks | 86 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §11 Security](../SDD.md#11-security) |

**Status:** blocked

> **Ticket 85/86 note:** the locale and time-zone preferences belong in this settings surface and this
> preference store — not a bespoke key. The selector itself and the negotiation chain are [86](86-localisation-rollout-locale-negotiation-rtl.md), built on
> the formatting core in [85](85-universal-intl-formatting-message-core.md).
> Until then `@vp/intl-react` reads the saved locale from `LOCALE_STORAGE_KEY` (`vp.locale`); this ticket
> moves it into the preference store.

> **Builds on 89.** A new page: no legacy module to replace. It uses 89's route structure, 53's query and form
> setup, 55's theme engine and 56's `_authed` layout.

## What to build

Route `apps/web/src/routes/_authed/settings.tsx`, feature code in `apps/web/src/features/settings/`.

### 1. Settings hub

- `/settings` with tabs `appearance`, `playback`, `privacy`, `notifications`, `channel`. The tab is the route's
  `validateSearch` param (`?tab=`, default `appearance`), so every tab is a link.
- A quick-settings overlay from the header avatar (`?modal=settings&tab=`) is a follow-up once
  [69](69-frontend-url-state-search-params-modal-routing.md) ships `useUrlModal`.

### 2. Preference store

- One typed preference store in `features/settings/`: a Zod schema with defaults, read and written through one
  hook. Device preferences (theme, accent, density, volume, player defaults, locale) persist in a cookie so SSR
  renders them without a flash; `localStorage` reads are wrapped in try/catch.
- Account preferences (privacy, notifications) are server data: a query plus optimistic mutations. They need a
  `/v1/me/preferences` endpoint that does not exist yet; those tabs wait for it.
- The player ([57](57-production-video-player-hls-streaming-controls.md)) and the card grid read their defaults
  from this store instead of their own keys.

### 3. Tabs

- **Appearance:** theme (dark, light, OLED, system) on 55's theme engine, accent colour, card density
  (comfortable, compact), ambient mode default. Changes apply without a reload.
- **Playback:** default quality, speed, autoplay next, hover preview, captions defaults, stats for nerds default.
- **Privacy:** pause watch history, clear watch history (confirmation dialog), default playlist privacy,
  subscriptions visibility. The history controls depend on
  [46](46-youtube-playlists-watch-history-engine.md)'s endpoints.
- **Notifications:** upload alerts from subscribed channels, comment activity, transcoding complete.
- **Channel:** TanStack Form over `PATCH /v1/me/channel` ([38](38-user-channel-identity-universal-auth.md)):
  display name, handle (format from `@vp/validation`'s handle rule, availability from the API), bio, social
  links, avatar and banner upload with preview and safe-zone guides.

## Acceptance criteria

- [ ] `/settings?tab=<tab>` opens that tab; an unknown tab falls back to `appearance` through `validateSearch`.
- [ ] Theme and accent apply without a reload, survive a reload, and the server render matches (no flash).
- [ ] Card density switches the grid between comfortable and compact.
- [ ] Playback defaults are honoured by the player on the next video.
- [ ] The locale preference moves from `vp.locale` into the store, with a one-time migration of the old key.
- [ ] Channel form validates the handle with `@vp/validation`, reports a taken handle from the API, previews
      avatar and banner before submit, and saves through `PATCH /v1/me/channel`.
- [ ] Privacy and notification toggles update optimistically and roll back on failure (once the preferences
      endpoint exists).
- [ ] Pause and clear watch history work against 46's endpoints (once they exist).
- [ ] Integration specs for theme switching, preference persistence and the channel form, through 54's
      `renderRoute` with MSW.

## Out of scope

- Email digests.
- Custom domains for channels.
- The locale selector and negotiation: 86.

## Testing plan

- Theme: switch to OLED, reload, the `html` element keeps the OLED theme on the server render.
- Channel: submit a new handle and avatar, the channel page shows them.

## Definition of Done

- [ ] `pnpm --filter @vp/web test` and `pnpm typecheck` pass.
- [ ] Settings verified on mobile and desktop.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
