# Shape and elevation

Summary in [README section 5](../README.md#5-shape-space-elevation-motion). Radius roles come from the `radius`
set, border widths from the `border` set, shadows from the `shadow` set (all `set.<group>` in
[`tokens.json`](../tokens.json)), layers from `scale.z`. A theme names a default implementation of each set
(Sand: `round`, `hairline`, `soft`; Nocturne: `sharp`, `regular`, `flat`) and the viewer can switch any of them
([token-sets.md](token-sets.md)). Components name a role and never a number, so every table below holds under
every implementation.

## Radius roles

A component names a role; the `radius` set decides the number. Three implementations: `sharp` (Nocturne's
default), `soft`, and `round` (Sand's default).

| Role | `sharp` | `soft` | `round` | Meaning |
|---|---|---|---|---|
| `xs` | 3 px | 4 px | 6 px | badges, duration chips, the keyboard key |
| `sm` | 5 px | 8 px | 10 px | menu items, queue rows, the now playing thumbnail |
| `thumb` | 6 px | 10 px | 14 px | video frames (thumbnails, posters, the spotlight picture) |
| `card` | 10 px | 16 px | 22 px | panels, cards, menus, the player, the callout |
| `sheet` | 14 px | 22 px | 30 px | dialogs and sheets |
| `control` | 8 px | 10 px | 999 px | buttons, inputs, search, toasts, segmented control, switch track |
| `chip` | 6 px | 999 px | 999 px | chips, pills, the engagement bar |

Utilities are `rounded-xs`, `rounded-sm`, `rounded-thumb`, `rounded-card`, `rounded-sheet`, `rounded-control`
and `rounded-chip`. Pairing `round` with Sand's `figtree` and `sharp` with Nocturne's `geist` is a default, not
a rule: the faces and corners are independent choices.

`xs` and `sm` are in the token file and the stand-in but not in README section 5, which names five roles.
Circular things (avatars, icon buttons, the live dot) are `50%`, not a role: a person is round in both themes.

## Which component takes which role

| Component | Role | Notes |
|---|---|---|
| Video card thumbnail | `thumb` | with a 1 px inset border at 8% `fg` |
| Spotlight, Pick of the day panel | `card` | its picture is `thumb` |
| Card, panel, Callout | `card` | |
| Menu, popover, HoverCard, expanded card | `card` | menu rows `sm` |
| Dialog, Sheet, Drawer (top corners on compact) | `sheet` | |
| Button, IconButton (square variant), Input, Select, search field | `control` | |
| Chip, ChipBar item, engagement bar, pill | `chip` | |
| Toast | `control` | |
| Tooltip | 8 px in the stand-in | outside the roles: use `sm` |
| Badge, duration chip, Kbd | `xs` | Kbd is 6 px in the stand-in, equal to Sand `xs` |
| Queue row, now playing thumbnail | `sm` | |
| Player | `card` | the stage's glow is not clipped |
| Skeleton | the role of what it stands for | stand-in uses 8 px: set per shape |
| Avatar, IconButton (round), dot | `50%` | |
| Progress and seek bars | 2 px | fixed, not themed |

Because `control` and `chip` are 999 px in `round` and `soft` respectively, a control or chip never needs a
fixed height-based radius: let the role be a pill and the set decide. Under `sharp` a chip is a 6 px rectangle,
so a chip's design must hold in both shapes.

Do: nest radii inward (a `card` holding a `thumb` has the smaller radius inside). Don't: put a `sheet` radius
on something smaller than 120 px, or write `rounded-xl` instead of the role.

## Elevation

Three steps per mode family, three implementations of the `shadow` set: `flat`, `soft` and `deep`. Sand starts on
`soft`, Nocturne on `flat`. Dark mode lifts with a lighter surface first and a shadow second; light mode lifts
with the shadow first and keeps the same white. A raised thing in dark is `raised` (one ramp step above
`surface`), in light `raised` equals `surface`, so the shadow does all the work. Layers are offset y, blur,
spread, colour (x is 0).

| Set | Character | Steps 1 to 3 |
|---|---|---|
| `flat` | no shadows: surfaces separate by borders and steps of ground only | each step is a fully transparent layer, so `shadow-1`, `shadow-2` and `shadow-3` are valid and invisible |
| `soft` | low, diffuse lift | the tables below |
| `deep` | pronounced depth for a more physical feel | the tables below |

`soft`:

| Step | Mode | Layers |
|---|---|---|
| 1 | dark | 1 px, 2 px, 0, `#00000066` |
| 2 | dark | 2 px, 4 px, 0, `#00000066` then 18 px, 40 px, -8 px, `#00000073` |
| 3 | dark | 4 px, 8 px, 0, `#00000080` then 32 px, 64 px, -12 px, `#0000008C` |
| 1 | light | 1 px, 2 px, 0, `#2A1E1014` |
| 2 | light | 2 px, 4 px, 0, `#2A1E100F` then 16 px, 32 px, -8 px, `#2A1E101A` |
| 3 | light | 4 px, 8 px, 0, `#2A1E1014` then 28 px, 56 px, -12 px, `#2A1E1024` |

`deep`:

| Step | Mode | Layers |
|---|---|---|
| 1 | dark | 2 px, 3 px, 0, `#00000066` |
| 2 | dark | 3 px, 6 px, 0, `#00000066` then 29 px, 64 px, -8 px, `#00000073` |
| 3 | dark | 6 px, 13 px, 0, `#00000080` then 51 px, 102 px, -12 px, `#0000008C` |
| 1 | light | 2 px, 3 px, 0, `#2A1E1014` |
| 2 | light | 3 px, 6 px, 0, `#2A1E100F` then 26 px, 51 px, -8 px, `#2A1E101A` |
| 3 | light | 6 px, 13 px, 0, `#2A1E1014` then 45 px, 90 px, -12 px, `#2A1E1024` |

OLED uses the dark steps; on a true-black ground the shadow is nearly invisible under every set, so the ground
ramp (`bg` black, `surface` `#0C0B09` or `#06080C`, `raised` one step up) and the `border` carry the lift.
The light shadow colour is a warm brown (`#2A1E10`) so it never reads as grey in Sand; Nocturne shares it.

Under `flat`, the lift moves to the ground and the border: a floating surface keeps its `raised` ground and its `border`
(see Borders against shadows). Designs must read correctly in all three
sets, so never rely on a shadow alone to separate two surfaces.

| Step | Used by |
|---|---|
| 0 | cards at rest, rail, header: a border, no shadow |
| 1 | the selected segment in a segmented control |
| 2 | hover lift of a thumbnail, menus, popovers, the expanded card |
| 3 | dialogs, sheets, toasts, the now playing bar, the player on its stage |

## Border widths

The `border` set has three implementations: `hairline` (Sand's default), `regular` (Nocturne's) and `bold`.

| Role | `hairline` | `regular` | `bold` | Applies to |
|---|---|---|---|---|
| `divider` | 1 px | 1 px | 1.5 px | card outlines, row and table separators |
| `control` | 1 px | 1.5 px | 2 px | the outline of a field, outlined button or switch track |
| `focus` | 2 px | 2 px | 3 px | the focus ring thickness |
| `focus-offset` | 2 px | 2 px | 3 px | the gap between a control and its ring |

Utilities: `border-divider`, `border-control`, `outline-focus` and `outline-offset-focus`. `bold` is the
accessibility choice for the more-contrast setting ([accessibility.md](accessibility.md)); it is still its own
choice, so a viewer can have bold borders at standard contrast. Rules elsewhere that say "1 px" mean the
`hairline` value: write the role, never the number.

## Borders against shadows

| Situation | Use |
|---|---|
| A surface sitting on the page, at rest | `border` colour at `border-divider` width, no shadow |
| A surface that floats and can overlap content | `raised` ground, `border` and elevation 2 or 3 (under `flat` the border and ground alone) |
| An interactive outline (input, outlined button) | `border-strong` at `border-control` width, 3:1 against `bg` and `surface` |
| Separating list rows or table rows | `border` at `border-divider` width, or a gap; never both |
| Hover | `tint` fill, not a shadow, except the thumbnail lift |
| Focus | the focus ring, never a border colour change alone |
| Selected | `accent-soft` ground, not a thicker border |

Do: pair `border-strong` with every field. Don't: stack a shadow and a `border-strong` on the same element,
or use a shadow on a card inside a card.

## Layering

Names are `scale.z`; the table adds who sits on each (assignments follow the token names and the stand-in).

| Token | Value | Layer |
|---|---|---|
| `base` | 0 | page content |
| `sticky` | 20 | header, sticky tab strips |
| `rail` | 30 | rail and the bottom tab bar |
| `overlay` | 40 | now playing bar, the player's chat overlay |
| `modal` | 50 | scrim, dialogs, sheets, drawers |
| `popover` | 60 | menus, popovers, the command palette's list, hover cards |
| `toast` | 70 | toasts |
| `tooltip` | 80 | tooltips |

The library's own switcher sits at 90, outside the product scale. Use the token, never a number: a menu that
opens from inside a dialog still needs `popover` above `modal`.

## Do and don't

| Do | Don't |
|---|---|
| `rounded-card` for a panel, `rounded-thumb` for a frame | Mix a pill and a 10 px radius in one row |
| Let the `radius` set change every corner at once | Hard-code 8 px to look good in one set |
| Test every story in Sand and Nocturne and under `sharp`, `round`, `flat` and `deep` | Judge a radius or a shadow under one implementation only |
| Keep one shadow family per mode | Add a fourth elevation step for one component |
| Write `border-control`, `shadow-2` | Write `border` plus a pixel width, or a shadow value |
