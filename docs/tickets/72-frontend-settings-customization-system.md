# 72: Settings - a full settings area with appearance, advanced token sets, accessibility, playback, privacy and notifications, saved to the device and the account

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#72](https://github.com/szebest/taitube-platform/issues/72) |
| Size | L |
| Blocked by | 38 - User identity · 53 - Frontend data layer · 55 - Design system · 56 - Frontend auth · 89 - TanStack Start foundation · 91 - Web import aliases · 93 - Creator Studio as its own app · 95 - Design system 2 · 97 - Saved preferences · 104 - Channel page data |
| Blocks | 86, 96, 106, 111, 115, 121, 126 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §11 Security](../SDD.md#11-security) |

**Status:** blocked

> **Ticket 85/86 note:** the locale and time-zone preferences belong in this settings area and this preference
> store, not a bespoke key. The selector itself and the negotiation chain are [86](86-localisation-rollout-locale-negotiation-rtl.md).
> Until then `@vp/intl-react` reads the saved locale from `LOCALE_STORAGE_KEY` (`vp.locale`); this ticket moves it
> into the preference store.

> **Builds on 95 and 97.** Appearance is 95's engine (`useAppearance`, the `vp.appearance` cookie, the registry
> of themes and offered token sets: [docs/design/architecture.md section 2](../design/architecture.md#2-themes-and-token-sets));
> account storage is 97's `/v1/me/preferences`. This ticket is the settings area on top of both.

## What to build

A settings area of its own in web, not a tab strip: every preference the platform has, findable, previewed
live, saved the moment it changes, and following a signed-in viewer to their next device. Feature code in
`apps/client/web/src/features/settings/`; the channel's settings stay in the studio's `/customization`.

### 1. The settings area

| URL | Section | Signed out |
|---|---|---|
| `/settings` | overview: a search field and one card per section | yes |
| `/settings/appearance` | theme, mode, accent, density | yes |
| `/settings/appearance/advanced` | every token set, one control each | yes |
| `/settings/accessibility` | font size, contrast, motion, borders, captions defaults | yes |
| `/settings/playback` | quality, speed, autoplay next, hover preview, ambient, stats overlay | yes |
| `/settings/privacy` | pause and clear history, default playlist visibility, subscriptions visibility | sign-in state |
| `/settings/notifications` | uploads, replies and mentions, processing finished | sign-in state |
| `/settings/language` | the slot 86 fills | yes |

- **A shell of its own**: a section navigation and a content pane from medium up; on compact the overview is a
  list and each section a page with a back button. The shell is web's app kit (`SettingsShell`, `SettingsSection`,
  `SettingRow`, built from `@vp/ui` and `@vp/components`), and every row is a smart wrapper reading its own
  preference hook ([architecture section 5](../design/architecture.md#5-smart-wrappers-in-the-apps)).
- **Every section is a route**, so every page is a link, the back button works, and the server renders it.
- **Search**: the overview's field filters a settings index (every row registers an id, its label, keywords and
  its section); a result opens `/settings/<section>#<row>` and highlights the row. The same index feeds 74's
  command palette.
- **Signed out**: device sections work; privacy and notifications show `EmptyState` with one Sign in action.

### 2. Appearance

- **Theme**: a card per registered theme (name, swatches and a live preview rendered from its `Theme` value),
  so a theme added to the registry appears here with no edit.
- **Mode**: system, dark, light, OLED as a `SegmentedControl`.
- **Accent**: the theme's own or a picked colour, with the derived roles and their contrast previewed before the
  viewer confirms.
- **Density**: comfortable or compact, which writes the `spacing` and `sizing` overrides together.
- A link at the end, **Fine-tune the look**, opens the advanced page. It is not in the section navigation: the
  common choices stay simple.

### 3. Advanced: the token sets

`/settings/appearance/advanced` lists every token group in the registry's `offer`, in one consistent row each:

- **The choices**: "Theme default (Round)" first, then each offered implementation as a radio card with a
  small live preview of what it changes (a button and a card for `radius`, a paragraph for `fontSize` and
  `typography`, a stack of cards for `shadow`, a glow behind a frame for `ambient`, a moving chip for `motion`).
- **What is changed**: a row whose group is overridden shows a "Changed" badge and its own reset; the page has
  "Reset all to the theme's defaults".
- **A live preview panel** beside the list (below it on compact): a small home shelf and watch header rendered
  with the current choices, so the viewer sees the whole effect, not one control.
- **Driven by the registry**: a set added to `offer` appears here with no edit; a group's label, description and
  preview component come from one map in the feature keyed by `TokenGroup`, which the type requires to be
  complete.

### 4. Accessibility, playback, privacy, notifications

- **Accessibility**: font size (the `fontSize` sets), contrast, motion (with `prefers-reduced-motion` shown as
  the system setting that always wins), borders (`bold` pairs with more contrast), captions on by default and
  their language. These write the same appearance overrides as the advanced page, so the two never disagree.
- **Playback**: default quality, speed, autoplay next, hover preview, ambient mode in the player, stats overlay.
  The player ([57](57-production-video-player-hls-streaming-controls.md)) and the cards read these defaults from
  the store instead of their own keys.
- **Privacy**: pause watch and search history (one `historyPaused` switch, see [125](125-viewer-activity-search-history-likes-comments.md)), clear watch history (confirmation `Dialog`), default playlist visibility,
  subscriptions visibility. Pause and clear use 97 and [46](46-youtube-playlists-watch-history-engine.md).
- **Notifications**: uploads from subscriptions, replies and mentions, processing finished.

### 5. Saving

- **Device first**: every change applies at once and writes its cookie (appearance through `useAppearance`, the
  rest through one typed preference store in `features/settings/` with a Zod schema and defaults), so a guest
  keeps their choices and the server renders them without a flash. `localStorage` reads, where any remain, are
  wrapped in try/catch.
- **Account when signed in**: the same change is sent to `PATCH /v1/me/preferences` (97), debounced, as an
  optimistic mutation; a failure keeps the local change, shows a toast with Retry, and marks the row "Not saved
  to your account". A version conflict refetches and reapplies the viewer's last change.
- **Signing in** loads the account's preferences and applies them over the device's, section by section; a
  section the account has never saved is uploaded from the device instead, so a first sign-in loses nothing.
- **Another device's save** arrives as `preferences.updated` on the user stream (98), whose handler refetches the
  `['preferences']` query unless its cached `version` is already the saved one: the preferences query keys under
  `['preferences']`, and the mutation writes its result to that key so the device that saved does not refetch.
- **One source per preference**: no component reads a cookie or the API for a preference directly; it reads the
  store's hook.

### 6. Studio

- The studio's account menu has an **Appearance** popover (theme, mode, density) on `useAppearance`, sharing
  the cookie with web, and a link to web's `/settings/appearance` for everything else (`VITE_WEB_URL` in its
  config).
- **Channel (`/customization`)**: TanStack Form (`@vp/forms`) over `PATCH /v1/me/channel`
  ([38](38-user-channel-identity-universal-auth.md)): display name, handle (format from `@vp/validation`'s handle
  rule, availability from the API), bio, social links, avatar and banner upload with preview and safe-zone
  guides. The page is a list of independent sections, each with its own save, so
  [96](96-channel-featured-videos-start-here.md) adds the Start here section without touching the others.

## Acceptance criteria

- [ ] Every section in the table is its own route, renders on the server, and works at 320 px as list then page
      and from medium up as navigation plus pane.
- [ ] Theme, mode, accent and density apply without a reload, survive a reload with no flash, and
      `features/settings/` reads and writes no appearance cookie of its own.
- [ ] The theme cards and the advanced page's groups and choices are exactly the registry's; a test registry
      with an extra theme and an extra set shows both with no edit in `features/settings/`.
- [ ] Choosing "airy" spacing on the advanced page shows "Changed", updates the live preview and the whole app at
      once; its reset returns it to the theme's default; "Reset all" clears every override.
- [ ] Font size, contrast, motion and borders set on Accessibility and on Advanced are the same values, whichever
      page set them.
- [ ] Searching "corners" on the overview finds the radius row and opens the advanced page scrolled to it.
- [ ] Signed in, a change is saved to 97 and appears on a second browser after sign-in; signed out, it stays on
      the device; a first sign-in uploads the device's sections the account has never saved.
- [ ] A failed account save keeps the change, shows Retry, and marks the row until it succeeds.
- [ ] An accent override that fails contrast shows the derived accent before the viewer confirms.
- [ ] Playback defaults are honoured by the player on the next video.
- [ ] The locale preference moves from `vp.locale` into the store, with a one-time migration of the old key.
- [ ] The studio's Appearance popover and web's settings change the same preference; the studio's
      `/customization` validates and saves through `PATCH /v1/me/channel`.
- [ ] Meets the polish bar ([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)) on every
      surface this ticket builds.
- [ ] Integration specs for each section, the advanced overrides, search, and the device and account saving
      paths, through `renderRoute` with MSW.

## Out of scope

- Email digests; custom domains for channels.
- The locale selector and negotiation: 86.
- The quick-settings overlay from the header avatar: a follow-up on 69's `useUrlModal`.

## Testing plan

- Appearance: switch to Nocturne OLED with airy spacing, reload; the server render keeps `data-theme="nocturne"`,
  `data-mode="oled"` and `data-spacing="airy"`.
- Account: change a playback default signed in, sign in on a second context, the default is applied.
- Channel: submit a new handle and avatar, the channel page shows them.

## Definition of Done

- [ ] `pnpm --filter @vp/web test`, `pnpm --filter @vp/studio test` and `pnpm typecheck` pass.
- [ ] Settings verified on mobile and desktop in both themes.
- [ ] `apps/client/web/AGENTS.md` documents the settings index and the preference store.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
