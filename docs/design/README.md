# Taitube design language

The reference every UI ticket builds from: who Taitube is on screen, the themes and token sets, the roles, and
the anatomy of each surface. [Ticket 95](../tickets/95-design-system-2.md) turns it into code.

The design library, all in this folder:

| Path | What it holds |
|---|---|
| `README.md` | this guide: principles, signature moves, themes, roles, type, layout, surfaces, the polish bar |
| [`architecture.md`](architecture.md) | how it is built: the five layers, themes and token sets, shared option unions, compound components, smart wrappers |
| [`tokens.json`](tokens.json) | every value, in the W3C Design Tokens (DTCG) format: `ref` ramps, `set` implementations per token group, `theme` roles and defaults, `scale` |
| [`data-sources.md`](data-sources.md) | where every surface and component gets its data, the transport (REST, SSE, WebSocket) and the fallback until its ticket lands |
| [`foundations/`](foundations/README.md) | colour, type, token sets, spacing and layout, shape and elevation, motion, icons, accessibility, voice and copy |
| [`primitives/`](primitives/README.md) | a spec per `@vp/ui` primitive |
| [`components/`](components/README.md) | a spec per `@vp/components` component (only what both apps share) |
| [`apps/web/`](apps/web/README.md), [`apps/studio/`](apps/studio/README.md) | a spec per component of each app's own kit, with its smart wrappers |
| [`index.html`](index.html) | the library board: every screen, live, with the appearance switcher |
| [`screens/`](screens) | web, studio, settings and states mockups |
| [`specimen.html`](specimen.html) | roles, ramps, the type scale, radius, elevation and space, rendered from `tokens.json` |
| [`assets/`](assets/brand/README.md) | the mark, wordmark, lockup, app icons, favicon, OpenGraph template, empty-state illustrations |
| [`lib/`](lib/design.css) | the library's own stand-in CSS, script and icon sprite; never imported by an app |

Serve the folder to open the pages: `python3 -m http.server -d docs/design 8123`, then
`http://localhost:8123/`. They read `tokens.json` with `fetch`, which a `file://` page cannot do.

Until 95 lands, `tokens.json` is the source of the values. Once `@vp/design-tokens` and the token sets exist,
they are the source and `tokens.json` is generated from them (95, slice 1), so the two never disagree.

---

## 1. Who Taitube is

YouTube's feature set with a curator's eye. YouTube is a utility: a neutral grey frame, one loud red, an endless
uniform grid. Taitube is a place you choose to spend an evening: a warm frame that steps back for the video,
a quieter accent, shelves someone thought about, and a queue that belongs to the viewer.

### Principles

1. **The video is the colour.** Chrome is warm neutral and low in chroma, so thumbnails and the player carry
   the colour. Nothing in the frame competes with a frame of video.
2. **One accent, one meaning.** The accent marks the viewer's own actions and position: the primary button,
   progress, the selected item, focus. It never means a status, and red means live and nothing else.
3. **Curated before infinite.** Home opens on a choice someone made (Pick of the day, Continue watching,
   shelves with a reason), and the endless grid is one tap further, never the first thing.
4. **The viewer owns the queue.** Up next is the viewer's list to reorder, not a recommendation rail that
   autoplays strangers. Recommendations sit under it and are labelled as such.
5. **Quiet chrome, cinematic moments.** Controls are calm and stay out of the way; the few moments that
   matter (opening a video, a premiere, switching theme) get real motion.
6. **Say why.** Every recommendation carries its reason ("Because you watched Lisbon at night", "New from a
   channel you subscribe to"), shown before the click.

### Signature moves

What makes a screen read as Taitube rather than a YouTube clone. Each is a pattern, not anyone's brand asset.

| Move | Where | What it is |
|---|---|---|
| Pick of the day | Home hero | One video chosen per day with a short note in the editorial serif and a visible window ("Picked today, 14 h left") |
| Byline cards | Every video card | The channel sits above the title as an uppercase byline with a 16 px avatar dot, not as an avatar column beside it |
| Reason labels | Cards in shelves | A small label under the meta line saying why this card is here |
| Expand on hover | Cards, pointer devices | After 500 ms the card grows in place into a raised panel: sprite preview, two lines of description, Save and Queue |
| Ambient stage | Watch page, channel banner | The player sits on a black stage whose glow, sampled from the video, bleeds into the warm page ground |
| Your queue | Watch page, everywhere | Up next is a reorderable queue the viewer owns, with "More like this" below it |
| Now playing bar | Every page | Leaving the watch page keeps the video playing in a bar along the bottom, with queue and expand; YouTube's corner miniplayer does not exist here |
| Liner notes | Watch page | The description is a card with a chapter strip and the creator's notes, set like an album's liner notes |
| Command palette | `/` or `Cmd K` anywhere | Search that also runs actions: "Switch to Nocturne", "Open Watch later", "Upload a video" |
| Start here shelf | Channel page | A creator pins up to six videos a newcomer should watch first; until they pin any, the shelf shows their most watched. About is a manifesto in the serif |
| Quiet player | Player | The default chrome shows play, time, volume, chapters, theater, fullscreen; quality, speed and stats live in the settings and context menus |

---

## 2. Themes and token sets

A **theme** is an identity: its colour roles per mode (section 3), its dataviz palettes, and a default for each
of nine **token sets**, the swappable implementations of every other dimension of the look: `typography`,
`fontSize`, `spacing`, `sizing`, `radius`, `border`, `shadow`, `ambient`, `motion`. Each set implementation is
its own module (`@vp/ui/tokens/shadow/soft`), a theme names its defaults by import, and one registry lists the
themes and the sets a viewer may switch to. How it is built:
[architecture.md section 2](architecture.md#2-themes-and-token-sets); every set and value:
[foundations/token-sets.md](foundations/token-sets.md). Two themes ship:

| Theme | Ground | Accent | Starts with | Feels like |
|---|---|---|---|---|
| **Sand** (default) | warm taupe and charcoal, `sand` ramp | brass ochre, `ochre` ramp | figtree, round corners, hairline borders, soft shadows, cinematic ambient | a screening room with the house lights low |
| **Nocturne** | blue ink, `ink` ramp | marquee amber, `amber` ramp | geist, sharp corners, regular borders, flat (no shadows), subtle ambient | a late-night edit suite |

Each theme has three **modes**: `dark` (default), `light` and `oled` (dark on a true-black ground), plus
`system`, which follows `prefers-color-scheme` between dark and light. Beyond theme and mode, the viewer sets an
**accent** override and **contrast** (standard, more), and may override any token set: the simple **Density**
control writes `spacing` and `sizing` together, and the settings area's advanced page sets each on its own
([ticket 72](../tickets/72-frontend-settings-customization-system.md)). `prefers-reduced-motion` always forces
the `reduced` motion set.

Rules:

- A light mode takes a darker accent step (`ochre-700`, `amber-700`), because the dark-mode accent is 2:1 on
  paper. The role names stay the same; components never pick a step.
- `media` (the letterbox) is black in every mode: video is graded for black, and a warm or white letterbox
  shifts how it looks.
- Nocturne's accent is amber, so its warning colour is coral and always carries its icon.

---

## 3. Colour roles

Components use these names and nothing else: no hex value, no ramp step, no Tailwind palette colour.

| Role | Use |
|---|---|
| `bg` | the page ground |
| `surface` | cards, panels, the search field, the now playing bar |
| `raised` | menus, popovers, toasts, an expanded card |
| `border` | dividers and card outlines |
| `border-strong` | field and control outlines, hovered dividers (3:1 on `bg` and `surface`) |
| `fg` | text and icons |
| `fg-muted` | metadata and secondary text (at least 4.5:1 on `bg` in every mode, 7:1 in dark) |
| `fg-subtle` | placeholders and disabled text only, never something to read |
| `tint`, `tint-strong` | translucent fills that read on every surface: secondary buttons, hover, skeletons, chip grounds |
| `accent`, `accent-hover`, `on-accent` | the primary action, progress, selection; and the text on it |
| `accent-ink` | the accent as text: links, the active label |
| `accent-soft` | the selected nav item, a soft badge ground |
| `focus-ring` | the one focus ring, 2 px with a 2 px offset |
| `live`, `on-live` | live and recording badges, the live pulse; nothing else is red |
| `danger`, `danger-ink` | destructive buttons; destructive text and field errors |
| `success-ink`, `warning-ink`, `info-ink` | status text, always with its icon |
| `scrim` | behind dialogs and sheets, under text on video |
| `media` | behind video |

Studio charts use `dataviz.categorical-{dark,light}` (six series, checked for contrast against `surface`),
`dataviz.sequential` and `dataviz.diverging`; never the UI roles.

---

## 4. Type

| Face | Role |
|---|---|
| Figtree (Sand) or Geist (Nocturne) | everything in the interface |
| Newsreader | the editorial voice only: the Pick of the day note, curator lines on shelves, a channel's About; never a button, label or title |
| Geist Mono | durations, timestamps, counts that line up; always `tabular-nums` |

The faces come from the `typography` set (`figtree`, `geist`, or `system` for no font download), and each
ships as `@fontsource-variable/*` bundled with the app (Rule 6, nothing phones home). The type styles are
`display`, `headline`, `title-lg`, `title`, `body`, `body-sm`, `label`, `caption`, `overline`, `editorial`,
`mono`: their weight and tracking come from the `typography` set and their size and line height from the
`fontSize` set (`small`, `default`, `large`, `xlarge`). Headings use `text-wrap: balance`; a card title is two lines at most; the
byline on a card is `overline` in `fg-muted`.

---

## 5. Shape, space, elevation, motion

- **Space**: components use the `spacing` set's roles (`inset-control`, `inset-card`, `gap-inline`,
  `gap-stack`, the grid and shelf gaps, `section`, the gutters); the raw 4 px scale (`scale.space`) is for
  one-off layout. Siblings are laid out with `gap`, never margins. Sizes (controls, icons, avatars, the header,
  the rail, the card minimum, the touch target) come from the `sizing` set.
- **Radius** comes from the `radius` set (`sharp`, `soft`, `round`): `thumb` for video frames, `card` for panels,
  `control` for buttons and fields, `chip` for chips, `sheet` for dialogs and sheets, `sm` for small inner
  frames (queue thumbnails, menu items), `xs` for badges and the duration label. A component names the
  role; Sand starts round and Nocturne sharp. Border widths come from the `border` set.
- **Elevation** is three steps per mode from the `shadow` set (`flat` has none, `soft`, `deep`). Dark mode lifts with a lighter surface first and a
  shadow second; light mode the other way round.
- **Ambient** (the glow sampled from video) comes from the `ambient` set: `off`, `subtle`, `cinematic`.
- **Motion** uses the `motion` set (`standard`, `calm`, `reduced`): `fast` for hover and focus, `base` for menus, `slow` for sheets and the card
  lift, `cinematic` for route view transitions and the thumbnail-to-player move. Entering elements use
  `enter`, leaving ones `exit`, moving ones `settle`. Nothing moves under reduced motion except opacity, and a
  keyboard-driven action (palette, shortcut) never animates its open.

---

## 6. Mark and icons

- **The mark** is a 16:9 frame with a sun rising on its lower edge, in one ink, next to the lowercase wordmark
  `taitube` in the UI face at weight 800 and `-0.045em` tracking. It takes `accent` in the header and `fg`
  elsewhere. It is never a play triangle in a coloured box.
- **Icons** are Lucide at a 1.75 stroke with round caps and joins, sized by the `Icon` primitive (`IconSize` from the `sizing` set: 16, 20, 24 at medium).
  An active item is shown by its `accent-soft` ground and `accent-ink` icon, never by swapping to a filled
  icon. The only filled glyphs are dots (more, grip) and the verified badge, which are filled by design.

---

## 7. Layout and the shell

| Breakpoint | Width | Shell |
|---|---|---|
| compact | 0 to 599 px | header with search icon, bottom tab bar (Home, Shorts, Subscriptions, You), now playing bar above the tabs |
| medium | 600 to 1023 px | header, collapsed rail (icons, 76 px) |
| expanded | 1024 to 1439 px | header, collapsed rail, opens to 248 px on demand |
| large | 1440 px and up | header, open rail (248 px) |

- The **header** (64 px) holds the menu button, the mark, the search field (it opens the command palette),
  Create, notifications and the account.
- The **rail** groups Home, Explore, Shorts, Subscriptions, Live; then You (History, Watch later, Playlists, Your videos);
  then the followed channels with a live dot.
- The **now playing bar** spans the content column at the bottom: a 16:9 live picture, title and channel,
  play, next, the queue count, and expand back to the watch page.
- Content is fluid up to 2200 px; text blocks stop at 68 ch.

---

## 8. Surfaces

### Video card

```
┌──────────────────────────────┐
│                              │  thumbnail, radius thumb, 1 px inset border at 8 % fg
│ [4K]                         │  badge top left (4K, NEW, PREMIERE; LIVE in live)
│                       18:42  │  duration bottom right, mono
│▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░│  progress flush to the bottom edge, accent
└──────────────────────────────┘
 ● MARTA REIS FILMS               byline: 16 px avatar dot + overline, fg-muted
 Shot entirely on a 1998          title, two lines, title style
 camcorder: Lisbon at night
 412K views · 2 days ago          body-sm, fg-muted
 ◦ Because you watched Porto      reason label, caption, accent-ink (shelves only)
```

Variants: `grid`, `shelf`, `row` (thumbnail left, for lists and the queue), `poster` (9:16, Shorts) and
`spotlight` (the hero). States: rest, hover lift (2 px up, `elevation-2`, `slow` with `settle`), expanded
(pointer only, after 500 ms), partly watched, live, premiere, unavailable, skeleton.

### Home

1. Chip bar (categories; the selection is the `category` search param).
2. **Pick of the day**: spotlight card, the note in `editorial`, the window in `caption`.
3. **Continue watching**: shelf of partly watched videos, progress visible.
4. Shelves with a reason in their heading ("From your subscriptions", "Because you watched…", one per
   category the viewer watches).
5. **Shorts** shelf of posters.
6. **Live now** shelf.
7. "Everything": the infinite grid, behind a heading the viewer scrolls to.

### Watch page

```
┌─────────────── stage (media, ambient glow behind) ───────────────┐ ┌──── Your queue ────┐
│                                                                   │ │ 3 / 12  ⇄  ⟳  ⏵⏵   │
│                         player                                    │ │ ▢ row card          │
│                                                                   │ │ ▢ row card          │
└───────────────────────────────────────────────────────────────────┘ ├── More like this ──┤
 Title (headline on large, title-lg below)                             │ ▢ row card          │
 ● Channel  284K subscribers  [Subscribe]     [♡ 24K | ♡̸] Share Save Queue Clip ⋯           │
┌ Liner notes ───────────────────────────────────────────────────┐   │                     │
│ 412K views · 2 days ago · #film                                │   │                     │
│ notes, three lines, then more                                  │   │                     │
│ [chapter] [chapter] [chapter] [chapter]                        │   │                     │
└────────────────────────────────────────────────────────────────┘   └─────────────────────┘
 Discussion · 1,284   Top | Newest
```

Theater puts the stage full width and the queue beside the discussion below it. On compact the queue is a
sheet behind a "Queue" button. The player's quiet chrome is the default (section 1).

### Channel page

Banner tinted by the ambient sample of the latest upload; identity row (avatar, name in `display`, handle,
subscriber count, Subscribe); the **Start here** shelf (the creator's pinned videos, or their most watched until they pin any); tabs Home, Videos, Shorts, Live, Playlists, Community,
About. A tab whose feature has not shipped is not rendered.

### Shorts and live

- **Shorts**: a 9:16 player centred on the stage, the action column to its right (Like, Discussion, Share,
  Queue), previous and next buttons on pointer devices, the discussion as a sheet.
- **Live**: chat docked to the right of the player; in fullscreen and on a vertical stream it becomes an
  overlay with an opacity slider. The live badge is `live` with a pulsing dot; under reduced motion the dot is static.

### Search

The command palette is the entry: videos, channels and playlists as you type, plus actions. Enter on the
query opens the full results page (74).

### Studio

Same theme, compact density by default, a workspace shell (navigation, toolbar, content, an inspector panel
for the selected item) and the `dataviz` palettes for charts.

### Measurements

| Surface | Measure |
|---|---|
| Channel banner | 6:1 from medium up, 3:1 on compact; the safe zone is the middle 60 % |
| Shorts frame | 9:16, height `min(100dvh - 96px, 900px)` |
| Live chat | 340 px docked; the overlay is 360 px wide at 85 % opacity by default |
| Notification centre | popover 400 px wide, at most 560 px tall, scrolls inside |
| Data table row | 52 px comfortable, 40 px compact |
| Expanded card | the card's width plus 16 px each side, `raised`, `elevation-3`; the preview steps through the sprite sheet |
| Ambient glow | sampled from the current frame every 500 ms, eased over `slow`; the stage blurs it by 70 px at `--ambient` opacity |

Keyboard reordering (queue, Start here, playlists): Space picks a row up, arrows move it, Space drops it,
Escape cancels; each step is announced. On compact the bell and the account sit in the header and the You tab
opens the You hub (`/feed/you`).

### States

Every surface designs five states before it ships: loading (a skeleton with the loaded layout's exact
dimensions), empty (one editorial line and one action), error (what went wrong and a retry), offline (what
still works), and partial (a section that failed inside a page that did not).

---

## 9. The polish bar

A UI ticket is done when its surfaces meet every line. Tickets cite this section rather than restating it.

- [ ] Built from `@vp/ui` primitives, `@vp/components` and the app's kit, and every placement is a smart wrapper
      taking the entity and its placement and reading the rest from hooks
      ([architecture section 5](architecture.md#5-smart-wrappers-in-the-apps)).
- [ ] Compound components for anything with more than one region, and every union prop typed by a shared
      option union, narrowed with `Extract` or `Exclude` ([architecture section 3](architecture.md#3-shared-option-unions)).
- [ ] Token-set aware: spacing, sizes, radii, borders, shadows, ambient and motion come from the token sets, so
      the surface looks right under every offered set (check compact and airy spacing, small and large sizing,
      the largest font size).
- [ ] No hex value, ramp step or palette class; no new
      CSS module or SCSS.
- [ ] Every state from section 8 exists and has a story.
- [ ] Every story renders in Sand and Nocturne, each in dark, light and OLED, with visual regression
      baselines; plus compact density, RTL and more contrast where the component has text.
- [ ] Layout holds from 320 px to 2560 px with no horizontal scroll; touch targets at least 44 px.
- [ ] Keyboard complete: every action reachable, focus order matches reading order, one visible focus ring,
      Escape closes what opened; axe reports nothing in any theme.
- [ ] Text meets 4.5:1 (3:1 at 24 px and up, and for control outlines and icons) in every theme and mode.
- [ ] Motion uses the motion tokens and stops under reduced motion; no layout shift on hover.
- [ ] CLS under 0.05 on the page's first load; hover and press respond within one frame.
- [ ] Copy from the message catalogue (`@vp/messages`), numbers and dates through `@vp/intl-react`, logical
      properties only (`inline-start`, never `left`).

---

## 10. Borrowing

Patterns are free to adopt: shelves, queues, hover previews, command palettes, docked chat. Another platform's
marks, colours, wordmarks, icons and licensed typefaces are not: no red play box, no purple or green brand
fields, no proprietary fonts or glass materials. Reference measurements of other products (breakpoints,
spacing, timings) are taken with `chrome-devtools-axi` and recorded as numbers in this folder, never as copied
assets, code or screenshots in the repo.
