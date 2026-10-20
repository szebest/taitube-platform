# Foundations

The deep reference behind the [design language](../README.md). The README says what Taitube looks like and
why; these files say exactly how each foundation is specified, resolved from [`tokens.json`](../tokens.json),
with the tables, rules and do and don't lists a designer or an agent builds from. Where a file repeats a value
it is quoted from the token file and the token file wins.

| File | One line |
|---|---|
| [color.md](color.md) | The three tiers (ref ramps, theme roles, dataviz), every role resolved per theme and mode, the enforced contrast pairs with measured ratios, accent override, status and video colour, adding a role |
| [token-sets.md](token-sets.md) | What a token set is, the nine groups with every implementation and value, each theme's defaults, how an override resolves, the CSS variables and proposed Tailwind utilities each set writes |
| [typography.md](typography.md) | Three faces and why, the eleven-style scale, the four size steps, pairing, numerals, truncation, responsive steps, editorial voice, RTL |
| [spacing-layout.md](spacing-layout.md) | The raw 4 px scale against spacing roles, the three spacing and three sizing sets, density, breakpoints and the shell per breakpoint, grids, widths, the shell anatomy |
| [shape-elevation.md](shape-elevation.md) | Radius and border sets and which component takes which role, shadow sets (flat, soft, deep), z-index layers, borders against shadows |
| [motion.md](motion.md) | The standard, calm and reduced sets, duration and easing tokens, the catalogue of every motion with trigger, property, timing and reduced-motion behaviour |
| [iconography.md](iconography.md) | Lucide at 1.75, the three `IconSize` steps from the sizing set, active states, icon plus label rules, the inventory in `lib/icons.svg`, labelling |
| [accessibility.md](accessibility.md) | WCAG 2.2 AA bar, focus ring, keyboard map, target sizes, reduced motion, the appearance levers (font size, bold borders, calm motion, ambient off), RTL, screen reader patterns per surface, captions |
| [voice-and-copy.md](voice-and-copy.md) | The curator's voice, UI copy rules, the settings vocabulary, editorial lines, number and date formatting, the product glossary (Subscribe is the settled term) |

## How the pieces fit

| Question | Start here |
|---|---|
| Which colour do I use for this? | [color.md](color.md), the role table, then the status rules |
| Why does this text look wrong at this size? | [typography.md](typography.md), the scale and pairing rules |
| How wide is the content at 1440? | [spacing-layout.md](spacing-layout.md), the grid table |
| Which radius does a menu take? | [shape-elevation.md](shape-elevation.md), the component table |
| What can a viewer change, and what does each choice write? | [token-sets.md](token-sets.md) |
| What does `h-control-md` or `gap-stack` resolve to? | [token-sets.md](token-sets.md), the variables and utilities table |
| What animates, and what must not? | [motion.md](motion.md), the catalogue and rules |
| Which icon, at which size? | [iconography.md](iconography.md) |
| Is this keyboard and screen reader complete? | [accessibility.md](accessibility.md) |
| What do I call this button? | [voice-and-copy.md](voice-and-copy.md) |

## Token sets

[token-sets.md](token-sets.md) is the entry for everything a theme does not own. A theme owns colour; type,
spacing, sizing, radius, borders, shadows, the ambient glow and motion are nine swappable token sets, each theme
names a default of each, and the viewer can override any one. The other foundation files say how each role is
used; the values for every implementation live in the token sets file and in [`tokens.json`](../tokens.json).

## Shared option unions

A component prop's string union is a shared vocabulary (`SizeOption`, `ControlSize`, `IconSize`, `RadiusOption`,
`ToneOption` and the rest), not something each component invents. Where they live and how a component narrows
one is in [architecture.md section 3](../architecture.md#3-shared-option-unions).

## Source of truth

1. [`tokens.json`](../tokens.json) holds every value (`ref`, `set.<group>.<implementation>`, `theme.<name>` and `scale`). It is hand-edited until slice h of
   [ticket 95](../../tickets/95-design-system-2.md); from then on it is generated (`pnpm gen:tokens`) and a hand
   edit fails CI.
2. The [README](../README.md) holds the look and the polish bar (section 9).
3. These files hold the elaboration. A number that appears here and nowhere in the token file is a measurement
   of the CSS stand-in [`lib/design.css`](../lib/design.css) or a proposal, and is labelled as one.

## Conventions used in these files

- Role names (`fg-muted`, `accent-ink`), radius roles (`thumb`, `control`) and spacing or sizing roles
  (`gap-stack`, `control-md`) are written in code font; a
  component names the role and never a hex value, a ramp step or a palette class.
- "Enforced" means the contrast gate in `@vp/design-tokens` fails the build on a miss; "advisory" means a
  recommendation with no gate.
- Ratios are WCAG 2.x relative luminance, computed from the resolved hex values, with translucent roles
  composited over the ground they sit on.
- Every file ends with the things a reviewer should check; the full checklist stays in README section 9.
