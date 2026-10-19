# AGENTS.md - @vp/design-tokens (the design system engine)

Instructions for any coding agent working on `@vp/design-tokens`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

---

## 1. Scope & Purpose

`@vp/design-tokens` is the engine of the design system ([ticket 95](../../../docs/tickets/95-design-system-2.md),
[docs/design/architecture.md](../../../docs/design/architecture.md)): the schemas every token set and theme
parses against. `@vp/ui` holds the concrete values and imports this package to check them.

Today it holds the Zod schemas of the nine token groups in `src/schema/`, one file each: `typography`,
`font-size`, `spacing`, `sizing`, `radius`, `border`, `shadow`, `ambient` and `motion`. Each file exports
only its schema; `tokenGroups` in `token-group.ts` keys every group by its camelCase name to
`{ path, schema }`, and `TokenGroup` is its key.

It also holds the colour maths, written by hand with no colour library: `src/color/` parses and composites hex
colours (6 or 8 digits) and converts sRGB to OKLCH and back, clipping chroma into gamut; `contrast.ts` measures
the WCAG 2 ratio and `checkContrast` returns every `{ foreground, background, floor }` pair under its floor, with
any other field the caller passed and the measured ratio; `accent.ts` holds `deriveAccent(hex, family)`, which
returns `accent`, `onAccent` and `accentInk` and documents each one's floor on `DerivedAccent`. None of it knows
a role or a theme: the required pairs are the caller's.

It is `universal` because `@vp/ui` (client) builds on it and the generators that write `tokens.json` and the
CSS run on a server. It is T2 because it will take the appearance vocabulary from `@vp/domain` (T1).

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
   reports it rather than passing it; composite a translucent ground with `compositeOver` first.
7. **Accents are measured against `ACCENT_GROUNDS`**, the lightest dark and darkest light ground a theme may
   place the accent on, so one derived accent holds on every theme of that mode family.

---

## 3. Local Commands

```bash
pnpm --filter @vp/design-tokens typecheck
pnpm --filter @vp/design-tokens test
bun test packages/universal/design-tokens
```
