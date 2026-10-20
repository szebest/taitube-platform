# Token sets

A **theme** owns an identity: its colour roles per mode and its dataviz palettes ([color.md](color.md)). Everything
else a viewer can feel, from the font and its size to how round the corners are, how dense the spacing is and how
much things move, belongs to a **token set**: one small, swappable implementation of one design dimension. A
theme only names which implementation of each group it starts from. This file lists every group, every
implementation and its values, resolved from [`tokens.json`](../tokens.json) (`set.<group>.<implementation>`), and
how they reach CSS and Tailwind. The build, the registry and the import shape are in
[architecture.md section 2](../architecture.md#2-themes-and-token-sets).

## What a token set is

- A **group** is a dimension: `typography`, `fontSize`, `spacing`, `sizing`, `radius`, `border`, `shadow`,
  `ambient`, `motion`. Nine groups, always all nine; a theme that leaves one undefined does not compile.
- An **implementation** is one complete answer for its group (`radius.round`, `shadow.flat`). Each one defines
  every key its group's schema asks for, so swapping one never leaves a hole.
- A component names a **role** (`rounded-card`, `gap-stack`, `h-control-md`), never a number. The set decides the
  number, so changing a set restyles every component at once and no component changes.
- A set is a runtime choice, not a build choice: each offered implementation compiles to one attribute-scoped
  CSS block, and a switch is an attribute change on `<html>` (`data-radius="soft"`). No reload.

| Group | Implementations | What it decides |
|---|---|---|
| `typography` | `figtree`, `geist`, `system` | font families, weight and tracking per type style |
| `fontSize` | `small`, `default`, `large`, `xlarge` | size and line height per type style |
| `spacing` | `compact`, `default`, `airy` | insets, gaps, section gap and gutters |
| `sizing` | `small`, `medium`, `large` | control, icon, avatar and layout measures |
| `radius` | `sharp`, `soft`, `round` | corner radius per role |
| `border` | `hairline`, `regular`, `bold` | divider, control and focus widths |
| `shadow` | `flat`, `soft`, `deep` | elevation 1 to 3 |
| `ambient` | `off`, `subtle`, `cinematic` | the video-sampled glow |
| `motion` | `standard`, `calm`, `reduced` | durations and easings |

Not every value is in a set. `scale.space` (the raw 4 px scale), `scale.z`, `scale.breakpoint` and
`scale.layout` (`content-max`, `reading-max`) are fixed for every theme and every viewer: see
[spacing-layout.md](spacing-layout.md) and [shape-elevation.md](shape-elevation.md).

## Theme defaults

Each theme names one implementation per group. These are the values a viewer gets until they change something.

| Group | Sand | Nocturne |
|---|---|---|
| `typography` | `figtree` | `geist` |
| `fontSize` | `default` | `default` |
| `spacing` | `default` | `default` |
| `sizing` | `medium` | `medium` |
| `radius` | `round` | `sharp` |
| `border` | `hairline` | `regular` |
| `shadow` | `soft` | `flat` |
| `ambient` | `cinematic` | `subtle` |
| `motion` | `standard` | `standard` |

Read across: Sand starts round, hairline-bordered, soft-shadowed and cinematic; Nocturne starts sharp,
regular-bordered, flat and subtle. Spacing, sizing, font size and motion start the same in both. The remaining
implementations in each group are one switch away for either theme. A theme's defaults must all be offered by the
registry, which a spec holds.

## How a choice resolves at runtime

1. Start from the theme's `defaults`, one implementation per group.
2. For each group, if the viewer has an **override** and the registry offers it, the override wins; otherwise
   the theme default does. An override that is no longer offered is ignored, not an error.
3. `prefers-reduced-motion: reduce` forces `motion` to `reduced` whatever the viewer chose or the theme says.
4. Each resolved implementation writes its CSS variables and sets its attribute on `<html>`.

| Rule | Detail |
|---|---|
| Overrides are sparse | only what the viewer changed is stored; a cleared override falls back to the theme default |
| A theme switch keeps choices | the viewer's overrides carry over to the new theme, and every group they did not touch re-defaults to the new theme |
| Density is two groups | the simple **Density** control writes `spacing` and `sizing` together: comfortable is the theme defaults (`default`, `medium`), compact is `compact` and `small`. The advanced page sets each group on its own |
| Apps may start differently | the studio starts on `compact` spacing and `small` sizing; that is an app default passed to the engine, below the viewer's own overrides |
| Mode is not a set | dark, light and OLED belong to the theme's colour roles; only `shadow` and `ambient` read the mode family (dark covers OLED) |
| Accent and contrast are not sets | an accent hex and the standard or more contrast setting sit beside the sets in the preference |

## What each set writes

Every implementation writes CSS custom properties under its attribute on `<html>` (`[data-radius="round"]`;
`shadow` and `ambient` once per mode family, `:is([data-mode="dark"], [data-mode="oled"])` and the light one),
with the same names [`lib/design.js`](../lib/design.js) writes for the stand-in. `@vp/design-tokens` generates
that CSS and the Tailwind block below; slice h writes them to files. The `<html>` attributes are `data-theme`,
`data-mode` and one per group: `data-typography`, `data-font-size`, `data-spacing`, `data-sizing`,
`data-radius`, `data-border`, `data-shadow`, `data-ambient`, `data-motion`.

| Group | CSS variables | Tailwind utilities |
|---|---|---|
| `typography` | `--font-sans`, `--font-editorial`, `--font-mono`; `--type-<style>-weight`, `--type-<style>-tracking` | `font-sans`, `font-editorial`, `font-mono`; the `text-<style>` utility reads weight and tracking too |
| `fontSize` | `--type-<style>-size`, `--type-<style>-line` | `text-display`, `text-headline`, `text-title-lg`, `text-title`, `text-body`, `text-body-sm`, `text-label`, `text-caption`, `text-overline`, `text-editorial`, `text-mono`: one utility sets size, line height, weight and tracking |
| `spacing` | `--inset-control`, `--inset-card`, `--gap-inline`, `--gap-stack`, `--gap-grid-x`, `--gap-grid-y`, `--gap-shelf`, `--section`, `--gutter-compact`, `--gutter-medium`, `--gutter-expanded` | `p-inset-control`, `px-inset-control`, `p-inset-card`, `gap-inline`, `gap-stack`, `gap-x-grid-x`, `gap-y-grid-y`, `gap-shelf`, `gap-section`, `py-section`, `px-gutter-compact`, `medium:px-gutter-medium`, `expanded:px-gutter-expanded` |
| `sizing` | `--size-control-sm|md|lg`, `--size-icon-sm|md|lg`, `--size-avatar-xs|sm|md|lg|xl`, `--layout-touch-target`, `--layout-header`, `--layout-rail-expanded`, `--layout-rail-collapsed`, `--layout-card-min`, `--layout-row-thumb` | `h-control-md`, `size-icon-md`, `size-avatar-lg`, `min-h-touch-target`, `min-w-touch-target`, `h-header`, `w-rail-expanded`, `w-rail-collapsed`, `min-w-card-min`, `w-row-thumb` |
| `radius` | `--r-xs`, `--r-sm`, `--r-thumb`, `--r-card`, `--r-sheet`, `--r-control`, `--r-chip` | `rounded-xs`, `rounded-sm`, `rounded-thumb`, `rounded-card`, `rounded-sheet`, `rounded-control`, `rounded-chip` |
| `border` | `--border-divider`, `--border-control`, `--border-focus`, `--border-focus-offset` | `border-divider`, `border-control`, `outline-focus`, `outline-offset-focus` |
| `shadow` | `--shadow-1`, `--shadow-2`, `--shadow-3` (the mode family's layers, comma-joined) | `shadow-1`, `shadow-2`, `shadow-3` |
| `ambient` | `--ambient` (opacity for the mode family), `--ambient-blur` | `opacity-ambient`, `blur-ambient` |
| `motion` | `--duration-instant|fast|base|slow|cinematic`, `--ease-standard|enter|exit|settle` | `duration-instant`, `duration-fast`, `duration-base`, `duration-slow`, `duration-cinematic`, `ease-standard`, `ease-enter`, `ease-exit`, `ease-settle` |

Fixed values also have variables and utilities, none of them from a set: `--space-<n>` (`p-4`, `gap-2`, the
Tailwind default numbers, which equal the 4 px scale), `--layout-content-max` and `--layout-reading-max`
(`max-w-content-max`, `max-w-reading-max`), and `--z-<layer>` with the `z-<layer>` utilities from `scale.z`
(`z-sticky`, `z-modal`).
Breakpoints are the screens `medium:`, `expanded:`, `large:` and `xlarge:`; compact is the unprefixed base.
Colour roles keep their own `--<role>` variables and `bg-surface text-fg-muted` utilities
([color.md](color.md)).

Notes on the mapping. A utility is named after its key, so the variable and the class say the same thing
(`--layout-card-min`, `min-w-card-min`); only the spacing roles drop their `gap-` prefix, because Tailwind already
writes it (`gap-stack`, not `gap-gap-stack`). The `border-<role>` width utilities (`border-divider`,
`border-control`) sit beside the colour utility of the `border` role, so a bordered control reads
`border-control border-border-strong`. The Tailwind block wipes the default palette, so `bg-stone-900` does not
exist; the default radius, shadow, duration and easing scales stay until r3 removes them (`rounded-xl`,
`shadow-lg` and `duration-300` still compile until then). The block is `@theme inline reference`: utilities
read the variables directly, and Tailwind never re-declares a self-named variable such as `--font-sans` or
`--shadow-1` on `:root`.
`lib/design.js` writes no variable for the ambient `sample` interval; it stays a value of the resolved set.

---

## The sets

Values only; the use of each role is in the foundation files linked from the README.

### `typography`

Families, weight and tracking per type style. The size and line height of each style come from `fontSize`.

| Implementation | Sans | Editorial | Mono | Note |
|---|---|---|---|---|
| `figtree` | Figtree Variable | Newsreader Variable | Geist Mono Variable | Warm, friendly UI face. Sand's default. |
| `geist` | Geist Variable | Newsreader Variable | Geist Mono Variable | Precise, technical UI face. Nocturne's default. |
| `system` | system-ui | ui-serif | ui-monospace | The platform's own faces: no font download at all. |

Full stacks (the first name loads from `@fontsource-variable/*`; `system` loads nothing):

| Implementation | Role | Stack |
|---|---|---|
| `figtree` | sans | Figtree Variable, ui-sans-serif, system-ui, sans-serif |
| `figtree` | editorial | Newsreader Variable, ui-serif, Georgia, serif |
| `figtree` | mono | Geist Mono Variable, ui-monospace, SFMono-Regular, monospace |
| `geist` | sans | Geist Variable, ui-sans-serif, system-ui, sans-serif |
| `geist` | editorial | Newsreader Variable, ui-serif, Georgia, serif |
| `geist` | mono | Geist Mono Variable, ui-monospace, SFMono-Regular, monospace |
| `system` | sans | system-ui, -apple-system, Segoe UI, sans-serif |
| `system` | editorial | ui-serif, Georgia, serif |
| `system` | mono | ui-monospace, SFMono-Regular, Menlo, monospace |

Weight and tracking per style (identical in all three implementations):

| Style | Weight | Tracking |
|---|---|---|
| `display` | 800 | -0.035em |
| `headline` | 750 | -0.025em |
| `title-lg` | 750 | -0.015em |
| `title` | 650 | -0.005em |
| `body` | 400 | 0em |
| `body-sm` | 400 | 0em |
| `label` | 650 | 0em |
| `caption` | 500 | 0.005em |
| `overline` | 750 | 0.1em |
| `editorial` | 420 | -0.005em |
| `mono` | 500 | 0em |

### `fontSize`

Size and line height per type style. Four steps; `default` is the reference scale.

| Style | `small` | `default` | `large` | `xlarge` |
|---|---|---|---|---|
| `display` | 43 px / 1.05 | 48 px / 1.05 | 54 px / 1.05 | 60 px / 1.05 |
| `headline` | 29 px / 1.15 | 32 px / 1.15 | 36 px / 1.15 | 40 px / 1.15 |
| `title-lg` | 20 px / 1.25 | 22 px / 1.25 | 25 px / 1.25 | 28 px / 1.25 |
| `title` | 14 px / 1.35 | 16 px / 1.35 | 18 px / 1.35 | 20 px / 1.35 |
| `body` | 14 px / 1.55 | 15 px / 1.55 | 17 px / 1.55 | 19 px / 1.55 |
| `body-sm` | 12 px / 1.5 | 13 px / 1.5 | 15 px / 1.5 | 16 px / 1.5 |
| `label` | 13 px / 1.2 | 14 px / 1.2 | 16 px / 1.2 | 18 px / 1.2 |
| `caption` | 11 px / 1.35 | 12 px / 1.35 | 14 px / 1.35 | 15 px / 1.35 |
| `overline` | 11 px / 1.2 | 11 px / 1.2 | 12 px / 1.2 | 14 px / 1.2 |
| `editorial` | 18 px / 1.4 | 20 px / 1.4 | 22 px / 1.4 | 25 px / 1.4 |
| `mono` | 12 px / 1.3 | 13 px / 1.3 | 15 px / 1.3 | 16 px / 1.3 |

Each cell is size / line height. `small`: One step down: denser text for large screens. `default`: The reference scale. `large`: One step up for reading comfort. `xlarge`: Two steps up for low vision.

### `spacing`

Semantic roles over the 4 px scale. Choosing `compact` is half of what the Density control does.

| Role | `compact` | `default` | `airy` |
|---|---|---|---|
| `inset-control` | 12 px | 18 px | 22 px |
| `inset-card` | 16 px | 20 px | 28 px |
| `gap-inline` | 8 px | 12 px | 16 px |
| `gap-stack` | 12 px | 16 px | 20 px |
| `gap-grid-x` | 14 px | 20 px | 28 px |
| `gap-grid-y` | 24 px | 36 px | 48 px |
| `gap-shelf` | 12 px | 16 px | 20 px |
| `section` | 28 px | 40 px | 56 px |
| `gutter-compact` | 12 px | 16 px | 20 px |
| `gutter-medium` | 16 px | 24 px | 32 px |
| `gutter-expanded` | 24 px | 32 px | 48 px |

| Role | Used for |
|---|---|
| `inset-control` | horizontal padding inside a button, input or chip |
| `inset-card` | padding inside a card, panel or dialog |
| `gap-inline` | gap in a row of controls or an icon and its label group |
| `gap-stack` | gap in a vertical stack of related things |
| `gap-grid-x`, `gap-grid-y` | column and row gap of a card grid |
| `gap-shelf` | gap between the cards of a horizontally scrolling shelf |
| `section` | gap between page sections |
| `gutter-compact`, `gutter-medium`, `gutter-expanded` | page side padding at the compact, medium, and expanded-and-up breakpoints |

### `sizing`

Control, icon and avatar sizes plus the layout measures. `ControlSize` and `IconSize` are the keys of `control` and `icon`.

| Key | `small` | `medium` | `large` |
|---|---|---|---|
| `control.sm` | 28 px | 32 px | 36 px |
| `control.md` | 36 px | 40 px | 44 px |
| `control.lg` | 44 px | 48 px | 52 px |
| `icon.sm` | 14 px | 16 px | 18 px |
| `icon.md` | 18 px | 20 px | 22 px |
| `icon.lg` | 22 px | 24 px | 26 px |
| `avatar.xs` | 16 px | 16 px | 20 px |
| `avatar.sm` | 24 px | 24 px | 28 px |
| `avatar.md` | 32 px | 36 px | 40 px |
| `avatar.lg` | 40 px | 44 px | 52 px |
| `avatar.xl` | 80 px | 96 px | 112 px |
| `layout.touch-target` | 44 px | 44 px | 48 px |
| `layout.header` | 56 px | 64 px | 72 px |
| `layout.rail-expanded` | 232 px | 248 px | 272 px |
| `layout.rail-collapsed` | 72 px | 76 px | 84 px |
| `layout.card-min` | 232 px | 300 px | 340 px |
| `layout.row-thumb` | 140 px | 168 px | 196 px |

`layout.touch-target` is the minimum hit area, never below 44 px; the `large` set raises it to 48 px. A control
smaller than the touch target extends its hit area with padding or a pseudo-element ([accessibility.md](accessibility.md)).

### `radius`

Corner radius per role; the roles are the `RadiusOption` union. Circular things (avatars, round icon buttons, the live dot) are `50%`, not a role.

| Role | `sharp` | `soft` | `round` |
|---|---|---|---|
| `xs` | 3 px | 4 px | 6 px |
| `sm` | 5 px | 8 px | 10 px |
| `thumb` | 6 px | 10 px | 14 px |
| `card` | 10 px | 16 px | 22 px |
| `sheet` | 14 px | 22 px | 30 px |
| `control` | 8 px | 10 px | 999 px |
| `chip` | 6 px | 999 px | 999 px |

Sand starts on `round`, Nocturne on `sharp`; `soft` is the middle step either can pick. Which component takes which role: [shape-elevation.md](shape-elevation.md).

### `border`

Border widths per role. `bold` pairs with the more-contrast setting but is its own choice.

| Role | `hairline` | `regular` | `bold` |
|---|---|---|---|
| `divider` | 1 px | 1 px | 1.5 px |
| `control` | 1 px | 1.5 px | 2 px |
| `focus` | 2 px | 2 px | 3 px |
| `focus-offset` | 2 px | 2 px | 3 px |

### `shadow`

Elevation steps 1 to 3, per mode family (`dark` covers OLED). Each layer is offset y, blur, spread, colour; x is 0 throughout. Step 0 is no shadow.

| Step | `flat` | `soft` | `deep` |
|---|---|---|---|
| 1 dark | none | 1 px, 2 px, 0 px, `#00000066` | 2 px, 3 px, 0 px, `#00000066` |
| 2 dark | none | 2 px, 4 px, 0 px, `#00000066` then 18 px, 40 px, -8 px, `#00000073` | 3 px, 6 px, 0 px, `#00000066` then 29 px, 64 px, -8 px, `#00000073` |
| 3 dark | none | 4 px, 8 px, 0 px, `#00000080` then 32 px, 64 px, -12 px, `#0000008C` | 6 px, 13 px, 0 px, `#00000080` then 51 px, 102 px, -12 px, `#0000008C` |
| 1 light | none | 1 px, 2 px, 0 px, `#2A1E1014` | 2 px, 3 px, 0 px, `#2A1E1014` |
| 2 light | none | 2 px, 4 px, 0 px, `#2A1E100F` then 16 px, 32 px, -8 px, `#2A1E101A` | 3 px, 6 px, 0 px, `#2A1E100F` then 26 px, 51 px, -8 px, `#2A1E101A` |
| 3 light | none | 4 px, 8 px, 0 px, `#2A1E1014` then 28 px, 56 px, -12 px, `#2A1E1024` | 6 px, 13 px, 0 px, `#2A1E1014` then 45 px, 90 px, -12 px, `#2A1E1024` |

`flat`: No shadows: surfaces separate by borders and steps of ground only. `soft`: Low, diffuse lift. `deep`: Pronounced depth for a more physical feel. Sand starts on `soft`, Nocturne on `flat`; with `flat` the ground steps and borders do all the separating.

### `ambient`

The glow sampled from the video behind the stage, the Pick of the day and the channel banner.

| Key | `off` | `subtle` | `cinematic` |
|---|---|---|---|
| `enabled` | false | true | true |
| `opacity-dark` | 0 | 0.3 | 0.6 |
| `opacity-light` | 0 | 0.15 | 0.25 |
| `blur` | 0 px | 56 px | 70 px |
| `sample` | 0 ms | 1000 ms | 500 ms |

`opacity-dark` applies in dark and OLED, `opacity-light` in light. `off` removes the glow layer and its sampling entirely; `sample` is the interval between frame samples.

### `motion`

Durations and easings. `prefers-reduced-motion` forces `reduced`, whatever is chosen.

| Token | `standard` | `calm` | `reduced` |
|---|---|---|---|
| `duration-instant` | 80 ms | 100 ms | 0 ms |
| `duration-fast` | 140 ms | 200 ms | 0 ms |
| `duration-base` | 220 ms | 320 ms | 120 ms |
| `duration-slow` | 360 ms | 480 ms | 160 ms |
| `duration-cinematic` | 560 ms | 720 ms | 200 ms |
| `ease-standard` | cubic-bezier(0.2, 0, 0, 1) | cubic-bezier(0.2, 0, 0, 1) | cubic-bezier(0, 0, 1, 1) |
| `ease-enter` | cubic-bezier(0.05, 0.7, 0.1, 1) | cubic-bezier(0.05, 0.7, 0.1, 1) | cubic-bezier(0, 0, 1, 1) |
| `ease-exit` | cubic-bezier(0.3, 0, 0.8, 0.15) | cubic-bezier(0.3, 0, 0.8, 0.15) | cubic-bezier(0, 0, 1, 1) |
| `ease-settle` | cubic-bezier(0.2, 0.8, 0.2, 1) | cubic-bezier(0.25, 0.6, 0.2, 1) | cubic-bezier(0, 0, 1, 1) |

`standard`: The reference timings. `calm`: Slower and gentler for viewers who find motion busy. `reduced`: Opacity only: every move is a cross-fade, and short. What each duration is for: [motion.md](motion.md).

## Do and don't

| Do | Don't |
|---|---|
| Name a role (`rounded-card`, `gap-stack`, `h-control-md`) | Write `rounded-2xl`, `gap-4` for a card stack, or `h-10` for a button |
| Test every story under each theme's defaults and under the extreme of every group (`sharp` and `round`, `compact` and `airy`, `small` and `xlarge`) | Judge a component under the defaults only |
| Add an implementation as one module and list it in the registry's `offer` | Add a branch on a set's name inside a component |
| Let a component read a variable and the viewer's choice follow | Copy a set's value into a component or a story |
| Keep a hit area at `layout.touch-target` under every sizing set | Shrink a target because `small` sizing is chosen |
