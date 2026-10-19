# Spacing and layout

The summary is [README sections 5 and 7](../README.md#7-layout-and-the-shell). Three things carry the numbers:
the fixed `scale` in [`tokens.json`](../tokens.json) (`scale.space`, `scale.breakpoint`, `scale.layout`), the
`spacing` token set (roles for insets, gaps, sections and gutters), and the `sizing` token set (control, icon,
avatar and layout measures). A theme names a default of each set and the viewer can change them
([token-sets.md](token-sets.md)). Measures below are the `default` spacing and `medium` sizing unless a column
says otherwise.

## Raw scale, spacing roles and sizing: which one to use

| Need | Use | Example |
|---|---|---|
| Padding inside a component, gap between siblings, gap between sections, a page gutter | a **spacing role** (`spacing` set) | `gap-stack`, `p-inset-card`, `py-section`, `px-gutter-medium` |
| The height of a control, an icon, an avatar, the header, the rail, the card minimum | a **sizing** value (`sizing` set) | `h-control-md`, `size-icon-md`, `h-header`, `min-w-card-min` |
| A one-off gap no role names (a hairline nudge, a decorative offset) | the raw **4 px scale** | `gap-2`, `mt-1` |

Rule of thumb: if the number should change when the viewer picks compact or airy, it is a role; if it should
not, and it is not a measure, it is the raw scale. A component reaches for the raw scale last.

## The raw 4 px scale

`scale.space`: fixed, the same in every theme and for every viewer. Its numbers are Tailwind's own spacing
indices, so `p-4` is 16 px.

| Token | Value | Typical use |
|---|---|---|
| `space-0` | 0 | reset |
| `space-1` | 4 px | icon to label inside a tight control, segmented control padding |
| `space-2` | 8 px | between a badge and its edge, icon buttons in a row |
| `space-3` | 12 px | default `gap` of a row of controls, menu item padding |
| `space-4` | 16 px | default `gap` of a stack, compact gutter, card text rhythm |
| `space-5` | 20 px | card padding (comfortable), grid column gap |
| `space-6` | 24 px | dialog padding, medium gutter, tab spacing |
| `space-8` | 32 px | expanded gutter, page top padding |
| `space-10` | 40 px | gap between home sections |
| `space-12` | 48 px | page section gap in the stand-in |
| `space-16` | 64 px | empty state vertical padding |
| `space-20` | 80 px | spacing before a footer-like region |
| `space-24` | 96 px | bottom page padding, clearing the now playing bar |

Rules: siblings are separated by `gap`, never by margins; a value outside the table is a bug (the stand-in
uses 6, 10 and 14 px in a few places for control internals, which the real primitives round to 4 or 8 on
purpose to stay on the scale); touch targets are sized by `layout.touch-target` (44 px, 48 px at `large`
sizing), not by the scale. The typical-use column names the raw step; where a spacing role exists it replaces
the step (card padding is `inset-card`, a stack gap is `gap-stack`).

## The spacing roles

`spacing` set, three implementations. The roles are what components use.

| Role | `compact` | `default` | `airy` | Used for |
|---|---|---|---|---|
| `inset-control` | 12 px | 18 px | 22 px | horizontal padding in a button, input or chip |
| `inset-card` | 16 px | 20 px | 28 px | padding in a card, panel or dialog |
| `gap-inline` | 8 px | 12 px | 16 px | a row of controls, an icon and its label group |
| `gap-stack` | 12 px | 16 px | 20 px | a vertical stack of related things |
| `gap-grid-x` | 14 px | 20 px | 28 px | column gap of a card grid |
| `gap-grid-y` | 24 px | 36 px | 48 px | row gap of a card grid |
| `gap-shelf` | 12 px | 16 px | 20 px | between cards in a scrolling shelf |
| `section` | 28 px | 40 px | 56 px | between page sections |
| `gutter-compact` | 12 px | 16 px | 20 px | page side padding, 0 to 599 px |
| `gutter-medium` | 16 px | 24 px | 32 px | page side padding, 600 to 1023 px |
| `gutter-expanded` | 24 px | 32 px | 48 px | page side padding, 1024 px and up |

The roles replace the one-off numbers of the stand-in: its 20 px card padding is `inset-card`, its 36 px row
gap is `gap-grid-y`, its 48 px page section gap is `section` (40 px at `default`; the stand-in predates the set).

## The sizing set

`sizing` set, three implementations. `ControlSize` and `IconSize` are the keys of `control` and `icon`.

| Key | `small` | `medium` | `large` |
|---|---|---|---|
| `control.sm`, `md`, `lg` | 28, 36, 44 px | 32, 40, 48 px | 36, 44, 52 px |
| `icon.sm`, `md`, `lg` | 14, 18, 22 px | 16, 20, 24 px | 18, 22, 26 px |
| `avatar.xs`, `sm`, `md`, `lg`, `xl` | 16, 24, 32, 40, 80 px | 16, 24, 36, 44, 96 px | 20, 28, 40, 52, 112 px |
| `layout.touch-target` | 44 px | 44 px | 48 px |
| `layout.header` | 56 px | 64 px | 72 px |
| `layout.rail-expanded` | 232 px | 248 px | 272 px |
| `layout.rail-collapsed` | 72 px | 76 px | 84 px |
| `layout.card-min` | 232 px | 300 px | 340 px |
| `layout.row-thumb` | 140 px | 168 px | 196 px |

The layout measures (header, rail, card minimum, row thumbnail) live here rather than in `scale.layout`
because they change with sizing; `scale.layout` keeps only `content-max` and `reading-max`, which never do.

## Density

**Density** is not a token: it is one control that writes two sets together. Comfortable is the theme's
defaults (`spacing.default` and `sizing.medium` for both themes today); compact is `spacing.compact` and
`sizing.small`. The advanced settings page sets each group on its own, so a viewer can have compact spacing with
medium sizing, or airy spacing with small controls. Studio starts on compact and small.

| Element | Comfortable (`default` + `medium`) | Compact (`compact` + `small`) |
|---|---|---|
| Grid row gap (`gap-grid-y`) | 36 px | 24 px |
| Grid column gap (`gap-grid-x`) | 20 px | 14 px |
| Card padding (`inset-card`) | 20 px | 16 px |
| Stack gap (`gap-stack`) | 16 px | 12 px |
| Section gap (`section`) | 40 px | 28 px |
| Gutters, compact, medium, expanded | 16, 24, 32 px | 12, 16, 24 px |
| Control height `md` | 40 px | 36 px |
| Icon `md` | 20 px | 18 px |
| Header | 64 px | 56 px |
| Card minimum width (`card-min`) | 300 px | 232 px |

Density never changes type size (the `fontSize` set does) and never takes the touch target below 44 px:
controls get smaller, hit areas do not. Unlike the earlier multiplier model, horizontal gutters do change with
`spacing`.

## Breakpoints and the shell

Lower bounds from `scale.breakpoint`; compact is 0 to 599.

| Name | From | Shell | Gutter | Nav |
|---|---|---|---|---|
| compact | 0 | header with search icon, bottom tab bar, now playing bar above the tabs | `gutter-compact` (16 px) | Home, Shorts, Subscriptions, You |
| medium | 600 px | header, collapsed rail (76 px) | `gutter-medium` (24 px) | icon rail |
| expanded | 1024 px | header, collapsed rail, opens to the expanded rail (248 px) on demand | `gutter-expanded` (32 px) | rail, toggled by the menu button |
| large | 1440 px | header, open rail | `gutter-expanded` | full rail |
| xlarge | 1920 px | as large, content capped | `gutter-expanded` | full rail |

Pixel values in brackets are `default` spacing and `medium` sizing; the rail, header and gutter widths follow
the chosen sets. `xlarge` exists in the token file but not in the README table: it adds no new shell, only the
point where a fifth card column fits. There is no `gutter-large` role, so large and up reuse `gutter-expanded`.

### Compact (0 to 599)

```
┌──────────────────────────┐
│ =  taitube        s + a │  header 64
├──────────────────────────┤
│ chip bar (scrolls)       │
│ ┌──────────────────────┐ │  one card column, gutter 16
│ │ thumbnail            │ │
│ └──────────────────────┘ │
│ ┌ now playing ─────────┐ │  above the tab bar
├──────────────────────────┤
│ Home Shorts Subs You│  tab bar
└──────────────────────────┘
```

### Medium (600 to 1023)

```
┌────────────────────────────────────────────┐
│ =  taitube     [ search ]        + n a    │  header 64
├────┬───────────────────────────────────────┤
│ H  │  card   card                          │  rail 76, gutter 24
│ >  │  card   card                          │
│ o  │                                       │
└────┴───────────────────────────────────────┘
```

### Expanded (1024 to 1439)

```
┌─────────────────────────────────────────────────────────┐
│ =  taitube      [ search ]              + n a          │  header 64
├────┬────────────────────────────────────────────────────┤
│ H  │  card    card    card                               │  rail 76 (248 open)
│ >  │  card    card    card                               │  gutter 32
└────┴────────────────────────────────────────────────────┘
```

### Large (1440 and up)

```
┌──────────────────────────────────────────────────────────────────┐
│ =  taitube         [ search ]                      + n a        │  header 64
├────────────┬─────────────────────────────────────────────────────┤
│ Home       │  card     card     card     (4 to 6 columns)         │  rail 248
│ Shorts     │  card     card     card                              │
│ ...        │          ┌ now playing bar spans the content ┐       │
└────────────┴──────────┴────────────────────────────────────┴──────┘
```

The stand-in CSS opens the rail to `rail-expanded` (248 px) at 1024 and up and collapses it only below; the README keeps it
collapsed until 1440. Follow the README until ticket 95's `AppShell` slice aj settles it.

## Grids

Cards sit in `repeat(auto-fill, minmax(card-min, 1fr))` with `gap-grid-x` between columns and `gap-grid-y`
between rows. Columns that fit depend on three things at once: `card-min` and the rails (`sizing`), the gap and
the gutters (`spacing`), and `content-max` (fixed at 2200 px, gutters included). Each cell is content width and
columns, for three useful pairings; the rail is collapsed below 1440 px and open from it, from 600 px up.

| Viewport | `default` + `medium` (min 300, gap 20) | `compact` + `small` (min 232, gap 14) | `airy` + `large` (min 340, gap 28) |
|---|---|---|---|
| 390 | 358 px, 1 | 366 px, 1 | 350 px, 1 |
| 768 | 644 px, 2 | 664 px, 2 | 620 px, 1 |
| 1024 | 884 px, 2 | 904 px, 3 | 844 px, 2 |
| 1440 | 1128 px, 3 | 1160 px, 4 | 1072 px, 2 |
| 1920 | 1608 px, 5 | 1640 px, 6 | 1552 px, 4 |
| 2560 | 2136 px, 6 | 2152 px, 8 | 2104 px, 5 |

Shelves scroll horizontally with a snap: video columns are 260 px minimum, posters 160 to 180 px, with a
`gap-shelf` gap (16 px at `default`). Shorts posters are 9:16, video thumbnails 16:9; the aspect box is reserved before the image loads so CLS
stays under 0.05.

## Content and reading widths

| Token | Value | Applies to |
|---|---|---|
| `scale.layout.content-max` | 2200 px | the page container, centred beyond it |
| `scale.layout.reading-max` | 68ch | description, comments, About, any paragraph over 3 lines |
| `sizing` `rail-expanded` | 232, 248 or 272 px | open rail (`small`, `medium`, `large`) |
| `sizing` `rail-collapsed` | 72, 76 or 84 px | collapsed rail |
| `sizing` `header` | 56, 64 or 72 px | header height, also the sticky offset of the rail |
| `sizing` `touch-target` | 44, 44 or 48 px | minimum hit area |
| `sizing` `row-thumb` | 140, 168 or 196 px | thumbnail width in a row card and a queue row |

## Shell anatomy

| Part | Measure | Behaviour |
|---|---|---|
| Header | `header` tall (64 px), sticky, `z-sticky` | menu button, mark (`accent`), search field (opens the palette, 680 px max), Create, notifications, account |
| Rail, open | `rail-expanded` (248 px), sticky below the header, scrolls on its own | Home, Shorts, Subscriptions, Live; You; subscribed channels with a live dot. Items 42 px tall, icon 20, gap 16 |
| Rail, collapsed | `rail-collapsed` (76 px) | icon over a 10 px label, group headings and subscribed channels hidden |
| Tab bar | compact only, fixed bottom, safe-area padding | four items: icon 20 over an 11 px label, selected item `accent-ink` |
| Now playing bar | spans the content column, 16 px above the bottom (72 px on compact, clearing the tabs), 8 to 16 px side inset | 16:9 live picture (128 px wide, 88 on compact), title, channel, play, next, queue count, expand |
| Main | fluid, bottom padding 120 px so nothing hides behind the bar | gap between sections is `section` |

The diagrams above and the bracketed figures are drawn at `medium` sizing and `default` spacing.

Do: reserve the bottom padding on every page. Don't: add a left margin to account for the rail; the shell
owns the column, and a page never knows whether the rail is open.
