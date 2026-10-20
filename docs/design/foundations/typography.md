# Typography

Three faces, eleven styles, four size steps. The summary is [README section 4](../README.md#4-type); this file is
the full specification. Faces, weights and tracking come from the `typography` token set (`set.typography`), sizes
and line heights from the `fontSize` set (`set.fontSize`), both in [`tokens.json`](../tokens.json); every value
and its CSS variable is in [token-sets.md](token-sets.md). A theme names a default for each, and the viewer can
change either at runtime.

## The three faces

| Face | Role | Why | Where it loads |
|---|---|---|---|
| Figtree Variable (`figtree`, Sand's default) or Geist Variable (`geist`, Nocturne's default) | all interface text | A theme's personality lives in its UI face: Figtree is round and friendly to match round controls, Geist is precise to match sharp corners | bundled `@fontsource-variable/*`; only the chosen set's fonts are fetched |
| Newsreader Variable | the editorial voice only | A serif reads as a person writing, not a system speaking, which is the curator in Taitube | `figtree` and `geist` |
| Geist Mono Variable | durations, timestamps, counts | Fixed-width digits line up in a column of durations and a seekbar time | `figtree` and `geist` |

The third implementation, `system`, uses the platform's own faces (`system-ui`, `ui-serif`, `ui-monospace`
stacks) and downloads nothing. A face and a theme are independent: Sand with `geist`, or Nocturne with `figtree`,
is a valid viewer choice, so no component may assume a face from the theme.

Fallback stacks, first-name aside: `ui-sans-serif, system-ui, sans-serif`; `ui-serif, Georgia, serif`;
`ui-monospace, SFMono-Regular, monospace`. Nothing loads from another host (README Rule 6, local-first).

## The scale

Sizes and line heights below are the `default` step of `fontSize`; weight and tracking are the same in every
`typography` implementation. The other three steps are in the next section.

| Style | Size | Line height | Weight | Tracking | Face | Use |
|---|---|---|---|---|---|---|
| `display` | 48 px | 1.05 | 800 | -0.035em | UI | channel name on the channel page, hero titles |
| `headline` | 32 px | 1.15 | 750 | -0.025em | UI | page titles, the watch title on large screens |
| `title-lg` | 22 px | 1.25 | 750 | -0.015em | UI | shelf and section headings, the watch title below large |
| `title` | 16 px | 1.35 | 650 | -0.005em | UI | card titles, two lines at most |
| `body` | 15 px | 1.55 | 400 | 0 | UI | descriptions, comments, settings copy |
| `body-sm` | 13 px | 1.5 | 400 | 0 | UI | metadata lines ("412K views · 2 days ago") |
| `label` | 14 px | 1.2 | 650 | 0 | UI | buttons, chips, tabs, nav items |
| `caption` | 12 px | 1.35 | 500 | 0.005em | UI | helper text, list timestamps, the reason label |
| `overline` | 11 px | 1.2 | 750 | 0.1em | UI, uppercase | card byline, section kickers |
| `editorial` | 20 px | 1.4 | 420 | -0.005em | Newsreader | Pick of the day note, curator lines, About |
| `mono` | 13 px | 1.3 | 500 | 0 | Geist Mono | durations, timestamps, aligned counts |

## The four size steps

The `fontSize` set re-sizes every style at once, keeping each line height ratio. It is the font-size control in
the settings area ([ticket 72](../../tickets/72-frontend-settings-customization-system.md)) and the first
accessibility lever a viewer reaches ([accessibility.md](accessibility.md)).

| Style | `small` | `default` | `large` | `xlarge` |
|---|---|---|---|---|
| `display` | 43 px | 48 px | 54 px | 60 px |
| `headline` | 29 px | 32 px | 36 px | 40 px |
| `title-lg` | 20 px | 22 px | 25 px | 28 px |
| `title` | 14 px | 16 px | 18 px | 20 px |
| `body` | 14 px | 15 px | 17 px | 19 px |
| `body-sm` | 12 px | 13 px | 15 px | 16 px |
| `label` | 13 px | 14 px | 16 px | 18 px |
| `caption` | 11 px | 12 px | 14 px | 15 px |
| `overline` | 11 px | 11 px | 12 px | 14 px |
| `editorial` | 18 px | 20 px | 22 px | 25 px |
| `mono` | 12 px | 13 px | 15 px | 16 px |

Line heights are identical across the steps (`display` 1.05 up to `body` 1.55; the table in
[token-sets.md](token-sets.md) lists them). Notes for a designer:

- `small` is one step down for dense large screens, `large` one step up for reading comfort, `xlarge` two steps
  up for low vision. Nothing is below 11 px at any step.
- The steps are not exact multiples, so text does not scale by a single factor; at `small`, `title` and `body`
  are both 14 px and are told apart by weight (650 against 400).
- A component never branches on the step. Layouts must survive `xlarge`: headings wrap, rows grow in height,
  and a chip or tab row scrolls rather than truncates. Test every story at `xlarge`.
- The step changes type only. Padding, control heights and icons follow `spacing` and `sizing`
  ([spacing-layout.md](spacing-layout.md)), so a viewer who wants bigger everything chooses both.

Tracking tightens as size grows (display -0.035em down to body 0) and opens only for the all-caps overline.
Weights 750, 650 and 420 are variable-font values, not named weights; do not round them to 700, 600, 400.

## Pairing rules

| Combination | Rule |
|---|---|
| `overline` over `title` | The card pattern: byline first, then title. `overline` is `fg-muted`, `title` is `fg` |
| `title-lg` beside an action | Shelf heading left, a `label` ghost button ("See all") at the inline end |
| `editorial` under a `display` or `headline` | Allowed, one block only: a curator note under its subject |
| `editorial` anywhere else | Never in a button, label, tab, nav item, card title or error |
| `caption` as a reason label | `accent-ink`, sentence case, one line, on shelves only |
| `mono` next to UI text | Same baseline, `fg-muted`, never larger than the text it sits beside |
| Two weights in one line | Only title plus a muted metadata run; never bold inside body copy for emphasis |

Headings (`display` through `title-lg`) use `text-wrap: balance`. Body copy uses the default wrap and stops at
`reading-max`, 68ch ([spacing-layout.md](spacing-layout.md)).

## Numerals

- `mono` always carries `font-variant-numeric: tabular-nums`. Use it for durations on thumbnails (`18:42`),
  seekbar time, chapter timestamps and any counter in a column.
- Counts in running text ("412K views", "1,284 comments") stay in the UI face; apply `tabular-nums` when the
  number changes live (viewer count, queue position "3 / 12"), so the width does not jitter.
- Formatting is never typed by hand: compact counts, grouping, and relative dates come from `@vp/intl-react`
  ([voice-and-copy.md](voice-and-copy.md)).
- Stat figures in Studio use the UI face at `headline` weight with `tabular-nums` (the CSS stand-in uses a
  28 px figure; that size is not a step in any `fontSize` implementation, so build it from `headline` until the set gains one).

## Truncation

| Text | Rule |
|---|---|
| Card title (grid, shelf) | 2 lines, then ellipsis (`line-clamp: 2`); the full title in the accessible name |
| Row card and queue title | 2 lines; the stand-in sets the row title to 14 px, a size outside the scale: use `label` or `title` |
| Card byline | 1 line, ellipsis, `overline` |
| Meta line | 1 line; drop the date before dropping the view count |
| Poster title (Shorts) | 2 lines over the scrim gradient |
| Now playing bar title | 1 line; channel on a second line, also 1 |
| Description in liner notes | 3 lines, then "more" |
| Hover-expanded card description | 2 lines |
| Chip, tab, button label | Never truncate: shorten the copy or let the row scroll horizontally |
| Pick of the day note | Never clamp: it is written to fit ([voice-and-copy.md](voice-and-copy.md)) |

Truncation is never the way to fit a translation: let the label wrap in a menu, or scroll in a chip bar.

## Responsive type

The scale itself does not change with the viewport. A surface may re-assign its style at a breakpoint, never
invent a size, and does it with a breakpoint variant of the type utility, so a component names both styles and
nothing else. README fixes the watch title; the channel name and page title follow the same rule.

| Surface | Compact (0 to 599 px) | Medium and up | Classes |
|---|---|---|---|
| Watch title | `title-lg` | `title-lg`, `headline` from 1440 px | `text-title-lg large:text-headline` |
| Channel name | `headline` | `display` | `text-headline medium:text-display` |
| Page title | `title-lg` | `headline` | `text-title-lg medium:text-headline` |
| Shelf heading | `title-lg` | `title-lg` | `text-title-lg` |
| Body, labels, captions | unchanged | unchanged | one `text-<style>` |

There is no per-surface utility (`text-page-title`): the pair of classes is the whole rule, and a surface not in
this table keeps one style at every width.

Density (the viewer setting) changes padding, gaps and component sizes only, never type size; the font-size step is its own setting.

## Editorial voice

`editorial` is the one place Taitube sounds like a person. It is Newsreader at 20 px by default (18 to 25 px across the steps), weight 420, in `fg`.
It belongs to: the Pick of the day note, a curator line under a shelf heading, a channel's About manifesto,
and an empty state's one line. Do not set it small (under 18 px, the `small` step's size, it loses its contrast of texture against the
sans), do not italicise it, and do not use it for anything the viewer must act on.

## RTL

- Use logical alignment (`text-start`, `text-end`); the stand-in uses `text-align: start` throughout.
- Newsreader and Geist Mono do not cover Arabic or Hebrew; the fallback stack supplies the glyphs, so test
  line height at 1.55 and the `overline` tracking: **set `letter-spacing: 0` for scripts that join letters**,
  and never uppercase them.
- Digits in `mono` stay left to right inside RTL text; wrap a duration or timestamp in a `dir="ltr"` span.
- Truncation ellipsis falls at the inline end in either direction (`line-clamp` handles it).

## Do and don't

| Do | Don't |
|---|---|
| Name the style (`title`, `caption`) | Write a one-off `font-size: 17px` |
| Use `label` for every interactive text | Use `body` weight 400 on a button |
| Set the byline in `overline` with `fg-muted` | Use a different small caps style per surface |
| Let `text-wrap: balance` break a heading | Insert manual line breaks in a title |
