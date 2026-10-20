# AGENTS.md - @vp/design-tokens (the design system engine)

Instructions for any coding agent working on `@vp/design-tokens`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

---

## 1. Scope & Purpose

`@vp/design-tokens` is the engine of the design system ([ticket 95](../../../docs/tickets/95-design-system-2.md),
[docs/design/architecture.md](../../../docs/design/architecture.md)): the schemas every token set and theme
parses against. `@vp/ui` holds the concrete values and imports this package to check them.

It holds the Zod schemas in `src/schema/`, one file per token group: `typography`, `font-size`, `spacing`,
`sizing`, `radius`, `border`, `shadow`, `ambient` and `motion`. Each file exports its schema and the option arrays
it is keyed by (`SIZE_OPTIONS`, `RADIUS_OPTIONS`, `SPACE_STEPS`...), each with its type, so a prop union cannot
drift from the tokens. `tokenGroups` in `token-group.ts` keys every group by its camelCase name to
`{ path, schema }`; `TOKEN_GROUPS` is the typed list of those names and `TokenGroup` its member. Beside them:
`roles.ts` (`ROLES`, `TONE_OPTIONS`, the required contrast pairs and `checkRoleContrast`), `theme.ts` (the theme
schema, with `ModeOption` and `ContrastOption` from `@vp/domain/settings`), `ref.ts` (the tier 1 ramps) and
`scale.ts` (the raw space scale, z layers, breakpoints and layout measures).

`define.ts` holds `defineTokenSet`, `defineTheme` and `defineAppearance`, typed identity helpers whose job is the
compile error, and `defineRef`, which hands back the ramps with `ref(key)`, typed to the steps they hold;
`parse.ts` holds `parseTheme` and `parseTokenSet`, the one runtime check, returning a `Result`, and `resolveTheme`.

A theme role or dataviz entry is a `HexColor` or a `RefAlias` (`ref('sand.950')` is `{ref.sand.950}`, the alias
`tokens.json` writes), so only a theme picks a ramp step. `resolveTheme(theme, ramps)` swaps every alias for its
step, giving a `ResolvedTheme` (hex only), or `VALIDATION_FAILED` naming the field whose alias names no step.
`themeCss` and the contrast gate take resolved colours; `toDtcg` takes the theme as defined, aliases kept.

It also holds the colour maths, written by hand with no colour library: `src/color/` parses and composites hex
colours (6 or 8 digits) and converts sRGB to OKLCH and back, clipping chroma into gamut; `contrast.ts` measures
the WCAG 2 ratio and `checkContrast` returns every `{ foreground, background, floor }` pair under its floor, with
any other field the caller passed and the measured ratio; `accent.ts` holds `deriveAccent(hex, family)`, which
returns a `Result` of `accent`, `accentHover`, `accentSoft`, `onAccent` and `accentInk`, documenting each one's
floor on `DerivedAccent`, or `InvalidColour` for a malformed hex. The maths knows no role or theme: `roles.ts` hands
it the required pairs.

The generators in `src/generate/` turn definitions into text and write no file (`gen:tokens` does): `themeCss`,
`tokenSetCss` and `scaleCss` return the CSS, `accentCss` the derived accent roles for a viewer's override (a
`Result`), `tailwindTheme` the `@theme inline reference` block, and `toDtcg` the `tokens.json` tree. `rule.ts`
holds the one CSS rule writer and `inFamily`, the selector for every mode of a family; each group's variable
names and Tailwind keys sit side by side in `WRITERS` in `token-set-css.ts`. `tokenFiles({ ref, scale, themes,
defaultTheme, offer })` composes them into the four files `pnpm gen:tokens` writes (`tokens.json` and the themes,
sets and Tailwind CSS, each CSS file under one generated header), or the `resolveTheme` failure.

It is `universal` because `@vp/ui` (client) builds on it and the generators that write `tokens.json` and the
CSS run on a server. It is T2 because it takes the appearance vocabulary from `@vp/domain/settings` (T1); never
import `@vp/domain-rules` (T3) or redeclare a pattern `@vp/domain/settings` exports.

---

## 2. Invariants

1. **No concrete value.** A schema says what a set must hold, never what it holds. Values live in
   `@vp/ui/tokens/<path>/<id>`; `docs/design/tokens.json` is their image.
2. **Group keys are camelCase** (`fontSize`) in TypeScript and `tokens.json`; module paths and HTML
   attributes are kebab-case (`@vp/ui/tokens/font-size/<id>`, `data-font-size`). `tokenGroups` is the one
   place that mapping lives: never derive a kebab name anywhere else.
3. **A set names every key and nothing else.** Objects are strict and records are keyed by an enum, so a
   missing or misspelt key fails to parse, at any depth.
4. **Every group spec parses every set of `tokens.json`** for that group through
   `describeTokenGroupContract`, and runs under node, jsdom and `bun test`.
5. **Relative imports are extensionless**, as in every tier.
6. **An unmeasurable pair fails.** A malformed hex or a translucent background measures as `NaN`, and the gate
   reports it rather than passing it; composite a translucent ground with `compositeOver` first, which returns
   `InvalidColour` rather than a colour for a malformed hex or a translucent ground of its own.
7. **A family is a selector, not an attribute.** Dark and OLED share `inFamily('dark')`; a rule that must beat a
   theme rule (the accent override) is one attribute more specific, never later in the file.
8. **Accents are measured against `ACCENT_GROUNDS`**, the lightest dark and darkest light ground a theme may
   place the accent on, so one derived accent holds on every theme of that mode family. `groundsInsideAccentBand`
   is the one check that a theme's grounds sit inside them.

---

## 3. Local Commands

```bash
pnpm --filter @vp/design-tokens typecheck
pnpm --filter @vp/design-tokens test
bun test packages/universal/design-tokens
```
