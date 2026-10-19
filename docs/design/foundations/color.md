# Colour

Three tiers, resolved top to bottom: raw **ref** ramps, semantic **theme** roles that alias them, and
**dataviz** palettes for charts. Components only ever name a role. The summary lives in
[README sections 2 and 3](../README.md#3-colour-roles); this file lists every value and the rules behind it.

Colour is the one thing a theme still owns outright. Everything else a viewer can change, from type and spacing
to radius, shadow and motion, is a token set ([token-sets.md](token-sets.md)); a theme only names the default
implementation of each set (`theme.<name>.defaults`: Sand starts `figtree`, `round`, `hairline`, `soft`,
`cinematic`; Nocturne `geist`, `sharp`, `regular`, `flat`, `subtle`). A colour role never depends on a set, and a
set never changes a colour, so any theme can be combined with any implementation. The accent override and the
contrast setting (standard or more) stay outside the sets too; the `bold` border set is a separate choice that
pairs with more contrast ([shape-elevation.md](shape-elevation.md)).

## Tier 1: ref ramps

Ramps are raw material. Only a theme file picks a step; no component, story or CSS rule does.

| Ramp | Used by | Steps |
|---|---|---|
| `sand` | Sand grounds and text | `0` #FFFCF7, `50` #F6F2EB, `75` #EFE9E0, `100` #EDE6DB, `200` #DED5C6, `300` #C9BFAE, `400` #A89F92, `500` #8A8072, `600` #6B6256, `700` #4A433A, `800` #332E27, `850` #26221D, `900` #1C1915, `950` #14120F, `1000` #0C0B09 |
| `ochre` | Sand accent | `100` #F5EAD4, `200` #EAD5AA, `300` #DDBF85, `400` #D2B076, `500` #C9A66B, `600` #A8864D, `700` #86683A, `800` #5E4828, `900` #3A2C18 |
| `ink` | Nocturne grounds and text | `0` #FFFFFF, `50` #F5F7FA, `75` #EDF1F7, `100` #ECF0F5, `200` #DCE3EC, `300` #BAC3D2, `400` #97A3B7, `500` #7A8599, `600` #5B6578, `700` #3A4660, `800` #263044, `850` #1A2130, `900` #121722, `950` #0B0E14, `1000` #06080C |
| `amber` | Nocturne accent | `100` #FFF1DA, `200` #FFDFAD, `300` #FFD08A, `400` #FFC266, `500` #FFB547, `600` #E09A2E, `700` #B07620, `800` #7A5216, `900` #4A310C |
| `signal` | Both themes, status | `live` #D91F3A, `red-300` #F59298, `red-600` #C8323C, `red-700` #A3242E, `green-300` #8CC79D, `green-700` #2F7A47, `coral-300` #F7A27A, `coral-700` #A9481F, `blue-300` #93B4DE, `blue-700` #3D6595, `black` #000000, `white` #FFFFFF |

The `75` steps are the dark-mode text colour (`fg`); `0` is the light-mode surface; `950` and `900` are the dark
grounds; `1000` is the OLED surface. Ochre and amber steps `600`, `800` and `900` appear only in hover, ink and
sequential palettes.

## Tier 2: theme roles

Each role, its use, and its value per theme and mode. OLED lists only four overrides (`bg`, `surface`,
`raised`, `border`); every other OLED value is the dark value. Translucent values are `RRGGBBAA`.

| Role | Use | Sand dark | Sand light | Sand oled | Nocturne dark | Nocturne light | Nocturne oled |
|---|---|---|---|---|---|---|---|
| `bg` | page ground | `#14120F` | `#F6F2EB` | `#000000` | `#0B0E14` | `#F5F7FA` | `#000000` |
| `surface` | cards, panels, search field, now playing bar | `#1C1915` | `#FFFCF7` | `#0C0B09` | `#121722` | `#FFFFFF` | `#06080C` |
| `raised` | menus, popovers, toasts, expanded card | `#26221D` | `#FFFCF7` | `#1C1915` | `#1A2130` | `#FFFFFF` | `#121722` |
| `border` | dividers, card outlines | `#332E27` | `#DED5C6` | `#26221D` | `#263044` | `#DCE3EC` | `#1A2130` |
| `border-strong` | field and control outlines | `#8A8072` | `#8A8072` | `#8A8072` | `#5B6578` | `#7A8599` | `#5B6578` |
| `fg` | text, icons | `#EFE9E0` | `#1C1915` | `#EFE9E0` | `#EDF1F7` | `#121722` | `#EDF1F7` |
| `fg-muted` | metadata, secondary text | `#A89F92` | `#6B6256` | `#A89F92` | `#97A3B7` | `#5B6578` | `#97A3B7` |
| `fg-subtle` | placeholder, disabled only | `#8A8072` | `#8A8072` | `#8A8072` | `#7A8599` | `#7A8599` | `#7A8599` |
| `tint` | secondary button, hover, skeleton base | `#FFFAF012` | `#1C19150F` | `#FFFAF012` | `#EDF1F712` | `#1217220F` | `#EDF1F712` |
| `tint-strong` | pressed, selected chip, skeleton highlight | `#FFFAF01F` | `#1C19151A` | `#FFFAF01F` | `#EDF1F721` | `#1217221A` | `#EDF1F721` |
| `accent` | primary fill, progress, selection | `#C9A66B` | `#86683A` | `#C9A66B` | `#FFB547` | `#B07620` | `#FFB547` |
| `accent-hover` | primary hover | `#D2B076` | `#5E4828` | `#D2B076` | `#FFC266` | `#7A5216` | `#FFC266` |
| `on-accent` | text on accent | `#14120F` | `#FFFCF7` | `#14120F` | `#0B0E14` | `#0B0E14` | `#0B0E14` |
| `accent-ink` | accent as text: links, active label | `#D2B076` | `#86683A` | `#D2B076` | `#FFC266` | `#7A5216` | `#FFC266` |
| `accent-soft` | selected nav item, soft badge ground | `#C9A66B29` | `#F5EAD4` | `#C9A66B29` | `#FFB54726` | `#FFF1DA` | `#FFB54726` |
| `focus-ring` | the one focus ring | `#D2B076` | `#86683A` | `#D2B076` | `#FFC266` | `#7A5216` | `#FFC266` |
| `live` | live badge, pulse | `#D91F3A` | `#D91F3A` | `#D91F3A` | `#D91F3A` | `#D91F3A` | `#D91F3A` |
| `on-live` | text on live | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` |
| `danger` | destructive fill | `#C8323C` | `#C8323C` | `#C8323C` | `#C8323C` | `#C8323C` | `#C8323C` |
| `danger-ink` | destructive text, field errors | `#F59298` | `#A3242E` | `#F59298` | `#F59298` | `#A3242E` | `#F59298` |
| `success-ink` | success text | `#8CC79D` | `#2F7A47` | `#8CC79D` | `#8CC79D` | `#2F7A47` | `#8CC79D` |
| `warning-ink` | warning text | `#F7A27A` | `#A9481F` | `#F7A27A` | `#F7A27A` | `#A9481F` | `#F7A27A` |
| `info-ink` | info text | `#93B4DE` | `#3D6595` | `#93B4DE` | `#93B4DE` | `#3D6595` | `#93B4DE` |
| `scrim` | behind dialogs, under text on video | `#0C0B09B8` | `#1C191599` | `#0C0B09B8` | `#06080CB8` | `#12172299` | `#06080CB8` |
| `media` | behind video | `#000000` | `#000000` | `#000000` | `#000000` | `#000000` | `#000000` |

Reading the table: light mode moves the accent from the 500 step to the 700 step so a filled button and the
progress bar clear 3:1 on paper, and moves the hover to 800 (darker on hover, where dark mode goes lighter).
Nocturne light takes `amber-800` for `accent-ink` and `focus-ring` because `amber-700` is 3.6:1 on `ink-50`.

## Tier 3: dataviz

Studio charts only; never the UI roles (README section 3). Categorical series are ordered: assign series 1 to
the first colour and never re-sort.

| Palette | Sand | Nocturne |
|---|---|---|
| `categorical-dark` | #C9A66B, #8FB89A, #7FA3D1, #D98A6C, #B59AD6, #5FB3AE | #FFB547, #6CB6FF, #5FD3A8, #FF8A65, #A992FF, #F27BAE |
| `categorical-light` | #86683A, #3F7A52, #3D6595, #A9512F, #6E54A0, #237A74 | #8A5A10, #1E6FC2, #1D8A63, #C2502D, #6A4FD0, #B83F78 |
| `sequential` | `ochre` 100, 300, 500, 700, 900 | `amber` 100, 300, 500, 700, 900 |
| `diverging` | #A9512F, #D98A6C, `sand-300`, #5FB3AE, #237A74 | #C2502D, #FF8A65, `ink-300`, #6CB6FF, #1E6FC2 |

Rules: never encode meaning in hue alone (add a label, a marker shape or a pattern); the series colours are
checked against `surface`, so a chart sits on `surface`, not on `bg`; OLED uses the dark palettes.

## Enforced contrast pairs

Measured from the resolved values above (WCAG relative luminance; translucent roles composited over `bg`).
Floors: 4.5:1 text, 3:1 for control outlines, focus ring, icons and large text (24 px and up). Column order is
Sand dark, light, oled, Nocturne dark, light, oled.

| Pair | Floor | S dark | S light | S oled | N dark | N light | N oled |
|---|---|---|---|---|---|---|---|
| `fg` on `bg` | 4.5 | 15.49 | 15.69 | 17.40 | 17.04 | 16.70 | 18.53 |
| `fg` on `surface` | 4.5 | 14.51 | 17.11 | 16.30 | 15.82 | 17.93 | 17.68 |
| `fg` on `raised` | 4.5 | 13.09 | 17.11 | 14.51 | 14.21 | 17.93 | 15.82 |
| `fg-muted` on `bg` | 4.5 | 7.16 | 5.37 | 8.04 | 7.58 | 5.47 | 8.24 |
| `fg-muted` on `surface` | 4.5 | 6.70 | 5.85 | 7.53 | 7.03 | 5.87 | 7.86 |
| `fg-muted` on `raised` | 4.5 | 6.05 | 5.85 | 6.70 | 6.32 | 5.87 | 7.03 |
| `border-strong` on `bg` | 3 | 4.82 | 3.48 | 5.41 | 3.29 | 3.47 | 3.58 |
| `border-strong` on `surface` | 3 | 4.51 | 3.79 | 5.07 | 3.05 | 3.72 | 3.41 |
| `on-accent` on `accent` | 4.5 | 8.15 | 5.06 | 8.15 | 10.99 | 5.02 | 10.99 |
| `on-accent` on `accent-hover` | 4.5 | 9.09 | 8.43 | 9.09 | 12.11 | 2.80 | 12.11 |
| `accent-ink` on `bg` | 4.5 | 9.09 | 4.64 | 10.21 | 12.11 | 6.42 | 13.16 |
| `accent-ink` on `surface` | 4.5 | 8.52 | 5.06 | 9.57 | 11.24 | 6.89 | 12.56 |
| `accent-ink` on `accent-soft` | 4.5 | 6.91 | 4.34 | 8.34 | 9.22 | 6.19 | 10.58 |
| `fg` on `accent-soft` | 4.5 | 11.77 | 14.68 | 14.21 | 12.98 | 16.09 | 14.90 |
| `accent` on `bg` | 3 | 8.15 | 4.64 | 9.15 | 10.99 | 3.58 | 11.95 |
| `focus-ring` on `bg` | 3 | 9.09 | 4.64 | 10.21 | 12.11 | 6.42 | 13.16 |
| `focus-ring` on `surface` | 3 | 8.52 | 5.06 | 9.57 | 11.24 | 6.89 | 12.56 |
| `on-live` on `live` | 4.5 | 4.99 | 4.99 | 4.99 | 4.99 | 4.99 | 4.99 |
| `danger-ink` on `bg` | 4.5 | 8.41 | 6.61 | 9.45 | 8.69 | 6.87 | 9.45 |
| `danger-ink` on `surface` | 4.5 | 7.88 | 7.20 | 8.85 | 8.07 | 7.37 | 9.02 |
| `success-ink` on `bg` | 4.5 | 9.59 | 4.71 | 10.77 | 9.91 | 4.90 | 10.77 |
| `success-ink` on `surface` | 4.5 | 8.98 | 5.14 | 10.09 | 9.20 | 5.26 | 10.28 |
| `warning-ink` on `bg` | 4.5 | 9.26 | 5.18 | 10.40 | 9.57 | 5.38 | 10.40 |
| `warning-ink` on `surface` | 4.5 | 8.68 | 5.65 | 9.75 | 8.88 | 5.78 | 9.93 |
| `info-ink` on `bg` | 4.5 | 8.75 | 5.39 | 9.82 | 9.04 | 5.60 | 9.82 |
| `info-ink` on `surface` | 4.5 | 8.19 | 5.87 | 9.20 | 8.39 | 6.01 | 9.38 |
| white on `scrim` over `media` | 4.5 | 20.03 | 19.14 | 20.03 | 20.30 | 19.34 | 20.30 |
| `fg-subtle` on `bg` (advisory, never read) | none | 4.82 | 3.48 | 5.41 | 5.19 | 3.47 | 5.64 |

Every pair meets its floor in every theme and mode (checked over `tokens.json`, translucent roles composited
over `bg`). `fg-muted` is 7:1 or more in dark and OLED and above 4.5:1 in light; `on-live` on `live` is 4.99.

## Rules

**Accent override (`deriveAccent(hex, family)`).** A viewer's accent replaces `accent`, `accent-hover`,
`accent-ink`, `accent-soft`, `focus-ring` and `on-accent` and nothing else. It steps lightness in OKLCH, keeping
the hue, until each pair meets its floor for the mode family (OLED counts as dark): `on-accent` on `accent` 4.5,
`accent-ink` 4.5 and `focus-ring` and `accent` 3 against `ACCENT_GROUNDS`, the lightest dark and darkest light
ground any theme puts the accent on, so they hold on `bg` and `surface` of every theme. `accent-soft` is `accent`
at alpha `29`, and `accent-ink` also clears 4.5 on it composited over the ground. `accent-hover` moves up to
0.05 OKLCH lightness away from `on-accent` where that holds both floors (`on-accent` on it 4.5, it on the ground
3) and toward it otherwise; only where neither direction holds is it `accent` itself. A malformed hex comes back as a `VALIDATION_FAILED`
failure, never as a colour. Hostile inputs (pure yellow, near-white, near-black, the ground
colour) must still produce a passing set, which is why the gate has its own table. An override never touches
`live`, `danger` or any status role.

**Status.** `live` red is for live and recording only: the badge, the pulse, the live avatar ring, the live
dot in the rail. Errors use `danger` and `danger-ink`, never `live`. `success-ink`, `warning-ink` and
`info-ink` are text colours and always sit beside their icon (`check`, `alert`, `info`), so colour is never the
only signal. Nocturne warns in coral because amber is its accent.

**Colour on video.** Anything over a thumbnail or the player takes `scrim` for its ground (duration chip,
chapter label, badge) and white text, 19 to 20:1. The player gradient is black to transparent, not a role.
`media` is black in every mode. The ambient glow is sampled from the video and shown, under the default
`cinematic` set, at 0.6 opacity in dark and OLED, 0.25 in light (`subtle`: 0.3 and 0.15; `off`: none). It is an
`ambient` token set, not a colour role ([token-sets.md](token-sets.md)).

**Do and don't.**

| Do | Don't |
|---|---|
| `bg-surface text-fg-muted` through role utilities | `bg-stone-900`, `#1C1915`, any palette class |
| Use `accent-ink` for a link or active label | Use `accent` as text colour |
| Pair `warning-ink` with the `alert` icon | Show a warning as coloured text alone |
| Use `tint` for hover on any ground | Hard-code a grey for hover |
| Keep the accent for the viewer's own actions and position | Colour a status, a category or a decoration with it |

## Adding a role

1. Add the name to `ROLES` in `@vp/design-tokens`, the one list; the `Theme` schema is built from it, so every
   theme missing it fails to parse.
2. Give it a value in `dark` and `light` in both `@vp/ui/themes/sand` and `@vp/ui/themes/nocturne`; add it to
   `oled` only if it differs from dark.
3. If it is text or a control boundary, add its pair to the contrast gate with the floor.
4. Run `pnpm gen:tokens`, which regenerates the CSS, the Tailwind mapping and `tokens.json`; add the role to the
   table in README section 3 and here.
